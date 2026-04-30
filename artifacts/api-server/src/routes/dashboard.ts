import { Router } from "express";
import { db } from "@workspace/db";
import { gamesTable, quizzesTable, questionsTable, playersTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  next();
}

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const [{ quizCount }] = await db
    .select({ quizCount: count() })
    .from(quizzesTable)
    .where(eq(quizzesTable.createdById, userId));

  const userQuizIds = await db
    .select({ id: quizzesTable.id })
    .from(quizzesTable)
    .where(eq(quizzesTable.createdById, userId));

  const quizIdList = userQuizIds.map((q) => q.id);

  let totalQuestions = 0;
  if (quizIdList.length > 0) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(questionsTable)
      .where(sql`${questionsTable.quizId} = ANY(${sql.raw(`ARRAY[${quizIdList.join(",")}]`)})`);
    totalQuestions = Number(total);
  }

  const [{ gameCount }] = await db
    .select({ gameCount: count() })
    .from(gamesTable)
    .where(eq(gamesTable.hostId, userId));

  let totalPlayers = 0;
  const userGames = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(eq(gamesTable.hostId, userId));

  if (userGames.length > 0) {
    const gameIdList = userGames.map((g) => g.id);
    const [{ players }] = await db
      .select({ players: count() })
      .from(playersTable)
      .where(sql`${playersTable.gameId} = ANY(${sql.raw(`ARRAY[${gameIdList.join(",")}]`)})`);
    totalPlayers = Number(players);
  }

  res.json({
    totalQuizzes: Number(quizCount),
    totalGamesHosted: Number(gameCount),
    totalQuestions,
    totalPlayersHosted: totalPlayers,
  });
});

router.get("/dashboard/recent-games", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const games = await db.query.gamesTable.findMany({
    where: eq(gamesTable.hostId, userId),
    orderBy: (g) => [g.createdAt],
    limit: 10,
  });

  const result = await Promise.all(
    games.reverse().map(async (g) => {
      const quiz = await db.query.quizzesTable.findFirst({
        where: eq(quizzesTable.id, g.quizId),
      });

      const [{ playerCount }] = await db
        .select({ playerCount: count() })
        .from(playersTable)
        .where(eq(playersTable.gameId, g.id));

      return {
        id: g.id,
        quizTitle: quiz?.title ?? "Unknown Quiz",
        playerCount: Number(playerCount),
        status: g.status,
        skillLuckScale: g.skillLuckScale,
        createdAt: g.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

export default router;
