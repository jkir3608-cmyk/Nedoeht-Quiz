import { WebSocketServer, WebSocket } from "ws";
import { db } from "@workspace/db";
import {
  gamesTable,
  questionsTable,
  playersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const ADMIN_PASSWORD = "2026BIOlogy!";

interface GameClient {
  ws: WebSocket;
  gameId: number;
  role: "host" | "player";
  playerId?: number;
}

const clients = new Map<WebSocket, GameClient>();

function getGameClients(gameId: number) {
  return Array.from(clients.values()).filter((c) => c.gameId === gameId);
}

function broadcast(gameId: number, data: object, excludeWs?: WebSocket) {
  const msg = JSON.stringify(data);
  getGameClients(gameId).forEach((c) => {
    if (c.ws !== excludeWs && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  });
}

function sendToPlayer(gameId: number, playerId: number, data: object) {
  const msg = JSON.stringify(data);
  getGameClients(gameId).forEach((c) => {
    if (c.role === "player" && c.playerId === playerId && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  });
}

function sendToHost(gameId: number, data: object) {
  const msg = JSON.stringify(data);
  getGameClients(gameId).forEach((c) => {
    if (c.role === "host" && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  });
}

const questionTimers = new Map<number, ReturnType<typeof setTimeout>>();

async function sendNextQuestion(gameId: number) {
  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  if (!game || game.status !== "playing") return;

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, game.quizId))
    .orderBy(questionsTable.orderIndex);

  const nextIndex = game.currentQuestionIndex + 1;

  if (nextIndex >= questions.length) {
    await endGame(gameId);
    return;
  }

  await db
    .update(gamesTable)
    .set({ currentQuestionIndex: nextIndex })
    .where(eq(gamesTable.id, gameId));

  const question = questions[nextIndex];

  broadcast(gameId, {
    type: "question",
    question: {
      id: question.id,
      text: question.text,
      options: question.options,
      timeLimit: question.timeLimit,
    },
    questionIndex: nextIndex,
    totalQuestions: questions.length,
    timeLimit: question.timeLimit,
  });

  const timer = setTimeout(async () => {
    const q = questions[nextIndex];
    broadcast(gameId, {
      type: "time-up",
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? "No explanation provided.",
    });
  }, question.timeLimit * 1000 + 2000);

  questionTimers.set(gameId, timer);
}

async function endGame(gameId: number) {
  await db
    .update(gamesTable)
    .set({ status: "ended" })
    .where(eq(gamesTable.id, gameId));

  const players = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.gameId, gameId), eq(playersTable.isKicked, false)));

  const leaderboard = players
    .sort((a, b) => b.coins - a.coins)
    .map((p, i) => ({
      rank: i + 1,
      id: p.id,
      nickname: p.nickname,
      coins: p.coins,
      correctAnswers: p.correctAnswers,
      totalAnswers: p.totalAnswers,
      avatarColor: p.avatarColor,
    }));

  broadcast(gameId, { type: "game-ended", players: leaderboard });
}

function calculateReward(
  skillLuckScale: number,
  basePoints: number,
): { type: string; coins: number; multiplier?: number } {
  if (skillLuckScale === 1) {
    return { type: "flat", coins: 10 };
  }

  const rand = Math.random();
  const luckWeight = (skillLuckScale - 1) / 4;

  if (luckWeight < 0.25 || rand < (1 - luckWeight) * 0.7) {
    const coins = Math.round(basePoints * (0.8 + Math.random() * 0.4));
    return { type: "coins", coins };
  }

  const luckRoll = Math.random();

  if (luckWeight >= 0.75 && luckRoll < 0.15) {
    const lost = Math.floor(Math.random() * 40) + 30;
    return { type: "big-loss", coins: -lost, multiplier: 0 };
  }

  if (luckRoll < 0.2 * luckWeight) {
    const lost = Math.floor(Math.random() * 20) + 10;
    return { type: "loss", coins: -lost };
  }

  if (luckRoll < 0.4) {
    return { type: "double", coins: basePoints * 2, multiplier: 2 };
  }

  if (luckRoll < 0.55 && luckWeight >= 0.5) {
    return { type: "triple", coins: basePoints * 3, multiplier: 3 };
  }

  if (luckRoll < 0.65 && luckWeight >= 0.75) {
    return { type: "quadruple", coins: basePoints * 4, multiplier: 4 };
  }

  return { type: "coins", coins: basePoints };
}

function chestReward(skillLuckScale: number, basePoints: number) {
  const rewards = [
    { type: "coins", coins: basePoints },
    { type: "double", coins: basePoints * 2, multiplier: 2 },
    { type: "coins", coins: Math.floor(basePoints * 0.5) },
  ];
  if (skillLuckScale >= 3) {
    rewards.push({ type: "triple", coins: basePoints * 3, multiplier: 3 });
    if (skillLuckScale >= 4) {
      rewards.push({ type: "big-loss", coins: -Math.floor(basePoints * 0.3), multiplier: 0 });
    }
    if (skillLuckScale === 5) {
      rewards.push({ type: "quadruple", coins: basePoints * 4, multiplier: 4 });
    }
  }
  return rewards[Math.floor(Math.random() * rewards.length)];
}

async function handleAnswer(
  ws: WebSocket,
  client: GameClient,
  msg: { questionIndex: number; answerIndex: number; playerId: number },
) {
  const { gameId } = client;

  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  if (!game || game.status !== "playing") return;

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, game.quizId))
    .orderBy(questionsTable.orderIndex);

  const question = questions[msg.questionIndex];
  if (!question) return;

  const player = await db.query.playersTable.findFirst({
    where: and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)),
  });
  if (!player || player.isKicked) return;

  const correct = msg.answerIndex === question.correctAnswer;

  let coinsEarned = 0;
  let rewardType = "none";
  let showChests = false;
  let newConsecutive = correct ? player.consecutiveCorrect + 1 : 0;

  if (correct) {
    const reward = calculateReward(game.skillLuckScale, question.points);
    coinsEarned = reward.coins;
    rewardType = reward.type;

    if (newConsecutive >= 3) {
      showChests = true;
      newConsecutive = 0;
    }
  }

  const newCoins = Math.max(0, player.coins + coinsEarned);
  const newCorrect = player.correctAnswers + (correct ? 1 : 0);
  const newTotal = player.totalAnswers + 1;

  await db
    .update(playersTable)
    .set({
      coins: newCoins,
      correctAnswers: newCorrect,
      totalAnswers: newTotal,
      consecutiveCorrect: newConsecutive,
    })
    .where(eq(playersTable.id, player.id));

  const payload = {
    type: "answer-result",
    correct,
    coinsEarned,
    rewardType,
    newTotal: newCoins,
    explanation: question.explanation ?? "No explanation provided.",
    correctAnswer: question.correctAnswer,
  };

  ws.send(JSON.stringify(payload));

  if (showChests) {
    setTimeout(() => {
      ws.send(JSON.stringify({ type: "show-chests" }));
    }, 1500);
  }

  const allPlayers = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.gameId, gameId), eq(playersTable.isKicked, false)));

  sendToHost(gameId, {
    type: "leaderboard",
    players: allPlayers
      .sort((a, b) => b.coins - a.coins)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        coins: p.coins,
        correctAnswers: p.correctAnswers,
        avatarColor: p.avatarColor,
      })),
  });
}

async function handleOpenChest(
  ws: WebSocket,
  client: GameClient,
  msg: { chestIndex: number; playerId: number },
) {
  const { gameId } = client;
  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  if (!game) return;

  const player = await db.query.playersTable.findFirst({
    where: and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)),
  });
  if (!player) return;

  const reward = chestReward(game.skillLuckScale, 50);
  const newCoins = Math.max(0, player.coins + reward.coins);

  await db
    .update(playersTable)
    .set({ coins: newCoins })
    .where(eq(playersTable.id, player.id));

  ws.send(JSON.stringify({
    type: "chest-result",
    reward,
    newTotal: newCoins,
  }));

  broadcast(gameId, {
    type: "coins-updated",
    playerId: player.id,
    coins: newCoins,
  }, ws);
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const gameId = parseInt(url.searchParams.get("gameId") ?? "0");
    const role = url.searchParams.get("role") as "host" | "player" ?? "player";
    const playerId = parseInt(url.searchParams.get("playerId") ?? "0") || undefined;

    if (!gameId) {
      ws.close(1008, "Missing gameId");
      return;
    }

    const client: GameClient = { ws, gameId, role, playerId };
    clients.set(ws, client);

    logger.info({ gameId, role, playerId }, "WebSocket client connected");

    if (role === "player" && playerId) {
      db.query.playersTable.findFirst({
        where: and(eq(playersTable.id, playerId), eq(playersTable.gameId, gameId)),
      }).then((player) => {
        if (!player) return;
        sendToHost(gameId, { type: "player-joined", player });
        db.select()
          .from(playersTable)
          .where(and(eq(playersTable.gameId, gameId), eq(playersTable.isKicked, false)))
          .then((players) => {
            broadcast(gameId, { type: "player-list", players });
          });
      }).catch((err) => logger.error({ err }, "Error on player connect"));
    }

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const client = clients.get(ws);
        if (!client) return;

        switch (msg.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;

          case "answer":
            await handleAnswer(ws, client, msg);
            break;

          case "open-chest":
            await handleOpenChest(ws, client, msg);
            break;

          case "next-question":
            if (client.role === "host") {
              const timer = questionTimers.get(gameId);
              if (timer) clearTimeout(timer);
              questionTimers.delete(gameId);
              await sendNextQuestion(gameId);
            }
            break;

          case "start-game":
            if (client.role === "host") {
              await db
                .update(gamesTable)
                .set({ status: "playing", currentQuestionIndex: -1 })
                .where(eq(gamesTable.id, gameId));
              broadcast(gameId, { type: "game-started" });
              setTimeout(() => sendNextQuestion(gameId), 2000);
            }
            break;

          case "kick-player":
            if (client.role === "host" && msg.playerId) {
              await db
                .update(playersTable)
                .set({ isKicked: true })
                .where(and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)));
              broadcast(gameId, { type: "player-kicked", playerId: msg.playerId });
            }
            break;

          case "admin-update-coins":
            if (msg.password === ADMIN_PASSWORD && msg.playerId !== undefined) {
              await db
                .update(playersTable)
                .set({ coins: msg.coins })
                .where(and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)));
              broadcast(gameId, {
                type: "coins-updated",
                playerId: msg.playerId,
                coins: msg.coins,
              });
            } else if (msg.password !== ADMIN_PASSWORD) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid admin password" }));
            }
            break;

          default:
            break;
        }
      } catch (err) {
        logger.error({ err }, "WebSocket message error");
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
      clients.delete(ws);
    });
  });
}
