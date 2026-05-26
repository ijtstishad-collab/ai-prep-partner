import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GenerateInstantPracticeSchema = z.object({
  chapter_id: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
});

type Difficulty = "easy" | "medium" | "hard";

type GeneratedMcq = {
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation_bn: string | null;
};

export type InsertedQuestion = {
  id: string;
  chapter_id: string;
  question_type: "mcq";
  difficulty: Difficulty;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
};

export type InsertedOption = {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  display_order: number;
};

const MAX_AI_QUESTIONS_PER_HOUR = 25;

function parseAiJson(content: string): GeneratedMcq[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const rows = Array.isArray((parsed as { questions?: unknown }).questions)
    ? ((parsed as { questions: unknown[] }).questions as unknown[])
    : [];

  return rows
    .map((row) => {
      const value = row as Partial<GeneratedMcq>;
      const options = Array.isArray(value.options)
        ? value.options.map((option) => String(option).trim()).filter(Boolean)
        : [];
      return {
        question_text: String(value.question_text ?? "").trim(),
        options,
        correct_answer: String(value.correct_answer ?? "").trim(),
        explanation_bn: value.explanation_bn ? String(value.explanation_bn).trim() : null,
      };
    })
    .filter(
      (row) =>
        row.question_text.length >= 8 &&
        row.options.length >= 2 &&
        row.options.includes(row.correct_answer),
    );
}

export const generateInstantPracticeQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInstantPracticeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("id, name, name_bn, subject_id, subjects(name, name_bn)")
      .eq("id", data.chapter_id)
      .eq("is_active", true)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) throw new Error("Chapter not found.");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: quotaError } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", context.userId)
      .eq("source", "ai_instant_student")
      .gte("created_at", since);

    if (quotaError) throw new Error(quotaError.message);
    if ((count ?? 0) >= MAX_AI_QUESTIONS_PER_HOUR) {
      throw new Error("AI generation limit reached. Try again in about an hour.");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI service is not configured. Add LOVABLE_API_KEY before generating.");
    }

    const subjectName = (chapter.subjects as { name?: string; name_bn?: string } | null)?.name;
    const subjectNameBn = (chapter.subjects as { name?: string; name_bn?: string } | null)
      ?.name_bn;

    const systemPrompt =
      "You write original HSC exam-preparation MCQs for Bangladeshi students. Do not copy past board questions. Keep questions factual, syllabus-friendly, and suitable for practice. Return strict JSON only.";
    const userPrompt = `Generate ${data.count} original ${data.difficulty} MCQ questions for:
Subject: ${subjectName ?? "HSC subject"}${subjectNameBn ? ` (${subjectNameBn})` : ""}
Chapter: ${chapter.name}${chapter.name_bn ? ` (${chapter.name_bn})` : ""}

Rules:
- Each question must have 4 short options.
- correct_answer must exactly match one option.
- Do not include answer labels inside option text.
- Provide a short Bangla explanation in explanation_bn.

Return JSON exactly like:
{"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_answer":"...","explanation_bn":"..."}]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (response.status === 402) throw new Error("AI credits exhausted in Lovable.");
      throw new Error(`AI generation failed: ${text.slice(0, 200)}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const generated = parseAiJson(content).slice(0, data.count);
    if (generated.length === 0) {
      throw new Error("AI did not return usable MCQs. Try again.");
    }

    const insertedQuestions: InsertedQuestion[] = [];
    const insertedOptions: InsertedOption[] = [];

    for (const question of generated) {
      const optionsObj: Record<string, string> = {};
      question.options.forEach((opt, i) => {
        optionsObj[String.fromCharCode(65 + i)] = opt;
      });
      const correctKey =
        Object.entries(optionsObj).find(([, v]) => v === question.correct_answer)?.[0] ??
        question.correct_answer;

      const { data: insertedQuestion, error: insertError } = await supabaseAdmin
        .from("questions")
        .insert({
          chapter_id: chapter.id,
          question_type: "mcq",
          difficulty: data.difficulty,
          question_text: question.question_text,
          options: optionsObj,
          correct_answer: correctKey,
          explanation_bn: question.explanation_bn ?? null,
          is_approved: true,
          teacher_reviewed: false,
          source: "ai_instant_student",
          created_by: context.userId,
        })
        .select("id, chapter_id, question_type, difficulty, question_text")
        .single();

      if (insertError) throw new Error(insertError.message);
      if (!insertedQuestion) throw new Error("AI question could not be saved.");

      insertedQuestions.push({
        id: insertedQuestion.id as string,
        chapter_id: insertedQuestion.chapter_id as string,
        question_type: "mcq",
        difficulty: data.difficulty,
        question_text: insertedQuestion.question_text as string,
      });

      question.options.forEach((opt, i) => {
        const key = String.fromCharCode(65 + i);
        insertedOptions.push({
          id: `${insertedQuestion.id}-${key}`,
          question_id: insertedQuestion.id as string,
          option_key: key,
          option_text: opt,
          display_order: i + 1,
        });
      });
    }

    return { questions: insertedQuestions, options: insertedOptions };
  });
