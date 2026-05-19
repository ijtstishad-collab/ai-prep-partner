import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SubmitAnswerSchema = z.object({
  chapter_id: z.string().uuid(),
  question_id: z.string().uuid(),
  question_option_id: z.string().uuid(),
});

type DbTable = ReturnType<typeof supabaseAdmin.from>;
const table = (name: string) =>
  (supabaseAdmin.from as unknown as (tableName: string) => DbTable)(name);

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
const schemaMismatchPattern =
  /(column .* does not exist|schema cache|status|is_active|marks|is_approved)/i;
const ignorableLegacyPattern =
  /(permission denied|column .* does not exist|schema cache|is_approved)/i;

type PracticeQuestionForGrading = {
  id: string;
  chapter_id: string;
  question_text: string;
  question_type: string;
  correct_answer: string | null;
  marks?: number | string | null;
};

async function fetchApprovedQuestionForGrading(questionId: string, chapterId: string) {
  const phase2 = await table("questions")
    .select(
      "id, chapter_id, question_text, question_type, correct_answer, marks, status, is_active",
    )
    .eq("id", questionId)
    .eq("chapter_id", chapterId)
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("question_type", "mcq")
    .maybeSingle();

  if (phase2.data) {
    return {
      question: phase2.data as PracticeQuestionForGrading,
      error: null,
    };
  }

  if (phase2.error && !schemaMismatchPattern.test(phase2.error.message)) {
    return { question: null, error: phase2.error };
  }

  const legacy = await table("questions")
    .select("id, chapter_id, question_text, question_type, correct_answer")
    .eq("id", questionId)
    .eq("chapter_id", chapterId)
    .eq("is_approved", true)
    .eq("question_type", "mcq")
    .maybeSingle();

  if (legacy.error && !ignorableLegacyPattern.test(legacy.error.message)) {
    return { question: null, error: legacy.error };
  }

  return {
    question: (legacy.data as PracticeQuestionForGrading | null) ?? null,
    error: null,
  };
}

export const submitPracticeAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitAnswerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { question, error: questionError } = await fetchApprovedQuestionForGrading(
      data.question_id,
      data.chapter_id,
    );

    if (questionError) throw new Error(questionError.message);
    if (!question) throw new Error("Question is not available for practice.");

    const { data: chapter, error: chapterError } = await table("chapters")
      .select("id, subject_id")
      .eq("id", question.chapter_id)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) throw new Error("Chapter is not available for this question.");

    const { data: selectedOption, error: optionError } = await table("question_options")
      .select("id, question_id, option_key, option_text")
      .eq("id", data.question_option_id)
      .eq("question_id", data.question_id)
      .maybeSingle();

    if (optionError) throw new Error(optionError.message);
    if (!selectedOption) throw new Error("Selected option is not valid for this question.");

    const correctAnswer = normalize(question.correct_answer);
    const selectedText = normalize(selectedOption.option_text);
    const selectedKey = normalize(selectedOption.option_key);
    const isCorrect =
      correctAnswer.length > 0 &&
      (correctAnswer === selectedText ||
        correctAnswer === selectedKey ||
        correctAnswer === `${selectedKey}. ${selectedText}`);

    const maxScore = Number(question.marks ?? 1);
    const score = isCorrect ? maxScore : 0;
    const now = new Date().toISOString();

    const { data: attempt, error: attemptError } = await table("attempts")
      .insert({
        user_id: userId,
        attempt_type: "chapter_practice",
        subject_id: chapter.subject_id,
        chapter_id: question.chapter_id,
        status: "submitted",
        started_at: now,
        submitted_at: now,
        total_questions: 1,
        correct_count: isCorrect ? 1 : 0,
        score,
        max_score: maxScore,
      })
      .select("id")
      .single();

    if (attemptError) throw new Error(attemptError.message);

    const { error: answerError } = await table("student_answers").insert({
      user_id: userId,
      attempt_id: attempt.id,
      question_id: question.id,
      question_option_id: selectedOption.id,
      answer_text: selectedOption.option_text,
      is_correct: isCorrect,
      points_awarded: score,
    });

    if (answerError) throw new Error(answerError.message);

    return {
      attemptId: attempt.id as string,
      isCorrect,
      score,
      maxScore,
      selectedAnswer: selectedOption.option_text as string,
    };
  });
