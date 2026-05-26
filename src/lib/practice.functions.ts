import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SubmitAnswerSchema = z.object({
  chapter_id: z.string().uuid(),
  question_id: z.string().uuid(),
  selected_answer: z.string().min(1).max(2000),
});

const normalize = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

export const submitPracticeAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitAnswerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("id, chapter_id, correct_answer, question_type, is_approved, options, explanation_bn")
      .eq("id", data.question_id)
      .eq("chapter_id", data.chapter_id)
      .maybeSingle();

    if (questionError) throw new Error(questionError.message);
    if (!question || !question.is_approved) {
      throw new Error("Question is not available for practice.");
    }

    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("id, subject_id")
      .eq("id", question.chapter_id)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) throw new Error("Chapter is not available for this question.");

    // Accept either an option key (e.g. "A") or the full option text.
    const correct = normalize(question.correct_answer);
    const selected = normalize(data.selected_answer);
    let isCorrect = correct === selected;
    let correctText: string | null = null;
    if (question.options && typeof question.options === "object") {
      const opts = question.options as Record<string, unknown>;
      const keyVal = opts[question.correct_answer ?? ""];
      if (typeof keyVal === "string") correctText = keyVal;
      if (!isCorrect && correctText && normalize(correctText) === selected) isCorrect = true;
      if (!isCorrect) {
        const selectedVal = opts[data.selected_answer];
        if (typeof selectedVal === "string" && normalize(selectedVal) === correct) isCorrect = true;
      }
    }

    const maxScore = 1;
    const score = isCorrect ? 1 : 0;
    const now = new Date().toISOString();

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("test_attempts")
      .insert({
        user_id: userId,
        subject_id: chapter.subject_id,
        chapter_id: question.chapter_id,
        started_at: now,
        completed_at: now,
        total_questions: 1,
        correct_count: isCorrect ? 1 : 0,
        score,
      })
      .select("id")
      .single();

    if (attemptError) throw new Error(attemptError.message);

    const { error: answerError } = await supabaseAdmin
      .from("user_answers")
      .insert({
        user_id: userId,
        attempt_id: attempt.id,
        question_id: question.id,
        user_answer: data.selected_answer,
        is_correct: isCorrect,
      });

    if (answerError) throw new Error(answerError.message);

    return {
      attemptId: attempt.id as string,
      isCorrect,
      score,
      maxScore,
      selectedAnswer: data.selected_answer,
      correctAnswer: (question.correct_answer as string | null) ?? null,
      correctText,
      explanation: (question.explanation_bn as string | null) ?? null,
    };
  });
