import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  chapter_id: z.string().uuid(),
  question_type: z.enum(["mcq", "short", "written"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(10),
});

type GeneratedQuestion = {
  question_text: string;
  options?: string[];
  correct_answer: string;
  explanation_bn: string;
};

// Tagged error so the client can show demo mode instead of a generic error
export const INSUFFICIENT_CONTENT = "INSUFFICIENT_CONTENT";

async function fetchReadinessCounts(chapterId: string) {
  const { data: chapter } = await supabaseAdmin
    .from("chapters")
    .select("id, name, name_bn, subject_id, subjects(name, name_bn)")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chapter) return null;

  const [unitsRes, chunksRes, pastRes, rulesRes, reviewedRes] = await Promise.all([
    supabaseAdmin.from("syllabus_units").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId),
    supabaseAdmin.from("textbook_chunks").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId),
    supabaseAdmin.from("past_questions").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId),
    (supabaseAdmin.from as any)("generation_rules").select("id", { count: "exact", head: true })
      .eq("subject_id", chapter.subject_id).eq("is_active", true),
    (supabaseAdmin.from as any)("generated_questions").select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId).eq("status", "approved").eq("is_teacher_reviewed", true),
  ]);

  const counts = {
    units: unitsRes.count ?? 0,
    chunks: chunksRes.count ?? 0,
    past: pastRes.count ?? 0,
    rules: rulesRes.count ?? 0,
    reviewed: reviewedRes.count ?? 0,
  };

  let status: "not_started" | "content_added" | "ai_ready" | "teacher_reviewed";
  if (counts.reviewed > 0) status = "teacher_reviewed";
  else if (counts.units > 0 && counts.chunks > 0 && counts.past > 0 && counts.rules > 0) status = "ai_ready";
  else if (counts.units > 0 || counts.chunks > 0 || counts.past > 0) status = "content_added";
  else status = "not_started";

  return { chapter, counts, status };
}

export const getChapterReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ chapter_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const r = await fetchReadinessCounts(data.chapter_id);
    if (!r) throw new Error("Chapter not found");
    return { status: r.status, counts: r.counts };
  });

export const getDemoQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ chapter_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows } = await (supabaseAdmin.from as any)("demo_questions")
      .select("id, question_text, options, correct_answer, explanation_bn, question_type, difficulty")
      .eq("chapter_id", data.chapter_id)
      .limit(5);
    return { demo: (rows as any[]) ?? [] };
  });

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const ready = await fetchReadinessCounts(data.chapter_id);
    if (!ready) throw new Error("Chapter not found");

    // STRICT: AI generation requires syllabus, textbook chunks, past questions, AND rules
    if (
      ready.counts.units === 0 ||
      ready.counts.chunks === 0 ||
      ready.counts.past === 0 ||
      ready.counts.rules === 0
    ) {
      throw new Error(INSUFFICIENT_CONTENT);
    }

    const chapter = ready.chapter;

    const [unitsRes, chunksRes, pastRes, rulesRes] = await Promise.all([
      supabaseAdmin.from("syllabus_units").select("title, title_bn, learning_objectives, keywords").eq("chapter_id", data.chapter_id).limit(20),
      supabaseAdmin.from("textbook_chunks").select("content, source, page_ref").eq("chapter_id", data.chapter_id).limit(10),
      supabaseAdmin.from("past_questions").select("question_text, answer, year, board").eq("chapter_id", data.chapter_id).eq("question_type", data.question_type).limit(8),
      (supabaseAdmin.from as any)("generation_rules").select("instructions").eq("subject_id", chapter.subject_id).eq("question_type", data.question_type).eq("is_active", true),
    ]);

    const units = unitsRes.data ?? [];
    const chunks = chunksRes.data ?? [];
    const pastQs = pastRes.data ?? [];
    const rules = (rulesRes.data as any[]) ?? [];

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured");

    const subjectName = (chapter.subjects as any)?.name ?? "HSC Science";

    const sys = `You are an HSC Science exam question writer for Bangladeshi students. Strictly stay within the provided syllabus and textbook context. Never copy past questions verbatim — only use them to understand style and difficulty. Provide simple Bangla explanations. Output STRICT JSON only.`;

    const ctx = `
SUBJECT: ${subjectName}
CHAPTER: ${chapter.name} (${chapter.name_bn ?? ""})

SYLLABUS UNITS (in-syllabus only — do NOT go outside these):
${units.map((u) => `- ${u.title}${u.keywords?.length ? ` | keywords: ${(u.keywords as string[]).join(", ")}` : ""}${u.learning_objectives?.length ? ` | objectives: ${(u.learning_objectives as string[]).join("; ")}` : ""}`).join("\n") || "(none)"}

TEXTBOOK EXCERPTS (ground truth):
${chunks.map((c, i) => `[${i + 1}] (${c.source ?? "textbook"}${c.page_ref ? `, p.${c.page_ref}` : ""}): ${c.content.slice(0, 600)}`).join("\n") || "(none)"}

REFERENCE PAST QUESTIONS (style guide — DO NOT COPY):
${pastQs.map((p, i) => `[${i + 1}] (${p.year ?? "?"} ${p.board ?? ""}): ${p.question_text}`).join("\n") || "(none)"}

EXTRA RULES:
${rules.map((r) => `- ${r.instructions}`).join("\n") || "(none)"}
`;

    const userPrompt = `${ctx}

Generate ${data.count} ${data.difficulty} ${data.question_type.toUpperCase()} questions strictly within the syllabus and textbook context above.
Return STRICT JSON: { "questions": [ { "question_text": "...", ${data.question_type === "mcq" ? '"options": ["A","B","C","D"], ' : ""}"correct_answer": "...", "explanation_bn": "Bangla explanation" } ] }
${data.question_type === "mcq" ? "For MCQ, correct_answer must EXACTLY match one option string." : ""}
If context is insufficient, return { "questions": [] }.
Only output JSON.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
      throw new Error(`AI gateway error: ${txt.slice(0, 200)}`);
    }
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { questions?: GeneratedQuestion[] };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const questions = (parsed.questions ?? []).slice(0, data.count);
    if (questions.length === 0) throw new Error(INSUFFICIENT_CONTENT);

    // Block exact copies of past questions
    const pastSet = new Set(pastQs.map((p) => p.question_text.trim().toLowerCase()));
    const filtered = questions.filter((q) => !pastSet.has(q.question_text.trim().toLowerCase()));
    if (filtered.length === 0) throw new Error("AI returned only duplicates of past questions. Try again.");

    const rows = filtered.map((q) => ({
      user_id: userId,
      subject_id: chapter.subject_id,
      chapter_id: data.chapter_id,
      question_type: data.question_type,
      difficulty: data.difficulty,
      question_text: q.question_text,
      options: data.question_type === "mcq" ? q.options ?? [] : null,
      correct_answer: q.correct_answer,
      explanation_bn: q.explanation_bn,
      status: "pending",
      is_teacher_reviewed: false,
      source_context: {
        units: units.length, chunks: chunks.length, past: pastQs.length, rules: rules.length,
      },
    }));

    const { data: inserted, error } = await (supabaseAdmin.from as any)("generated_questions")
      .insert(rows)
      .select("id, question_text, options, correct_answer, explanation_bn, question_type, difficulty, status, is_teacher_reviewed");
    if (error) throw new Error(error.message);
    return { questions: (inserted as any[]) ?? [] };
  });
