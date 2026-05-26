import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tbl = (n: string) => (supabaseAdmin.from as unknown as (name: string) => any)(n);

export const MOCK_TYPES = ["chapter", "subject", "board_pattern", "final_hsc"] as const;
export type MockType = (typeof MOCK_TYPES)[number];

const SetupSchema = z.object({
  mock_type: z.enum(MOCK_TYPES),
  subject_id: z.string().uuid().optional().nullable(),
  chapter_id: z.string().uuid().optional().nullable(),
  board: z.string().optional().nullable(),
  year_range_start: z.number().int().optional().nullable(),
  year_range_end: z.number().int().optional().nullable(),
  question_count: z.number().int().min(5).max(100).default(20),
  source_mode: z.enum(["verified", "patterns", "mixed", "ai_similar"]).default("verified"),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  language: z.enum(["bn", "en", "mixed"]).default("bn"),
  timer_minutes: z.number().int().min(0).max(240).default(30),
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Check how many verified board questions match a setup, before starting. */
export const checkMockAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetupSchema.parse(i))
  .handler(async ({ data }) => {
    let q = tbl("past_questions")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "verified");
    if (data.chapter_id) q = q.eq("chapter_id", data.chapter_id);
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.board && data.board !== "all") q = q.eq("board", data.board);
    if (data.year_range_start) q = q.gte("year", data.year_range_start);
    if (data.year_range_end) q = q.lte("year", data.year_range_end);
    if (data.difficulty !== "mixed") q = q.eq("difficulty", data.difficulty);
    const { count } = await q;
    return { verified: count ?? 0, requested: data.question_count };
  });

/** Create a new mock test and select questions according to source_mode. */
export const startMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetupSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Build question pool from past_questions
    let q = tbl("past_questions")
      .select("id, priority_score, year, difficulty, source_type, pattern_id")
      .eq("verification_status", "verified")
      .order("priority_score", { ascending: false })
      .order("year", { ascending: false })
      .limit(500);
    if (data.chapter_id) q = q.eq("chapter_id", data.chapter_id);
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.board && data.board !== "all") q = q.eq("board", data.board);
    if (data.year_range_start) q = q.gte("year", data.year_range_start);
    if (data.year_range_end) q = q.lte("year", data.year_range_end);
    if (data.difficulty !== "mixed") q = q.eq("difficulty", data.difficulty);

    const { data: pool } = await q;
    const rows: any[] = (pool as any[]) ?? [];

    let picked: any[] = [];
    if (data.source_mode === "verified") {
      picked = rows.slice(0, data.question_count);
    } else if (data.source_mode === "patterns") {
      picked = rows.filter((r) => r.pattern_id).slice(0, data.question_count);
    } else if (data.source_mode === "mixed") {
      picked = shuffle(rows).slice(0, data.question_count);
    } else if (data.source_mode === "ai_similar") {
      // For now AI Similar uses generated_questions if any approved; fall back to verified.
      let aq = tbl("generated_questions")
        .select("id")
        .eq("status", "approved")
        .limit(data.question_count);
      if (data.chapter_id) aq = aq.eq("chapter_id", data.chapter_id);
      if (data.subject_id) aq = aq.eq("subject_id", data.subject_id);
      const { data: aiRows } = await aq;
      picked = ((aiRows as any[]) ?? []).map((r) => ({ ...r, _ai: true }));
      if (picked.length < data.question_count) {
        const fill = rows.slice(0, data.question_count - picked.length);
        picked = [...picked, ...fill];
      }
    }

    if (picked.length === 0) {
      throw new Error("পর্যাপ্ত verified question নেই। অনুগ্রহ করে সেটআপ পরিবর্তন করুন।");
    }

    const hasAi = picked.some((p) => p._ai);

    const { data: mockRow, error } = await tbl("mock_tests")
      .insert({
        user_id: context.userId,
        mock_type: data.mock_type,
        subject_id: data.subject_id ?? null,
        chapter_id: data.chapter_id ?? null,
        board: data.board ?? null,
        year_range_start: data.year_range_start ?? null,
        year_range_end: data.year_range_end ?? null,
        question_count: picked.length,
        source_mode: data.source_mode,
        difficulty: data.difficulty,
        language: data.language,
        timer_minutes: data.timer_minutes,
        has_ai_similar: hasAi,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const mockId = (mockRow as any).id as string;
    const insertRows = picked.map((p, idx) => ({
      mock_test_id: mockId,
      question_id: p.id,
      source_table: p._ai ? "generated_questions" : "past_questions",
      order_number: idx + 1,
    }));
    const { error: e2 } = await tbl("mock_test_questions").insert(insertRows);
    if (e2) throw new Error(e2.message);

    return { mock_id: mockId };
  });

/** Get full mock state: header + questions (without answers if in_progress). */
export const getMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mock_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: mock, error } = await tbl("mock_tests")
      .select("*")
      .eq("id", data.mock_id)
      .eq("user_id", context.userId)
      .single();
    if (error || !mock) throw new Error("Mock test পাওয়া যায়নি।");

    const { data: mqs } = await tbl("mock_test_questions")
      .select("*")
      .eq("mock_test_id", data.mock_id)
      .order("order_number", { ascending: true });

    const past = ((mqs as any[]) ?? []).filter((r) => r.source_table === "past_questions");
    const ai = ((mqs as any[]) ?? []).filter((r) => r.source_table === "generated_questions");

    const fields =
      mock.status === "submitted"
        ? "id, question_text, options, answer, year, board, source_type, priority_score, explanation_bn, explanation_en, common_mistake, why_a_wrong, why_b_wrong, why_c_wrong, why_d_wrong, formula_or_rule, chapter_id, subject_id"
        : "id, question_text, options, year, board, source_type, priority_score";

    const [{ data: pastQ }, { data: aiQ }] = await Promise.all([
      past.length
        ? tbl("past_questions").select(fields).in("id", past.map((p) => p.question_id))
        : Promise.resolve({ data: [] }),
      ai.length
        ? tbl("generated_questions")
            .select(
              mock.status === "submitted"
                ? "id, question_text, options, correct_answer, explanation_bn, chapter_id, subject_id"
                : "id, question_text, options",
            )
            .in("id", ai.map((p) => p.question_id))
        : Promise.resolve({ data: [] }),
    ]);

    const qMap = new Map<string, any>();
    ((pastQ as any[]) ?? []).forEach((q) => qMap.set(q.id, { ...q, _ai: false }));
    ((aiQ as any[]) ?? []).forEach((q) =>
      qMap.set(q.id, { ...q, _ai: true, answer: q.correct_answer }),
    );

    const questions = ((mqs as any[]) ?? []).map((m) => ({
      mq_id: m.id,
      order: m.order_number,
      selected_answer: m.selected_answer,
      is_marked_for_review: m.is_marked_for_review,
      is_correct: m.is_correct,
      question: qMap.get(m.question_id) ?? null,
    }));

    return { mock, questions };
  });

const SaveSchema = z.object({
  mq_id: z.string().uuid(),
  selected_answer: z.string().nullable(),
  is_marked_for_review: z.boolean().optional(),
  time_taken: z.number().int().min(0).optional(),
});

export const saveMockAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Ensure ownership via join check
    const { data: row } = await tbl("mock_test_questions")
      .select("id, mock_test_id")
      .eq("id", data.mq_id)
      .single();
    if (!row) throw new Error("Not found");
    const { data: m } = await tbl("mock_tests")
      .select("user_id, status")
      .eq("id", (row as any).mock_test_id)
      .single();
    if (!m || (m as any).user_id !== context.userId) throw new Error("Unauthorized");
    if ((m as any).status !== "in_progress") throw new Error("Test already submitted.");

    const patch: any = { selected_answer: data.selected_answer, answered_at: new Date().toISOString() };
    if (data.is_marked_for_review !== undefined) patch.is_marked_for_review = data.is_marked_for_review;
    if (data.time_taken !== undefined) patch.time_taken = data.time_taken;

    const { error } = await tbl("mock_test_questions").update(patch).eq("id", data.mq_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ mock_id: z.string().uuid(), expired: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: mock } = await tbl("mock_tests")
      .select("*")
      .eq("id", data.mock_id)
      .eq("user_id", context.userId)
      .single();
    if (!mock) throw new Error("Not found");
    if ((mock as any).status !== "in_progress") {
      return { ok: true, already: true };
    }

    const { data: mqs } = await tbl("mock_test_questions")
      .select("id, question_id, source_table, selected_answer")
      .eq("mock_test_id", data.mock_id);

    const rows = (mqs as any[]) ?? [];
    const pastIds = rows.filter((r) => r.source_table === "past_questions").map((r) => r.question_id);
    const aiIds = rows.filter((r) => r.source_table === "generated_questions").map((r) => r.question_id);

    const [{ data: pastQs }, { data: aiQs }] = await Promise.all([
      pastIds.length
        ? tbl("past_questions").select("id, answer, chapter_id, subject_id").in("id", pastIds)
        : Promise.resolve({ data: [] }),
      aiIds.length
        ? tbl("generated_questions")
            .select("id, correct_answer, chapter_id, subject_id")
            .in("id", aiIds)
        : Promise.resolve({ data: [] }),
    ]);

    const answerMap = new Map<string, { answer: string | null; chapter_id: string | null; subject_id: string | null }>();
    ((pastQs as any[]) ?? []).forEach((q) =>
      answerMap.set(q.id, { answer: q.answer, chapter_id: q.chapter_id, subject_id: q.subject_id }),
    );
    ((aiQs as any[]) ?? []).forEach((q) =>
      answerMap.set(q.id, { answer: q.correct_answer, chapter_id: q.chapter_id, subject_id: q.subject_id }),
    );

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const updates: Promise<any>[] = [];
    const revisionInserts: any[] = [];

    for (const r of rows) {
      const info = answerMap.get(r.question_id);
      const expected = (info?.answer ?? "").toString().trim().toLowerCase();
      const got = (r.selected_answer ?? "").toString().trim().toLowerCase();
      let isCorrect: boolean | null = null;
      if (!r.selected_answer) {
        skipped += 1;
        revisionInserts.push({
          user_id: context.userId,
          question_id: r.question_id,
          subject_id: info?.subject_id ?? null,
          chapter_id: info?.chapter_id ?? null,
          reason: "skipped",
          status: "pending",
          source_table: r.source_table,
          mock_test_id: data.mock_id,
        });
      } else if (expected && got === expected) {
        correct += 1;
        isCorrect = true;
      } else {
        wrong += 1;
        isCorrect = false;
        revisionInserts.push({
          user_id: context.userId,
          question_id: r.question_id,
          subject_id: info?.subject_id ?? null,
          chapter_id: info?.chapter_id ?? null,
          reason: "wrong_answer",
          status: "pending",
          source_table: r.source_table,
          mock_test_id: data.mock_id,
        });
      }
      updates.push(tbl("mock_test_questions").update({ is_correct: isCorrect }).eq("id", r.id));
    }
    await Promise.all(updates);

    // Best-effort revision inserts: skip questions already saved
    if (revisionInserts.length) {
      const qIds = revisionInserts.map((r) => r.question_id);
      const { data: existing } = await tbl("revision_items")
        .select("question_id")
        .eq("user_id", context.userId)
        .in("question_id", qIds);
      const have = new Set(((existing as any[]) ?? []).map((r) => r.question_id));
      const toInsert = revisionInserts.filter((r) => !have.has(r.question_id));
      if (toInsert.length) await tbl("revision_items").insert(toInsert);
    }

    const total = rows.length || 1;
    const accuracy = Math.round((correct / total) * 1000) / 10;
    const startedAt = new Date((mock as any).started_at).getTime();
    const timeTaken = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

    const { error: uErr } = await tbl("mock_tests")
      .update({
        status: data.expired ? "expired" : "submitted",
        submitted_at: new Date().toISOString(),
        time_taken: timeTaken,
        score: correct,
        accuracy,
        correct_count: correct,
        wrong_count: wrong,
        skipped_count: skipped,
      })
      .eq("id", data.mock_id);
    if (uErr) throw new Error(uErr.message);

    // Mirror into test_attempts for legacy progress
    await tbl("test_attempts").insert({
      user_id: context.userId,
      subject_id: (mock as any).subject_id,
      chapter_id: (mock as any).chapter_id,
      total_questions: total,
      correct_count: correct,
      score: accuracy,
      started_at: (mock as any).started_at,
      completed_at: new Date().toISOString(),
    });

    return { ok: true, correct, wrong, skipped, accuracy };
  });

export const listMockHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await tbl("mock_tests")
      .select("id, mock_type, subject_id, chapter_id, status, accuracy, correct_count, question_count, started_at, submitted_at")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(20);
    return { items: (data as any[]) ?? [] };
  });
