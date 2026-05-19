import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type DbTable = ReturnType<typeof supabaseAdmin.from>;
type ReviewerRole = "admin" | "reviewer";

export type AdminSubject = {
  id: string;
  name: string;
  slug: string;
  sort_order?: number | null;
};

export type AdminChapter = {
  id: string;
  subject_id: string;
  name: string;
  order_index: number | null;
};

export type DraftOption = {
  key: string;
  text: string;
  isCorrect?: boolean;
};

export type QuestionDraft = {
  id: string;
  question_id: string | null;
  subject_id: string;
  chapter_id: string;
  question_type: "mcq" | "short" | "written";
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  options: DraftOption[];
  correct_answer: string;
  explanation: string | null;
  source: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type AdminReviewNote = {
  id: string;
  draft_id: string | null;
  action: string;
  notes: string | null;
  created_at: string;
};

const table = (name: string) =>
  (supabaseAdmin.from as unknown as (tableName: string) => DbTable)(name);

const DraftOptionSchema = z.object({
  key: z.string().trim().min(1).max(3),
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean().optional(),
});

const CreateManualMcqDraftSchema = z.object({
  subject_id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question_text: z.string().trim().min(8).max(2000),
  explanation: z.string().trim().max(2000).optional(),
  options: z.array(DraftOptionSchema).min(2).max(6),
});

const ReviewDraftSchema = z.object({
  draft_id: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});

const sortSubjects = (items: AdminSubject[]) =>
  [...items].sort((a, b) => {
    const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });

const sortChapters = (items: AdminChapter[]) =>
  [...items].sort((a, b) => {
    if (a.subject_id !== b.subject_id) return a.subject_id.localeCompare(b.subject_id);
    const aOrder = typeof a.order_index === "number" ? a.order_index : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order_index === "number" ? b.order_index : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });

async function requireReviewer(userId: string): Promise<ReviewerRole> {
  const [{ data: appRoles, error: appRoleError }, { data: legacyRoles, error: legacyRoleError }] =
    await Promise.all([
      table("app_roles").select("role").eq("user_id", userId),
      table("user_roles").select("role").eq("user_id", userId),
    ]);

  if (appRoleError) throw new Error(appRoleError.message);
  if (legacyRoleError) throw new Error(legacyRoleError.message);

  const roles = new Set([
    ...((appRoles as { role: string }[] | null) ?? []).map((row) => row.role),
    ...((legacyRoles as { role: string }[] | null) ?? []).map((row) => row.role),
  ]);

  if (roles.has("admin")) return "admin";
  if (roles.has("reviewer")) return "reviewer";
  throw new Error("Admin or reviewer access required.");
}

async function getHscExamTypeId() {
  const { data, error } = await table("exam_types").select("id").eq("code", "HSC").maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("HSC exam type is missing.");
  return data.id as string;
}

async function loadSubjects() {
  let { data, error } = (await table("subjects")
    .select("id, name, slug, sort_order")
    .eq("is_active", true)) as { data: AdminSubject[] | null; error: Error | null };

  if (error && /sort_order|t_order/i.test(error.message)) {
    const fallback = (await table("subjects").select("id, name, slug").eq("is_active", true)) as {
      data: AdminSubject[] | null;
      error: Error | null;
    };
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return sortSubjects(data ?? []);
}

async function loadChapters() {
  const { data, error } = (await table("chapters")
    .select("id, subject_id, name, order_index")
    .eq("is_active", true)) as { data: AdminChapter[] | null; error: Error | null };

  if (error) throw new Error(error.message);
  return sortChapters(data ?? []);
}

function normalizeDraftOptions(value: unknown): DraftOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((option, index) => {
      if (typeof option === "string") {
        return { key: String.fromCharCode(65 + index), text: option };
      }
      if (option && typeof option === "object") {
        const row = option as Record<string, unknown>;
        return {
          key: String(row.key ?? row.option_key ?? String.fromCharCode(65 + index)),
          text: String(row.text ?? row.option_text ?? ""),
          isCorrect: Boolean(row.isCorrect ?? row.is_correct ?? false),
        };
      }
      return null;
    })
    .filter((option): option is DraftOption => !!option && option.text.length > 0);
}

async function insertAdminReview({
  draftId,
  questionId,
  reviewerId,
  action,
  beforeStatus,
  afterStatus,
  notes,
}: {
  draftId: string;
  questionId?: string | null;
  reviewerId: string;
  action: "create" | "approve" | "reject";
  beforeStatus?: string | null;
  afterStatus: string;
  notes?: string | null;
}) {
  const { error } = await table("admin_reviews").insert({
    draft_id: draftId,
    question_id: questionId ?? null,
    reviewer_id: reviewerId,
    action,
    before_status: beforeStatus ?? null,
    after_status: afterStatus,
    notes: notes || null,
  });

  if (error) throw new Error(error.message);
}

export const loadQuestionReviewData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireReviewer(context.userId);

    const [subjects, chapters, draftsResult, reviewsResult] = await Promise.all([
      loadSubjects(),
      loadChapters(),
      table("question_drafts")
        .select(
          "id, question_id, subject_id, chapter_id, question_type, difficulty, question_text, options, correct_answer, explanation, source, status, created_at, updated_at, reviewed_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      table("admin_reviews")
        .select("id, draft_id, action, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const { data: draftRows, error: draftError } = draftsResult;
    if (draftError) throw new Error(draftError.message);

    const { data: reviewRows, error: reviewError } = reviewsResult;
    if (reviewError) throw new Error(reviewError.message);

    const drafts = (((draftRows as Record<string, unknown>[] | null) ?? []).map((draft) => ({
      ...draft,
      options: normalizeDraftOptions(draft.options),
    })) ?? []) as QuestionDraft[];

    return {
      subjects,
      chapters,
      drafts,
      reviews: ((reviewRows as AdminReviewNote[] | null) ?? []) satisfies AdminReviewNote[],
    };
  });

export const createManualMcqDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateManualMcqDraftSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireReviewer(context.userId);

    const correctOptions = data.options.filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
      throw new Error("Select exactly one correct answer.");
    }

    const { data: chapter, error: chapterError } = await table("chapters")
      .select("id, subject_id, exam_type_id, class_id, group_id")
      .eq("id", data.chapter_id)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) throw new Error("Chapter not found.");
    if (chapter.subject_id !== data.subject_id) {
      throw new Error("Selected chapter does not belong to the selected subject.");
    }

    const examTypeId = (chapter.exam_type_id as string | null) ?? (await getHscExamTypeId());
    const options = data.options.map((option, index) => ({
      key: option.key || String.fromCharCode(65 + index),
      text: option.text,
      isCorrect: !!option.isCorrect,
    }));
    const correctOption = options.find((option) => option.isCorrect);

    const { data: draft, error: draftError } = await table("question_drafts")
      .insert({
        exam_type_id: examTypeId,
        class_id: chapter.class_id ?? null,
        group_id: chapter.group_id ?? null,
        subject_id: data.subject_id,
        chapter_id: data.chapter_id,
        question_type: "mcq",
        difficulty: data.difficulty,
        question_text: data.question_text,
        options,
        correct_answer: correctOption?.text ?? "",
        explanation: data.explanation || null,
        source: "manual",
        status: "pending_review",
        created_by: context.userId,
        submitted_by: context.userId,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (draftError) throw new Error(draftError.message);

    await insertAdminReview({
      draftId: draft.id as string,
      reviewerId: context.userId,
      action: "create",
      afterStatus: "pending_review",
      notes: "Manual MCQ draft created.",
    });

    return { id: draft.id as string };
  });

export const approveQuestionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviewDraftSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireReviewer(context.userId);

    const { data: draft, error: draftError } = await table("question_drafts")
      .select(
        "id, question_id, exam_type_id, class_id, group_id, subject_id, chapter_id, board_id, board_year, question_type, difficulty, question_text, options, correct_answer, explanation, source, status, created_by",
      )
      .eq("id", data.draft_id)
      .maybeSingle();

    if (draftError) throw new Error(draftError.message);
    if (!draft) throw new Error("Draft not found.");
    if (draft.status === "approved") return { questionId: draft.question_id as string | null };
    if (draft.status === "rejected" || draft.status === "archived") {
      throw new Error("Only active drafts can be approved.");
    }

    const options = normalizeDraftOptions(draft.options);
    if (options.length < 2) throw new Error("Draft needs at least two options.");

    const now = new Date().toISOString();
    const optionTexts = options.map((option) => option.text);

    let questionPayload: Record<string, unknown> = {
      exam_type_id: draft.exam_type_id,
      class_id: draft.class_id,
      group_id: draft.group_id,
      subject_id: draft.subject_id,
      chapter_id: draft.chapter_id,
      board_id: draft.board_id,
      board_year: draft.board_year,
      question_type: draft.question_type,
      difficulty: draft.difficulty,
      question_text: draft.question_text,
      options: optionTexts,
      correct_answer: draft.correct_answer,
      explanation_bn: draft.explanation,
      is_approved: true,
      teacher_reviewed: true,
      source: draft.source,
      created_by: draft.created_by ?? context.userId,
      marks: 1,
      status: "approved",
      is_active: true,
      approved_by: context.userId,
      approved_at: now,
      updated_at: now,
    };

    let { data: question, error: questionError } = await table("questions")
      .insert(questionPayload)
      .select("id")
      .single();

    if (questionError && /column .* does not exist|schema cache/i.test(questionError.message)) {
      questionPayload = {
        chapter_id: draft.chapter_id,
        question_type: draft.question_type,
        difficulty: draft.difficulty,
        question_text: draft.question_text,
        options: optionTexts,
        correct_answer: draft.correct_answer,
        explanation_bn: draft.explanation,
        is_approved: true,
        teacher_reviewed: true,
        source: draft.source,
        created_by: draft.created_by ?? context.userId,
      };

      const fallback = await table("questions").insert(questionPayload).select("id").single();
      question = fallback.data;
      questionError = fallback.error;
    }

    if (questionError) throw new Error(questionError.message);
    if (!question) throw new Error("Question could not be published.");

    const questionId = question.id as string;
    const optionRows = options.map((option, index) => ({
      question_id: questionId,
      option_key: option.key || String.fromCharCode(65 + index),
      option_text: option.text,
      display_order: index + 1,
    }));

    const { error: optionsError } = await table("question_options").insert(optionRows);
    if (optionsError) throw new Error(optionsError.message);

    const { error: updateError } = await table("question_drafts")
      .update({
        question_id: questionId,
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", data.draft_id);

    if (updateError) throw new Error(updateError.message);

    await insertAdminReview({
      draftId: data.draft_id,
      questionId,
      reviewerId: context.userId,
      action: "approve",
      beforeStatus: draft.status as string,
      afterStatus: "approved",
      notes: data.notes || null,
    });

    return { questionId };
  });

export const rejectQuestionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    ReviewDraftSchema.extend({ notes: z.string().trim().min(3).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireReviewer(context.userId);

    const { data: draft, error: draftError } = await table("question_drafts")
      .select("id, status")
      .eq("id", data.draft_id)
      .maybeSingle();

    if (draftError) throw new Error(draftError.message);
    if (!draft) throw new Error("Draft not found.");
    if (draft.status === "approved") throw new Error("Approved drafts cannot be rejected.");

    const now = new Date().toISOString();
    const { error: updateError } = await table("question_drafts")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", data.draft_id);

    if (updateError) throw new Error(updateError.message);

    await insertAdminReview({
      draftId: data.draft_id,
      reviewerId: context.userId,
      action: "reject",
      beforeStatus: draft.status as string,
      afterStatus: "rejected",
      notes: data.notes,
    });

    return { ok: true };
  });
