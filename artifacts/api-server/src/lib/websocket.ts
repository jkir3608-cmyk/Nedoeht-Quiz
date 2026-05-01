import { WebSocketServer, WebSocket } from "ws";
import { db } from "@workspace/db";
import { gamesTable, questionsTable, playersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "./logger";

const ADMIN_PASSWORD = "2026BIOlogy!";

interface GameClient {
  ws: WebSocket;
  gameId: number;
  role: "host" | "player";
  playerId?: number;
  seenQuestionIds: Set<number>;
}

interface GameTimer {
  interval: ReturnType<typeof setInterval>;
  endTimeout: ReturnType<typeof setTimeout>;
  endsAt: number;
  remainingSeconds: number;
}

interface PendingChest {
  gameId: number;
  rewards: Array<{ type: string; coins: number; multiplier?: number; label: string }>;
  playerCoins: number;
}

const clients = new Map<WebSocket, GameClient>();
const gameTimers = new Map<number, GameTimer>();
const pendingChests = new Map<number, PendingChest>(); // keyed by playerId

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

function sendToHost(gameId: number, data: object) {
  const msg = JSON.stringify(data);
  getGameClients(gameId).forEach((c) => {
    if (c.role === "host" && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  });
}

async function sendLeaderboardToHost(gameId: number) {
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
        totalAnswers: p.totalAnswers,
        avatarColor: p.avatarColor,
      })),
  });
}

async function getNextQuestionForPlayer(client: GameClient, quizId: number) {
  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, quizId));

  if (questions.length === 0) return null;

  let candidates = questions.filter((q) => !client.seenQuestionIds.has(q.id));
  if (candidates.length === 0) {
    client.seenQuestionIds.clear();
    candidates = questions;
  }

  const question = candidates[Math.floor(Math.random() * candidates.length)];
  client.seenQuestionIds.add(question.id);
  return question;
}

async function endGame(gameId: number) {
  const gt = gameTimers.get(gameId);
  if (gt) {
    clearInterval(gt.interval);
    clearTimeout(gt.endTimeout);
    gameTimers.delete(gameId);
  }

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

function startGameTimer(gameId: number, durationSeconds: number) {
  const existing = gameTimers.get(gameId);
  if (existing) {
    clearInterval(existing.interval);
    clearTimeout(existing.endTimeout);
  }

  const endsAt = Date.now() + durationSeconds * 1000;
  let remainingSeconds = durationSeconds;

  const interval = setInterval(() => {
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    if (gameTimers.get(gameId)) {
      gameTimers.get(gameId)!.remainingSeconds = remainingSeconds;
    }
    broadcast(gameId, { type: "timer", remaining: remainingSeconds, endsAt });
  }, 1000);

  const endTimeout = setTimeout(() => {
    endGame(gameId).catch((err) => logger.error({ err }, "Error ending game"));
  }, durationSeconds * 1000);

  gameTimers.set(gameId, { interval, endTimeout, endsAt, remainingSeconds });
}

function getCorrectAnswerReward(skillLuckScale: number, basePoints: number) {
  if (skillLuckScale === 1) return { type: "flat", coins: 30 };

  const luckWeight = (skillLuckScale - 1) / 4;
  const rand = Math.random();

  if (rand < 0.6 - luckWeight * 0.3) {
    const coins = basePoints + Math.floor(Math.random() * basePoints * 0.5 * luckWeight);
    return { type: "coins", coins: Math.max(10, coins) };
  }

  if (luckWeight >= 0.5 && rand < 0.75) {
    return { type: "double", coins: basePoints * 2 };
  }

  if (luckWeight >= 0.75 && rand < 0.85) {
    return { type: "triple", coins: basePoints * 3 };
  }

  return { type: "coins", coins: basePoints };
}

function buildChestRewardPool(skillLuckScale: number) {
  type Reward = { type: string; coins: number; multiplier?: number; label: string; weight: number };
  const pool: Reward[] = [];

  if (skillLuckScale === 1) {
    return [
      { type: "flat", coins: 30, label: "+30 Coins", weight: 1 },
      { type: "flat", coins: 30, label: "+30 Coins", weight: 1 },
      { type: "flat", coins: 30, label: "+30 Coins", weight: 1 },
    ];
  }

  pool.push({ type: "coins", coins: 50, label: "+50 Coins", weight: 25 });
  pool.push({ type: "coins", coins: 25, label: "+25 Coins", weight: 20 });

  if (skillLuckScale >= 2) {
    pool.push({ type: "double", coins: 0, multiplier: 2, label: "2× Your Coins!", weight: 15 });
    pool.push({ type: "loss", coins: -30, label: "−30 Coins", weight: 12 });
  }
  if (skillLuckScale >= 3) {
    pool.push({ type: "triple", coins: 0, multiplier: 3, label: "3× Your Coins!", weight: 8 });
    pool.push({ type: "percent-loss", coins: 0, multiplier: 0.7, label: "Lose 30%!", weight: 7 });
    pool.push({ type: "steal", coins: 0, label: "Steal 50% from someone!", weight: 6 });
  }
  if (skillLuckScale >= 4) {
    pool.push({ type: "big-bonus", coins: 150, label: "+150 Coins!", weight: 4 });
    pool.push({ type: "quadruple", coins: 0, multiplier: 4, label: "4× Your Coins!", weight: 2 });
    pool.push({ type: "big-loss", coins: -80, label: "−80 Coins!", weight: 4 });
  }
  if (skillLuckScale === 5) {
    pool.push({ type: "jackpot", coins: 300, label: "JACKPOT +300!", weight: 1 });
    pool.push({ type: "bust", coins: 0, multiplier: 0, label: "BUST − Lose All!", weight: 2 });
  }

  const totalWeight = pool.reduce((s, r) => s + r.weight, 0);
  const pickOne = (): Reward => {
    let rand = Math.random() * totalWeight;
    for (const r of pool) {
      rand -= r.weight;
      if (rand <= 0) return r;
    }
    return pool[0];
  };

  return [pickOne(), pickOne(), pickOne()];
}

async function applyChestReward(
  player: { id: number; coins: number; nickname: string },
  gameId: number,
  reward: { type: string; coins: number; multiplier?: number },
  ws: WebSocket,
): Promise<{ newCoins: number; coinsChange: number; stealInfo: { fromNickname: string; stolen: number } | null }> {
  let coinsChange = 0;
  let stealInfo: { fromNickname: string; stolen: number } | null = null;

  switch (reward.type) {
    case "flat":
    case "coins":
    case "big-bonus":
    case "jackpot":
      coinsChange = reward.coins;
      break;
    case "loss":
    case "big-loss":
      coinsChange = reward.coins;
      break;
    case "double":
    case "triple":
    case "quadruple":
      coinsChange = Math.floor(player.coins * ((reward.multiplier ?? 1) - 1));
      break;
    case "percent-loss":
      coinsChange = -Math.floor(player.coins * (1 - (reward.multiplier ?? 0.7)));
      break;
    case "bust":
      coinsChange = -player.coins;
      break;
    case "steal": {
      const others = await db
        .select()
        .from(playersTable)
        .where(
          and(
            eq(playersTable.gameId, gameId),
            eq(playersTable.isKicked, false),
            ne(playersTable.id, player.id),
          ),
        );
      const richOthers = others.filter((p) => p.coins > 0);
      if (richOthers.length > 0) {
        const victim = richOthers[Math.floor(Math.random() * richOthers.length)];
        const stolen = Math.floor(victim.coins * 0.5);
        coinsChange = stolen;
        await db
          .update(playersTable)
          .set({ coins: Math.max(0, victim.coins - stolen) })
          .where(eq(playersTable.id, victim.id));
        broadcast(gameId, { type: "coins-updated", playerId: victim.id, coins: Math.max(0, victim.coins - stolen) }, ws);
        stealInfo = { fromNickname: victim.nickname, stolen };
      } else {
        coinsChange = 25;
      }
      break;
    }
    default:
      coinsChange = 0;
  }

  const newCoins = Math.max(0, player.coins + coinsChange);
  await db
    .update(playersTable)
    .set({ coins: newCoins })
    .where(eq(playersTable.id, player.id));

  return { newCoins, coinsChange, stealInfo };
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const gameId = parseInt(url.searchParams.get("gameId") ?? "0");
    const role = (url.searchParams.get("role") as "host" | "player") ?? "player";
    const playerId = parseInt(url.searchParams.get("playerId") ?? "0") || undefined;

    if (!gameId) {
      ws.close(1008, "Missing gameId");
      return;
    }

    const client: GameClient = { ws, gameId, role, playerId, seenQuestionIds: new Set() };
    clients.set(ws, client);

    logger.info({ gameId, role, playerId }, "WebSocket client connected");

    if (role === "player" && playerId) {
      db.query.playersTable
        .findFirst({ where: and(eq(playersTable.id, playerId), eq(playersTable.gameId, gameId)) })
        .then(async (player) => {
          if (!player) return;
          sendToHost(gameId, { type: "player-joined", player });

          const players = await db
            .select()
            .from(playersTable)
            .where(and(eq(playersTable.gameId, gameId), eq(playersTable.isKicked, false)));
          broadcast(gameId, { type: "player-list", players });

          const game = await db.query.gamesTable.findFirst({ where: eq(gamesTable.id, gameId) });
          if (game?.status === "playing") {
            const gt = gameTimers.get(gameId);
            ws.send(
              JSON.stringify({
                type: "game-started",
                endsAt: gt?.endsAt ?? Date.now() + 60000,
                remainingSeconds: gt?.remainingSeconds ?? 60,
              }),
            );
          }
        })
        .catch((err) => logger.error({ err }, "Error on player connect"));
    }

    if (role === "host") {
      const gt = gameTimers.get(gameId);
      if (gt) {
        ws.send(JSON.stringify({ type: "game-started", endsAt: gt.endsAt, remainingSeconds: gt.remainingSeconds }));
      }
    }

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const client = clients.get(ws);
        if (!client) return;
        const { gameId } = client;

        switch (msg.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;

          case "start-game": {
            if (client.role !== "host") break;
            const duration =
              typeof msg.duration === "number" && msg.duration > 0 ? msg.duration : 480;

            await db
              .update(gamesTable)
              .set({ status: "playing" })
              .where(eq(gamesTable.id, gameId));

            startGameTimer(gameId, duration);
            const gt = gameTimers.get(gameId)!;
            broadcast(gameId, { type: "game-started", endsAt: gt.endsAt, remainingSeconds: duration });
            break;
          }

          case "request-question": {
            if (client.role !== "player" || !client.playerId) break;

            const game = await db.query.gamesTable.findFirst({ where: eq(gamesTable.id, gameId) });
            if (!game || game.status !== "playing") break;

            const question = await getNextQuestionForPlayer(client, game.quizId);
            if (!question) {
              ws.send(JSON.stringify({ type: "no-questions" }));
              break;
            }

            const player = await db.query.playersTable.findFirst({
              where: and(eq(playersTable.id, client.playerId), eq(playersTable.gameId, gameId)),
            });

            ws.send(
              JSON.stringify({
                type: "question",
                question: {
                  id: question.id,
                  text: question.text,
                  options: question.options,
                  timeLimit: question.timeLimit,
                },
                playerCoins: player?.coins ?? 0,
              }),
            );
            break;
          }

          case "answer": {
            if (client.role !== "player" || !client.playerId) break;

            const game = await db.query.gamesTable.findFirst({ where: eq(gamesTable.id, gameId) });
            if (!game || game.status !== "playing") break;

            const question = await db.query.questionsTable.findFirst({
              where: eq(questionsTable.id, msg.questionId),
            });
            if (!question) break;

            const player = await db.query.playersTable.findFirst({
              where: and(eq(playersTable.id, client.playerId), eq(playersTable.gameId, gameId)),
            });
            if (!player || player.isKicked) break;

            const timedOut = msg.timedOut === true;
            const correct = !timedOut && msg.answerIndex === question.correctAnswer;

            let coinsEarned = 0;
            let rewardType = "none";
            let newConsecutive = correct ? player.consecutiveCorrect + 1 : 0;
            let showChests = false;
            let chestRewards: ReturnType<typeof buildChestRewardPool> | null = null;

            if (correct) {
              const baseReward = getCorrectAnswerReward(game.skillLuckScale, question.points);
              coinsEarned = baseReward.coins;
              rewardType = baseReward.type;

              if (newConsecutive >= 3) {
                showChests = true;
                newConsecutive = 0;
                chestRewards = buildChestRewardPool(game.skillLuckScale);
              }
            }

            const newCoins = Math.max(0, player.coins + coinsEarned);
            await db
              .update(playersTable)
              .set({
                coins: newCoins,
                correctAnswers: player.correctAnswers + (correct ? 1 : 0),
                totalAnswers: player.totalAnswers + 1,
                consecutiveCorrect: newConsecutive,
              })
              .where(eq(playersTable.id, player.id));

            ws.send(
              JSON.stringify({
                type: "answer-result",
                correct,
                timedOut,
                coinsEarned,
                rewardType,
                newTotal: newCoins,
                explanation: question.explanation ?? "No explanation available.",
                correctAnswer: question.correctAnswer,
                correctAnswerText: question.options[question.correctAnswer],
              }),
            );

            if (showChests && chestRewards) {
              pendingChests.set(client.playerId, {
                gameId,
                rewards: chestRewards,
                playerCoins: newCoins,
              });
              setTimeout(() => {
                ws.send(JSON.stringify({ type: "show-chests" }));
              }, 1800);
            }

            await sendLeaderboardToHost(gameId);
            broadcast(gameId, { type: "coins-updated", playerId: player.id, coins: newCoins }, ws);
            break;
          }

          case "open-chest": {
            if (client.role !== "player" || !client.playerId) break;

            const pending = pendingChests.get(client.playerId);
            if (!pending) break;

            const chestIdx = Math.max(0, Math.min(2, msg.chestIndex ?? 0));
            const reward = pending.rewards[chestIdx];

            const player = await db.query.playersTable.findFirst({
              where: and(eq(playersTable.id, client.playerId), eq(playersTable.gameId, gameId)),
            });
            if (!player) break;

            const { newCoins, coinsChange, stealInfo } = await applyChestReward(
              player,
              gameId,
              reward,
              ws,
            );
            pendingChests.delete(client.playerId);

            ws.send(
              JSON.stringify({
                type: "chest-result",
                reward: { ...reward, coinsChange },
                newTotal: newCoins,
                stealInfo,
              }),
            );

            broadcast(gameId, { type: "coins-updated", playerId: player.id, coins: newCoins }, ws);
            await sendLeaderboardToHost(gameId);
            break;
          }

          case "admin-adjust-timer": {
            if (msg.password !== ADMIN_PASSWORD) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid admin password" }));
              break;
            }
            const newSeconds = typeof msg.newSeconds === "number" ? Math.max(0, msg.newSeconds) : null;
            if (newSeconds === null) break;

            const gt = gameTimers.get(gameId);
            if (!gt) {
              ws.send(JSON.stringify({ type: "error", message: "No active timer for this game" }));
              break;
            }

            startGameTimer(gameId, newSeconds);
            ws.send(JSON.stringify({ type: "timer-adjusted", newSeconds }));
            broadcast(gameId, { type: "timer", remaining: newSeconds, endsAt: Date.now() + newSeconds * 1000 });
            break;
          }

          case "admin-update-coins": {
            if (msg.password !== ADMIN_PASSWORD) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid admin password" }));
              break;
            }
            if (msg.playerId === undefined || msg.coins === undefined) break;

            await db
              .update(playersTable)
              .set({ coins: msg.coins })
              .where(and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)));

            broadcast(gameId, { type: "coins-updated", playerId: msg.playerId, coins: msg.coins });
            break;
          }

          case "kick-player": {
            if (client.role !== "host") break;
            if (!msg.playerId) break;

            await db
              .update(playersTable)
              .set({ isKicked: true })
              .where(and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)));

            broadcast(gameId, { type: "player-kicked", playerId: msg.playerId });
            break;
          }

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
