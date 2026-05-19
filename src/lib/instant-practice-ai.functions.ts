import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GenerateInstantPracticeSchema = z.object({
  chapter_id: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
});

type DbTable = ReturnType<typeof supabaseAdmin.from>;
type GeneratedMcq = {
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation_bn?: string | null;
};

const table = (name: string) =>
  (supabaseAdmin.from as unknown as (tableName: string) => DbTable)(name);

const schemaMismatchPattern = /(column .* does not exist|schema cache)/i;
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

async function getHscExamTypeId() {
  const { data, error } = await table("exam_types").select("id").eq("code", "HSC").maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

async function createReviewDraft({
  chapter,
  question,
  userId,
  difficulty,
}: {
  chapter: Record<string, unknown>;
  question: GeneratedMcq;
  userId: string;
  difficulty: "easy" | "medium" | "hard";
}) {
  const examTypeId = (chapter.exam_type_id as string | null) ?? (await getHscExamTypeId());
  if (!examTypeId) return;

  const options = question.options.map((option, index) => ({
    key: String.fromCharCode(65 + index),
    text: option,
    isCorrect: option === question.correct_answer,
  }));

  const { error } = await table("question_drafts").insert({
    exam_type_id: examTypeId,
    class_id: chapter.class_id ?? null,
    group_id: chapter.group_id ?? null,
    subject_id: chapter.subject_id,
    chapter_id: chapter.id,
    question_type: "mcq",
    difficulty,
    question_text: question.question_text,
    options,
    correct_answer: question.correct_answer,
    explanation: question.explanation_bn ?? null,
    source: "ai_instant_student",
    status: "pending_review",
    created_by: userId,
    submitted_by: userId,
    submitted_at: new Date().toISOString(),
  });

  if (error && !schemaMismatchPattern.test(error.message)) {
    throw new Error(error.message);
  }
}

export const generateInstantPracticeQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInstantPracticeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: chapter, error: chapterError } = await table("chapters")
      .select(
        "id, name, name_bn, subject_id, exam_type_id, class_id, group_id, subjects(name, name_bn)",
      )
      .eq("id", data.chapter_id)
      .eq("is_active", true)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) throw new Error("Chapter not found.");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: quotaError } = await table("questions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", context.userId)
      .eq("source", "ai_instant_student")
      .gte("created_at", since);

    if (quotaError && !schemaMismatchPattern.test(quotaError.message)) {
      throw new Error(quotaError.message);
    }
    if ((count ?? 0) >= MAX_AI_QUESTIONS_PER_HOUR) {
      throw new Error("AI generation limit reached. Try again in about an hour.");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI service is not configured. Add LOVABLE_API_KEY before generating.");
    }

    const subjectName = (chapter.subjects as { name?: string; name_bn?: string } | null)?.name;
    const subjectNameBn = (chapter.subjects as { name?: string; name_bn?: string } | null)?.name_bn;

    const systemPrompt =
      "You write original HSC exam-preparation MCQs for Bangladeshi students. Do not copy past board questions. Keep questions factual, syllabus-friendly, and suitable for practice. Return strict JSON only.";
    const userPrompt = `Generate ${data.count} original ${data.difficulty} MCQ questions for:
Subject: ${subjectName ?? "HSC subject"}${subjectNameBn ? ` (${subjectNameBn})` : ""}
Chapter: ${chapter.name}${chapter.name_bn ? ` (${chapter.name_bn})` : ""}

Rules:
- Each question must have 4 short options.
- correct_answer must exactly match one option.
- Do not include answer labels inside option text.
- Do not mention that the question is AI-generated.
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
        model: "google/gemini-3-flash-preview",
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

    const insertedQuestions = [];
    const insertedOptions = [];
    const now = new Date().toISOString();

    for (const question of generated) {
      await createReviewDraft({
        chapter: chapter as Record<string, unknown>,
        question,
        userId: context.userId,
        difficulty: data.difficulty,
      });

      const optionTexts = question.options;
      let questionPayload: Record<string, unknown> = {
        exam_type_id: chapter.exam_type_id ?? null,
        class_id: chapter.class_id ?? null,
        group_id: chapter.group_id ?? null,
        subject_id: chapter.subject_id,
        chapter_id: chapter.id,
        question_type: "mcq",
        difficulty: data.difficulty,
        question_text: question.question_text,
        options: optionTexts,
        correct_answer: question.correct_answer,
        explanation_bn: question.explanation_bn ?? null,
        is_approved: true,
        teacher_reviewed: false,
        source: "ai_instant_student",
        created_by: context.userId,
        marks: 1,
        status: "approved",
        is_active: true,
        approved_at: now,
        updated_at: now,
      };

      let { data: insertedQuestion, error: insertError } = await table("questions")
        .insert(questionPayload)
        .select("id, chapter_id, question_type, difficulty, question_text, marks")
        .single();

      if (insertError && schemaMismatchPattern.test(insertError.message)) {
        questionPayload = {
          chapter_id: chapter.id,
          question_type: "mcq",
          difficulty: data.difficulty,
          question_text: question.question_text,
          options: optionTexts,
          correct_answer: question.correct_answer,
          explanation_bn: question.explanation_bn ?? null,
          is_approved: true,
          teacher_reviewed: false,
          source: "ai_instant_student",
          created_by: context.userId,
        };

        const fallback = await table("questions")
          .insert(questionPayload)
          .select("id, chapter_id, question_type, difficulty, question_text")
          .single();
        insertedQuestion = fallback.data;
        insertError = fallback.error;
      }

      if (insertError) throw new Error(insertError.message);
      if (!insertedQuestion) throw new Error("AI question could not be saved.");

      const insertedRecord = insertedQuestion as Record<string, unknown>;
      const questionRow = {
        id: String(insertedRecord.id ?? ""),
        chapter_id: String(insertedRecord.chapter_id ?? chapter.id),
        question_type: String(insertedRecord.question_type ?? "mcq"),
        difficulty: String(insertedRecord.difficulty ?? data.difficulty),
        question_text: String(insertedRecord.question_text ?? question.question_text),
        marks: Number(insertedRecord.marks ?? 1),
      };
      insertedQuestions.push(questionRow);

      const optionRows = optionTexts.map((option, index) => ({
        question_id: questionRow.id,
        option_key: String.fromCharCode(65 + index),
        option_text: option,
        display_order: index + 1,
      }));

      const { data: options, error: optionsError } = await table("question_options")
        .insert(optionRows)
        .select("id, question_id, option_key, option_text, display_order");

      if (optionsError) throw new Error(optionsError.message);
      const optionsList = (options as Array<Record<string, unknown>> | null) ?? [];
      for (const opt of optionsList) {
        insertedOptions.push({
          id: String(opt.id ?? ""),
          question_id: String(opt.question_id ?? ""),
          option_key: String(opt.option_key ?? ""),
          option_text: String(opt.option_text ?? ""),
          display_order: Number(opt.display_order ?? 0),
        });
      }
    }

    return {
      questions: insertedQuestions,
      options: insertedOptions,
    };
  });
