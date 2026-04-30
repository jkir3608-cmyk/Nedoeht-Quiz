import { Router } from "express";
import { db } from "@workspace/db";
import { quizzesTable, questionsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { CreateQuizBody, UpdateQuizBody } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  next();
}

async function getQuizWithCount(quizId: number) {
  const quiz = await db.query.quizzesTable.findFirst({
    where: eq(quizzesTable.id, quizId),
  });
  if (!quiz) return null;

  const [{ count: qCount }] = await db
    .select({ count: count() })
    .from(questionsTable)
    .where(eq(questionsTable.quizId, quizId));

  return { ...quiz, questionCount: Number(qCount) };
}

router.get("/quizzes", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const quizzes = await db.query.quizzesTable.findMany({
    where: eq(quizzesTable.createdById, userId),
  });

  const withCounts = await Promise.all(
    quizzes.map(async (q) => {
      const [{ count: qCount }] = await db
        .select({ count: count() })
        .from(questionsTable)
        .where(eq(questionsTable.quizId, q.id));
      return { ...q, questionCount: Number(qCount) };
    }),
  );

  res.json(withCounts);
});

router.get("/quizzes/public", async (_req, res) => {
  const quizzes = await db.query.quizzesTable.findMany({
    where: eq(quizzesTable.isPublic, true),
    limit: 50,
  });

  const withCounts = await Promise.all(
    quizzes.map(async (q) => {
      const [{ count: qCount }] = await db
        .select({ count: count() })
        .from(questionsTable)
        .where(eq(questionsTable.quizId, q.id));
      return { ...q, questionCount: Number(qCount) };
    }),
  );

  res.json(withCounts);
});

router.post("/quizzes", requireAuth, async (req, res) => {
  const parsed = CreateQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const userId = req.session.userId!;
  const { title, description, coverColor, isPublic } = parsed.data;

  const [quiz] = await db
    .insert(quizzesTable)
    .values({
      title,
      description: description ?? undefined,
      coverColor: coverColor ?? "#7C3AED",
      isPublic: isPublic ?? false,
      createdById: userId,
    })
    .returning();

  res.status(201).json({ ...quiz, questionCount: 0 });
});

router.get("/quizzes/:quizId", async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  if (isNaN(quizId)) {
    res.status(400).json({ message: "Invalid quiz ID" });
    return;
  }

  const quiz = await getQuizWithCount(quizId);
  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  const questions = await db.query.questionsTable.findMany({
    where: eq(questionsTable.quizId, quizId),
    orderBy: (q) => q.orderIndex,
  });

  res.json({ ...quiz, questions });
});

router.put("/quizzes/:quizId", requireAuth, async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const userId = req.session.userId!;

  const quiz = await db.query.quizzesTable.findFirst({
    where: and(eq(quizzesTable.id, quizId), eq(quizzesTable.createdById, userId)),
  });

  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  const parsed = UpdateQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const [updated] = await db
    .update(quizzesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(quizzesTable.id, quizId))
    .returning();

  const [{ count: qCount }] = await db
    .select({ count: count() })
    .from(questionsTable)
    .where(eq(questionsTable.quizId, quizId));

  res.json({ ...updated, questionCount: Number(qCount) });
});

router.delete("/quizzes/:quizId", requireAuth, async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const userId = req.session.userId!;

  const quiz = await db.query.quizzesTable.findFirst({
    where: and(eq(quizzesTable.id, quizId), eq(quizzesTable.createdById, userId)),
  });

  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  await db.delete(quizzesTable).where(eq(quizzesTable.id, quizId));
  res.json({ message: "Quiz deleted" });
});

export default router;
