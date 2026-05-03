import { Router } from "express";
import { db } from "@workspace/db";
import { gamesTable, quizzesTable, playersTable, questionsTable, usersTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { CreateGameBody, JoinGameBody } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  next();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const AVATAR_COLORS = [
  "#EF4444", "#3B82F6", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

async function formatGame(game: any) {
  const quiz = await db.query.quizzesTable.findFirst({
    where: eq(quizzesTable.id, game.quizId),
  });

  const [{ count: playerCount }] = await db
    .select({ count: count() })
    .from(playersTable)
    .where(and(eq(playersTable.gameId, game.id), eq(playersTable.isKicked, false)));

  return {
    id: game.id,
    quizId: game.quizId,
    hostId: game.hostId,
    code: game.code,
    status: game.status,
    skillLuckScale: game.skillLuckScale,
    minExplanationTime: game.minExplanationTime,
    playerCount: Number(playerCount),
    quizTitle: quiz?.title ?? "Unknown Quiz",
    createdAt: game.createdAt.toISOString(),
  };
}

router.post("/games", requireAuth, async (req, res) => {
  const parsed = CreateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const userId = req.session.userId!;
  const { quizId, skillLuckScale = 3, minExplanationTime = 7 } = parsed.data;

  const quiz = await db.query.quizzesTable.findFirst({
    where: eq(quizzesTable.id, quizId),
  });
  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.query.gamesTable.findFirst({
      where: eq(gamesTable.code, code),
    });
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  const [game] = await db
    .insert(gamesTable)
    .values({
      quizId,
      hostId: userId,
      code,
      skillLuckScale,
      minExplanationTime,
      status: "waiting",
    })
    .returning();

  await db
    .update(usersTable)
    .set({ gameCount: (await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) }))!.gameCount + 1 })
    .where(eq(usersTable.id, userId));

  await db
    .update(quizzesTable)
    .set({ playCount: quiz.playCount + 1 })
    .where(eq(quizzesTable.id, quizId));

  res.status(201).json(await formatGame(game));
});

router.get("/games/code/:code", async (req, res) => {
  const { code } = req.params;

  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.code, code),
  });

  if (!game) {
    res.status(404).json({ message: "Game not found" });
    return;
  }

  res.json(await formatGame(game));
});

router.get("/games/:gameId", async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  if (isNaN(gameId)) {
    res.status(400).json({ message: "Invalid game ID" });
    return;
  }

  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, gameId),
  });

  if (!game) {
    res.status(404).json({ message: "Game not found" });
    return;
  }

  const players = await db.query.playersTable.findMany({
    where: and(eq(playersTable.gameId, gameId), eq(playersTable.isKicked, false)),
  });

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.quizId, game.quizId))
    .orderBy(questionsTable.orderIndex);

  const quiz = await db.query.quizzesTable.findFirst({
    where: eq(quizzesTable.id, game.quizId),
  });

  const formattedGame = await formatGame(game);

  res.json({
    ...formattedGame,
    players: players.map((p) => ({
      ...p,
      joinedAt: p.joinedAt.toISOString(),
    })),
    quiz: quiz
      ? {
          ...quiz,
          questionCount: questions.length,
          questions: questions,
          createdAt: quiz.createdAt.toISOString(),
          updatedAt: quiz.updatedAt.toISOString(),
        }
      : null,
  });
});

router.post("/games/:gameId/join", async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  if (isNaN(gameId)) {
    res.status(400).json({ message: "Invalid game ID" });
    return;
  }

  const parsed = JoinGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const game = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.id, gameId),
  });

  if (!game) {
    res.status(404).json({ message: "Game not found" });
    return;
  }

  if (game.status !== "waiting") {
    res.status(400).json({ message: "Game already started" });
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({
      gameId,
      nickname: parsed.data.nickname,
      avatarColor: randomAvatarColor(),
      avatar: parsed.data.avatar ?? "🐱",
    })
    .returning();

  res.json({
    ...player,
    joinedAt: player.joinedAt.toISOString(),
  });
});

router.post("/games/:gameId/start", requireAuth, async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const userId = req.session.userId!;

  const game = await db.query.gamesTable.findFirst({
    where: and(eq(gamesTable.id, gameId), eq(gamesTable.hostId, userId)),
  });

  if (!game) {
    res.status(404).json({ message: "Game not found or not authorized" });
    return;
  }

  const [updated] = await db
    .update(gamesTable)
    .set({ status: "playing" })
    .where(eq(gamesTable.id, gameId))
    .returning();

  res.json(await formatGame(updated));
});

router.post("/games/:gameId/end", requireAuth, async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const userId = req.session.userId!;

  const game = await db.query.gamesTable.findFirst({
    where: and(eq(gamesTable.id, gameId), eq(gamesTable.hostId, userId)),
  });

  if (!game) {
    res.status(404).json({ message: "Game not found or not authorized" });
    return;
  }

  const [updated] = await db
    .update(gamesTable)
    .set({ status: "ended" })
    .where(eq(gamesTable.id, gameId))
    .returning();

  res.json(await formatGame(updated));
});

export default router;
