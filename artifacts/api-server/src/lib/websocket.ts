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
  skillLuckScale: number;
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

function sortWithPinnedRanks(players: { id: number; coins: number; pinnedRank?: number | null }[]) {
  const pinnedPlayers = [...players.filter((p) => p.pinnedRank != null)].sort(
    (a, b) => (a.pinnedRank ?? 999) - (b.pinnedRank ?? 999),
  );
  const freePlayers = [...players.filter((p) => p.pinnedRank == null)].sort(
    (a, b) => b.coins - a.coins,
  );

  const result: typeof players = new Array(players.length).fill(null);
  pinnedPlayers.forEach((p) => {
    const idx = (p.pinnedRank ?? 1) - 1;
    if (idx >= 0 && idx < result.length && result[idx] === null) {
      result[idx] = p;
    } else {
      freePlayers.push(p);
    }
  });

  let freeIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null && freeIdx < freePlayers.length) {
      result[i] = freePlayers[freeIdx++];
    }
  }
  return result.filter(Boolean);
}

async function sendLeaderboardToHost(gameId: number) {
  const allPlayers = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.gameId, gameId), eq(playersTable.isKicked, false)));

  sendToHost(gameId, {
    type: "leaderboard",
    players: sortWithPinnedRanks(allPlayers).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      coins: p.coins,
      coinLabel: p.coinLabel ?? null,
      pinnedRank: p.pinnedRank ?? null,
      correctAnswers: p.correctAnswers,
      totalAnswers: p.totalAnswers,
      avatarColor: p.avatarColor,
      avatar: p.avatar,
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
      avatar: p.avatar,
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
  if (luckWeight >= 0.5 && rand < 0.75) return { type: "double", coins: basePoints * 2 };
  if (luckWeight >= 0.75 && rand < 0.85) return { type: "triple", coins: basePoints * 3 };
  return { type: "coins", coins: basePoints };
}

type RewardDef = { type: string; coins: number; multiplier?: number; label: string; weight: number };

/**
 * Pick one chest reward based on the skill/luck scale.
 * Scale 1 = pure skill (always flat +30).
 * Scale 5 = pure chaos (wild variance, high swap chance).
 */
function pickChestReward(scale: number): RewardDef {
  if (scale === 1) {
    return { type: "flat", coins: 30, label: "+30 Coins", weight: 1 };
  }

  let pool: RewardDef[] = [];

  if (scale === 2) {
    pool = [
      { type: "flat", coins: 10, label: "+10 Coins", weight: 20 },
      { type: "flat", coins: 25, label: "+25 Coins", weight: 30 },
      { type: "flat", coins: 40, label: "+40 Coins", weight: 25 },
      { type: "flat", coins: 70, label: "+70 Coins", weight: 12 },
      { type: "percent-loss", coins: 0, multiplier: 0.9, label: "Lose 10%", weight: 8 },
      { type: "percent-loss", coins: 0, multiplier: 0.8, label: "Lose 20%", weight: 3 },
      { type: "double", coins: 0, multiplier: 2, label: "2× Your Coins!", weight: 2 },
    ];
    // total = 100
  } else if (scale === 3) {
    // Avg ~40 coins, 10% chance above 100, 4% swap
    pool = [
      { type: "flat", coins: 5,   label: "+5 Coins",   weight: 5 },
      { type: "flat", coins: 10,  label: "+10 Coins",  weight: 18 },
      { type: "flat", coins: 30,  label: "+30 Coins",  weight: 22 },
      { type: "flat", coins: 60,  label: "+60 Coins",  weight: 15 },
      { type: "flat", coins: 120, label: "+120 Coins", weight: 6 },
      { type: "flat", coins: 200, label: "+200 Coins", weight: 4 },
      { type: "percent-loss", coins: 0, multiplier: 0.9, label: "Lose 10%", weight: 8 },
      { type: "percent-loss", coins: 0, multiplier: 0.7, label: "Lose 30%", weight: 7 },
      { type: "percent-loss", coins: 0, multiplier: 0.4, label: "Lose 60%", weight: 5 },
      { type: "double",  coins: 0, multiplier: 2, label: "2× Your Coins!", weight: 6 },
      { type: "triple",  coins: 0, multiplier: 3, label: "3× Your Coins!", weight: 4 },
      { type: "swap",    coins: 0, label: "Coin Swap with a random player!", weight: 4 },
    ];
    // total = 104 (close enough, weighted proportionally)
  } else if (scale === 4) {
    pool = [
      { type: "flat", coins: 20,  label: "+20 Coins",  weight: 8 },
      { type: "flat", coins: 30,  label: "+30 Coins",  weight: 10 },
      { type: "flat", coins: 60,  label: "+60 Coins",  weight: 10 },
      { type: "flat", coins: 120, label: "+120 Coins", weight: 7 },
      { type: "flat", coins: 200, label: "+200 Coins", weight: 5 },
      { type: "flat-loss", coins: -80, label: "−80 Coins", weight: 5 },
      { type: "percent-loss", coins: 0, multiplier: 0.7, label: "Lose 30%", weight: 9 },
      { type: "percent-loss", coins: 0, multiplier: 0.5, label: "Lose 50%", weight: 8 },
      { type: "percent-loss", coins: 0, multiplier: 0.3, label: "Lose 70%", weight: 5 },
      { type: "double",    coins: 0, multiplier: 2, label: "2× Your Coins!",  weight: 10 },
      { type: "triple",    coins: 0, multiplier: 3, label: "3× Your Coins!",  weight: 8 },
      { type: "quadruple", coins: 0, multiplier: 4, label: "4× Your Coins!!", weight: 3 },
      { type: "swap", coins: 0, label: "Coin Swap with a random player!", weight: 8 },
      { type: "flat", coins: 10, label: "+10 Coins", weight: 4 },
    ];
    // total = 100
  } else {
    // scale === 5 — pure chaos
    pool = [
      { type: "flat", coins: 5,   label: "+5 Coins (really?)", weight: 7 },
      { type: "flat", coins: 50,  label: "+50 Coins", weight: 9 },
      { type: "flat", coins: 150, label: "+150 Coins", weight: 6 },
      { type: "jackpot",      coins: 300, label: "🎰 JACKPOT! +300!", weight: 4 },
      { type: "jackpot-mega", coins: 500, label: "💎 MEGA JACKPOT! +500!!", weight: 1 },
      { type: "percent-loss", coins: 0, multiplier: 0.5, label: "Lose 50%", weight: 9 },
      { type: "percent-loss", coins: 0, multiplier: 0.3, label: "Lose 70%", weight: 6 },
      { type: "percent-loss", coins: 0, multiplier: 0.1, label: "Lose 90%", weight: 5 },
      { type: "bust",      coins: 0, multiplier: 0, label: "💀 BUST! Lose Everything!", weight: 5 },
      { type: "flat-loss", coins: -100, label: "−100 Coins",  weight: 5 },
      { type: "double",    coins: 0, multiplier: 2, label: "2× Your Coins!", weight: 10 },
      { type: "triple",    coins: 0, multiplier: 3, label: "3× Your Coins!", weight: 8 },
      { type: "quadruple", coins: 0, multiplier: 4, label: "4× Your Coins!!", weight: 5 },
      { type: "fivex",     coins: 0, multiplier: 5, label: "5× YOUR COINS!!!", weight: 2 },
      { type: "swap", coins: 0, label: "Coin Swap with a random player!", weight: 12 },
      { type: "flat", coins: 10, label: "+10 Coins", weight: 6 },
    ];
    // total = 100
  }

  const totalWeight = pool.reduce((s, r) => s + r.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const r of pool) {
    rand -= r.weight;
    if (rand <= 0) return r;
  }
  return pool[0];
}

async function applyChestReward(
  player: { id: number; coins: number; nickname: string },
  gameId: number,
  reward: RewardDef,
  ws: WebSocket,
): Promise<{
  newCoins: number;
  coinsChange: number;
  swapInfo: { withNickname: string; theirOldCoins: number; myOldCoins: number } | null;
}> {
  let coinsChange = 0;
  let swapInfo: { withNickname: string; theirOldCoins: number; myOldCoins: number } | null = null;

  switch (reward.type) {
    case "flat":
    case "big-bonus":
    case "jackpot":
    case "jackpot-mega":
      coinsChange = reward.coins;
      break;

    case "flat-loss":
      coinsChange = reward.coins; // negative
      break;

    case "double":
    case "triple":
    case "quadruple":
    case "fivex":
      coinsChange = Math.floor(player.coins * ((reward.multiplier ?? 1) - 1));
      break;

    case "percent-loss":
      coinsChange = -Math.floor(player.coins * (1 - (reward.multiplier ?? 0.7)));
      break;

    case "bust":
      coinsChange = -player.coins;
      break;

    case "swap": {
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
      const eligible = others.filter((p) => p.coins !== player.coins); // pick someone different
      const target = eligible.length > 0
        ? eligible[Math.floor(Math.random() * eligible.length)]
        : others.length > 0
        ? others[Math.floor(Math.random() * others.length)]
        : null;

      if (target) {
        const myOld = player.coins;
        const theirOld = target.coins;

        // Swap coins in DB
        await db.update(playersTable).set({ coins: theirOld }).where(eq(playersTable.id, player.id));
        await db.update(playersTable).set({ coins: myOld }).where(eq(playersTable.id, target.id));

        // Notify the victim player directly
        sendToPlayer(gameId, target.id, {
          type: "coins-swapped",
          yourOldCoins: theirOld,
          yourNewCoins: myOld,
          swappedWith: player.nickname,
        });

        // Broadcast coins-updated for both (so host leaderboard & other clients update)
        broadcast(gameId, { type: "coins-updated", playerId: player.id, coins: theirOld }, ws);
        broadcast(gameId, { type: "coins-updated", playerId: target.id, coins: myOld });

        coinsChange = theirOld - myOld;
        swapInfo = { withNickname: target.nickname, theirOldCoins: theirOld, myOldCoins: myOld };

        // Return early — coins already saved for both
        return { newCoins: theirOld, coinsChange, swapInfo };
      } else {
        // No other players — give a flat bonus instead
        coinsChange = 30;
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

  return { newCoins, coinsChange, swapInfo };
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

            if (correct) {
              const baseReward = getCorrectAnswerReward(game.skillLuckScale, question.points);
              coinsEarned = baseReward.coins;
              rewardType = baseReward.type;
            }

            const newCorrectAnswers = player.correctAnswers + (correct ? 1 : 0);
            const newCoins = Math.max(0, player.coins + coinsEarned);

            // Chest trigger: every 3 cumulative correct answers
            const showChests = correct && newCorrectAnswers > 0 && newCorrectAnswers % 3 === 0;

            await db
              .update(playersTable)
              .set({
                coins: newCoins,
                correctAnswers: newCorrectAnswers,
                totalAnswers: player.totalAnswers + 1,
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
                showChests,
              }),
            );

            if (showChests) {
              pendingChests.set(client.playerId, {
                gameId,
                skillLuckScale: game.skillLuckScale,
              });
              // Send show-chests after 2s (after the CORRECT! flash finishes)
              setTimeout(() => {
                ws.send(JSON.stringify({ type: "show-chests" }));
              }, 2000);
            }

            await sendLeaderboardToHost(gameId);
            broadcast(gameId, { type: "coins-updated", playerId: player.id, coins: newCoins }, ws);
            break;
          }

          case "open-chest": {
            if (client.role !== "player" || !client.playerId) break;

            const pending = pendingChests.get(client.playerId);
            if (!pending) break;

            const player = await db.query.playersTable.findFirst({
              where: and(eq(playersTable.id, client.playerId), eq(playersTable.gameId, gameId)),
            });
            if (!player) break;

            // Pick reward randomly (chest selection is cosmetic)
            const reward = pickChestReward(pending.skillLuckScale);
            pendingChests.delete(client.playerId);

            const { newCoins, coinsChange, swapInfo } = await applyChestReward(
              player,
              gameId,
              reward,
              ws,
            );

            ws.send(
              JSON.stringify({
                type: "chest-result",
                reward: { ...reward, coinsChange },
                newTotal: newCoins,
                swapInfo,
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

          case "admin-update-player": {
            if (msg.password !== ADMIN_PASSWORD) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid admin password" }));
              break;
            }
            if (msg.playerId === undefined) break;

            const updates: Partial<{
              coins: number;
              coinLabel: string | null;
              correctAnswers: number;
              totalAnswers: number;
              avatar: string;
              pinnedRank: number | null;
            }> = {};

            if (msg.coins !== undefined) updates.coins = Number(msg.coins);
            if ("coinLabel" in msg) updates.coinLabel = msg.coinLabel || null;
            if (msg.correctAnswers !== undefined) updates.correctAnswers = Number(msg.correctAnswers);
            if (msg.totalAnswers !== undefined) updates.totalAnswers = Number(msg.totalAnswers);
            if (msg.avatar !== undefined) updates.avatar = String(msg.avatar);
            if ("pinnedRank" in msg) updates.pinnedRank = msg.pinnedRank ? Number(msg.pinnedRank) : null;

            if (Object.keys(updates).length === 0) break;

            await db
              .update(playersTable)
              .set(updates)
              .where(and(eq(playersTable.id, msg.playerId), eq(playersTable.gameId, gameId)));

            // Notify the player of their own changes
            sendToPlayer(gameId, msg.playerId, {
              type: "player-updated",
              coins: updates.coins,
              coinLabel: updates.coinLabel,
              avatar: updates.avatar,
            });

            // Broadcast avatar/coins changes game-wide so everyone sees
            if (updates.coins !== undefined) {
              broadcast(gameId, { type: "coins-updated", playerId: msg.playerId, coins: updates.coins });
            }

            await sendLeaderboardToHost(gameId);
            ws.send(JSON.stringify({ type: "admin-update-done", playerId: msg.playerId }));
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
