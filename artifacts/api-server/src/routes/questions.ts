import { Router } from "express";
import { db } from "@workspace/db";
import { quizzesTable, questionsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { CreateQuestionBody, UpdateQuestionBody } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  next();
}

router.get("/quizzes/:quizId/questions", async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  if (isNaN(quizId)) {
    res.status(400).json({ message: "Invalid quiz ID" });
    return;
  }

  const questions = await db.query.questionsTable.findMany({
    where: eq(questionsTable.quizId, quizId),
    orderBy: (q) => q.orderIndex,
  });

  res.json(questions);
});

router.post("/quizzes/:quizId/questions", requireAuth, async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const userId = req.session.userId!;

  const quiz = await db.query.quizzesTable.findFirst({
    where: and(eq(quizzesTable.id, quizId), eq(quizzesTable.createdById, userId)),
  });

  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
    return;
  }

  const [{ count: existing }] = await db
    .select({ count: count() })
    .from(questionsTable)
    .where(eq(questionsTable.quizId, quizId));

  const [question] = await db
    .insert(questionsTable)
    .values({
      quizId,
      text: parsed.data.text,
      options: parsed.data.options,
      correctAnswer: parsed.data.correctAnswer,
      explanation: parsed.data.explanation ?? undefined,
      timeLimit: parsed.data.timeLimit ?? 30,
      points: parsed.data.points ?? 100,
      aiGenerated: parsed.data.aiGenerated ?? false,
      orderIndex: Number(existing),
    })
    .returning();

  await db
    .update(quizzesTable)
    .set({ updatedAt: new Date() })
    .where(eq(quizzesTable.id, quizId));

  res.status(201).json(question);
});

router.put("/quizzes/:quizId/questions/:questionId", requireAuth, async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const questionId = parseInt(req.params.questionId);
  const userId = req.session.userId!;

  const quiz = await db.query.quizzesTable.findFirst({
    where: and(eq(quizzesTable.id, quizId), eq(quizzesTable.createdById, userId)),
  });
  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  const question = await db.query.questionsTable.findFirst({
    where: and(eq(questionsTable.id, questionId), eq(questionsTable.quizId, quizId)),
  });
  if (!question) {
    res.status(404).json({ message: "Question not found" });
    return;
  }

  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const [updated] = await db
    .update(questionsTable)
    .set(parsed.data)
    .where(eq(questionsTable.id, questionId))
    .returning();

  res.json(updated);
});

router.delete("/quizzes/:quizId/questions/:questionId", requireAuth, async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const questionId = parseInt(req.params.questionId);
  const userId = req.session.userId!;

  const quiz = await db.query.quizzesTable.findFirst({
    where: and(eq(quizzesTable.id, quizId), eq(quizzesTable.createdById, userId)),
  });
  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return;
  }

  await db.delete(questionsTable).where(
    and(eq(questionsTable.id, questionId), eq(questionsTable.quizId, quizId)),
  );

  res.json({ message: "Question deleted" });
});

export default router;
