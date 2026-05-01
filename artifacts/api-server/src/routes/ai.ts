import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { AiGenerateQuestionsBody, AiGenerateExplanationBody } from "@workspace/api-zod";

const router = Router();

router.post("/ai/generate-questions", async (req, res) => {
  const parsed = AiGenerateQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { material, count = 5, existingQuestions = [] } = parsed.data;

  const existingStr =
    existingQuestions.length > 0
      ? `\n\nAlready existing questions (do NOT duplicate these):\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

  const prompt = `You are an expert educator and quiz designer. Your task is to generate exactly ${count} high-quality multiple-choice quiz questions based on the provided material.${existingStr}

SOURCE MATERIAL:
${material}

STRICT REQUIREMENTS:
- Generate EXACTLY ${count} questions — no more, no less
- Each question must have EXACTLY 4 answer options
- Only ONE answer is correct
- Questions must cover different aspects: facts, concepts, cause & effect, application, and analysis
- Wrong answers (distractors) must be plausible but clearly incorrect upon reflection
- Explanations must be educational, specific, and 2-4 sentences long
- Questions should be in the same language as the source material
- Do not make questions trivially easy (avoid questions answered directly by a single obvious sentence)

RESPOND ONLY with a JSON object containing a "questions" array. Example format:
{
  "questions": [
    {
      "text": "What is the primary reason for X?",
      "options": ["Because A", "Because B", "Because C", "Because D"],
      "correctAnswer": 2,
      "explanation": "C is correct because... This matters because..."
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: "You are a professional quiz designer. Always respond with valid JSON only." },
      { role: "user", content: prompt }
    ],
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";

  let questions: any[] = [];
  try {
    const parsed2 = JSON.parse(content);
    if (Array.isArray(parsed2)) {
      questions = parsed2;
    } else if (parsed2.questions && Array.isArray(parsed2.questions)) {
      questions = parsed2.questions;
    } else {
      const firstArray = Object.values(parsed2).find(Array.isArray);
      if (firstArray) questions = firstArray as any[];
    }
  } catch {
    res.status(500).json({ message: "Failed to parse AI response" });
    return;
  }

  const validated = questions
    .filter(
      (q: any) =>
        q.text &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correctAnswer === "number",
    )
    .slice(0, count);

  res.json(validated);
});

router.post("/ai/generate-explanation", async (req, res) => {
  const parsed = AiGenerateExplanationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { questionText, options, correctAnswer } = parsed.data;

  const correctOption = options[correctAnswer];

  const prompt = `A student just answered this quiz question and you need to write a clear explanation.

Question: ${questionText}

Answer options:
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}

The correct answer is: ${String.fromCharCode(65 + correctAnswer)}. ${correctOption}

Write a 2-3 sentence educational explanation that:
1. Clearly states WHY "${correctOption}" is the correct answer
2. Briefly explains what makes the other options wrong or why this concept matters
3. Uses language appropriate for a student

Be direct and informative. Do not start with "That's correct!" or similar phrases. Just explain the concept.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: "You are a concise educational tutor. Write clear, accurate explanations in 2-3 sentences." },
      { role: "user", content: prompt }
    ],
    max_completion_tokens: 512,
  });

  const explanation =
    completion.choices[0]?.message?.content?.trim() ??
    "The selected answer is correct based on the material covered.";

  res.json({ explanation });
});

export default router;
