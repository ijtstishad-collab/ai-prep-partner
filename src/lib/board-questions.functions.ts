import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const BOARDS = [
  "Dhaka", "Rajshahi", "Chattogram", "Cumilla", "Jashore",
  "Sylhet", "Barishal", "Dinajpur", "Mymensingh", "Madrasah", "Technical",
] as const;

const FiltersSchema = z.object({
  chapter_id: z.string().uuid(),
  exam_level: z.enum(["SSC", "HSC"]).optional(),
  year_from: z.number().int().optional(),
  year_to: z.number().int().optional(),
  board: z.string().optional(),
  question_type: z.string().optional(),
  frequency: z.enum(["1", "2-3", "4+"]).optional(),
  priority: z.enum(["very_important", "important", "practice_later"]).optional(),
  tab: z.enum(["all", "repeated", "pattern", "high_priority", "ai_similar"]).optional(),
  include_unverified: z.boolean().optional(),
});


const tbl = (n: string) => (supabaseAdmin.from as unknown as (name: string) => any)(n);

export const getBoardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: qs } = await tbl("past_questions")
      .select("year, board, priority_score, pattern_id, source_type")
      .eq("chapter_id", data.chapter_id);
    const rows = (qs as any[]) ?? [];
    const years = new Set(rows.map((r) => r.year).filter(Boolean));
    const boards = new Set(rows.map((r) => r.board).filter(Boolean));
    const patterns = new Set(rows.map((r) => r.pattern_id).filter(Boolean));
    const highPriority = rows.filter((r) => (r.priority_score ?? 0) >= 70).length;
    return {
      total: rows.length,
      years: years.size,
      boards: boards.size,
      repeated: patterns.size,
      highPriority,
    };
  });

export const listBoardQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FiltersSchema.parse(i))
  .handler(async ({ data }) => {
    let q = tbl("past_questions")
      .select(
        "id, question_text, year, board, question_type, answer, exam_level, paper, topic, source_type, verification_status, pattern_id, priority_score, explanation_bn, options",
      )
      .eq("chapter_id", data.chapter_id)
      .order("priority_score", { ascending: false })
      .order("year", { ascending: false });

    if (data.exam_level) q = q.eq("exam_level", data.exam_level);
    if (data.board) q = q.eq("board", data.board);
    if (data.question_type) q = q.eq("question_type", data.question_type);
    if (data.year_from) q = q.gte("year", data.year_from);
    if (data.year_to) q = q.lte("year", data.year_to);
    if (data.priority === "very_important") q = q.gte("priority_score", 70);
    else if (data.priority === "important") q = q.gte("priority_score", 40).lt("priority_score", 70);
    else if (data.priority === "practice_later") q = q.lt("priority_score", 40);
    if (data.tab === "high_priority") q = q.gte("priority_score", 70);
    if (data.tab === "ai_similar") q = q.eq("source_type", "ai_generated");
    if (data.tab === "repeated" || data.tab === "pattern") q = q.not("pattern_id", "is", null);
    if (!data.include_unverified) q = q.eq("verification_status", "verified");

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { questions: (rows as any[]) ?? [] };
  });

export const listRepeatedPatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await tbl("question_patterns")
      .select("id, name, name_bn, description_bn, appeared_years, appeared_boards, frequency_count, priority_score, priority_label")
      .eq("chapter_id", data.chapter_id)
      .order("priority_score", { ascending: false });
    if (error) throw new Error(error.message);
    return { patterns: (rows as any[]) ?? [] };
  });

export const getChapterMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ chapter_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: chapter } = await supabaseAdmin
      .from("chapters")
      .select("id, name, name_bn, subject_id, subjects(id, name, name_bn, slug, group_type)")
      .eq("id", data.chapter_id)
      .maybeSingle();
    return { chapter };
  });

export const generateAISimilarQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      source_question_id: z.string().uuid().optional(),
      chapter_id: z.string().uuid(),
      count: z.number().int().min(1).max(5).default(3),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service not configured");

    const { data: chapter } = await supabaseAdmin
      .from("chapters")
      .select("id, name, name_bn, subject_id, subjects(name, name_bn)")
      .eq("id", data.chapter_id)
      .maybeSingle();
    if (!chapter) throw new Error("Chapter not found");

    let source: any = null;
    if (data.source_question_id) {
      const { data: src } = await tbl("past_questions")
        .select("question_text, answer, year, board, question_type, pattern_id")
        .eq("id", data.source_question_id)
        .maybeSingle();
      source = src;
    }

    const subjectName = (chapter.subjects as any)?.name ?? "";
    const styleNote = source
      ? `Base your style on this real board question from ${source.board} ${source.year}:\n"${source.question_text}"\nAnswer: ${source.answer ?? "-"}`
      : "Base style on standard SSC/HSC board question patterns for this chapter.";

    const userPrompt = `Subject: ${subjectName}
Chapter: ${chapter.name} ${chapter.name_bn ?? ""}

${styleNote}

Generate ${data.count} similar practice questions (do NOT copy verbatim). For each, return JSON:
{ "questions": [{ "question_text": "...", "question_type": "mcq|short|written", "options": ["..."] (only for mcq), "correct_answer": "...", "explanation_bn": "সহজ বাংলা ব্যাখ্যা" }] }`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write SSC/HSC practice questions for Bangladeshi students. Output STRICT JSON only." },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}
    const questions = (parsed.questions ?? []).slice(0, data.count);

    const rows = questions.map((q: any) => ({
      user_id: context.userId,
      subject_id: chapter.subject_id,
      chapter_id: data.chapter_id,
      question_type: q.question_type ?? source?.question_type ?? "mcq",
      difficulty: "medium",
      question_text: q.question_text,
      options: Array.isArray(q.options) ? q.options : null,
      correct_answer: q.correct_answer ?? "",
      explanation_bn: q.explanation_bn ?? "",
      status: "pending",
      is_teacher_reviewed: false,
      source_context: {
        ai_similar: true,
        pattern_id: source?.pattern_id ?? null,
        source_board: source?.board ?? null,
        source_year: source?.year ?? null,
        label: source ? `AI Similar — Based on ${source.board} Board ${source.year} Pattern` : "AI Similar Practice",
      },
    }));

    if (rows.length === 0) throw new Error("AI did not return questions. Try again.");

    const { data: inserted, error } = await tbl("generated_questions").insert(rows).select("*");
    if (error) throw new Error(error.message);
    return { questions: (inserted as any[]) ?? [] };
  });

// ===== Admin =====

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin access required");
}

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  chapter_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  question_text: z.string().min(3),
  answer: z.string().optional(),
  explanation_bn: z.string().optional(),
  explanation_en: z.string().optional(),
  common_mistake: z.string().optional(),
  why_a_wrong: z.string().optional(),
  why_b_wrong: z.string().optional(),
  why_c_wrong: z.string().optional(),
  why_d_wrong: z.string().optional(),
  formula_or_rule: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  year: z.number().int().optional(),
  board: z.string().optional(),
  exam_level: z.enum(["SSC", "HSC"]).optional(),
  group_type: z.string().optional(),
  paper: z.string().optional(),
  topic: z.string().optional(),
  question_type: z.string().default("mcq"),
  source_type: z.string().default("official_board"),
  verification_status: z.string().default("verified"),
  pattern_id: z.string().uuid().nullish(),
  options: z.any().optional(),
  appeared_years: z.array(z.number().int()).optional(),
  appeared_boards: z.array(z.string()).optional(),
});

export const upsertBoardQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    // Validation rules
    if (data.source_type === "official_board" && (!data.board || !data.year)) {
      throw new Error("Official board questions require board and year");
    }
    if (data.source_type === "ai_generated" && data.verification_status === "verified") {
      // allow but not as official — caller already labels
    }
    if (data.verification_status === "verified" && !data.answer) {
      throw new Error("Verified questions need an answer");
    }
    const payload: any = { ...data, updated_at: new Date().toISOString() };
    delete payload.id;
    if (!data.id) payload.created_by = context.userId;
    if (data.id) {
      const { error } = await tbl("past_questions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await tbl("past_questions").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const verifyBoardQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await tbl("past_questions")
      .update({ verification_status: data.verified ? "verified" : "review_needed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const mergeIntoPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      pattern: z.object({
        id: z.string().uuid().optional(),
        chapter_id: z.string().uuid(),
        subject_id: z.string().uuid(),
        name: z.string().min(2),
        name_bn: z.string().optional(),
        description_bn: z.string().optional(),
        topic_importance: z.number().int().min(0).max(100).default(50),
      }),
      question_ids: z.array(z.string().uuid()).min(1),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    let patternId = data.pattern.id;
    if (!patternId) {
      const { data: created, error } = await tbl("question_patterns")
        .insert({
          chapter_id: data.pattern.chapter_id,
          subject_id: data.pattern.subject_id,
          name: data.pattern.name,
          name_bn: data.pattern.name_bn,
          description_bn: data.pattern.description_bn,
          topic_importance: data.pattern.topic_importance,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      patternId = created.id;
    }
    const { error: updErr } = await tbl("past_questions")
      .update({ pattern_id: patternId })
      .in("id", data.question_ids);
    if (updErr) throw new Error(updErr.message);
    return { pattern_id: patternId };
  });
