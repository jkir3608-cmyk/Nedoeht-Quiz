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

  const prompt = `You are an expert quiz creator. Generate exactly ${count} multiple-choice quiz questions based on the following material.${existingStr}

Material:
${material}

Requirements:
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one answer is correct
- Provide a clear, educational explanation for why the correct answer is right
- Questions should be varied (facts, concepts, applications)
- Make questions clear and unambiguous

Respond ONLY with a valid JSON array. No extra text. Format:
[
  {
    "text": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why Option A is correct..."
  }
]
The correctAnswer field is the 0-based index of the correct option.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 4096,
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

  const prompt = `You are an educational assistant. A student just answered a quiz question.

Question: ${questionText}
Options:
${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}
Correct answer: ${String.fromCharCode(65 + correctAnswer)}. ${correctOption}

Write a short, clear explanation (2-3 sentences) of why "${correctOption}" is the correct answer. Be educational and encouraging. Write as if speaking directly to a student.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 256,
  });

  const explanation =
    completion.choices[0]?.message?.content?.trim() ??
    "The selected answer is correct based on the material covered.";

  res.json({ explanation });
});

export default router;
