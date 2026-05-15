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

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Fetch chapter context
    const { data: chapter, error: chErr } = await supabaseAdmin
      .from("chapters")
      .select("id, name, name_bn, subjects(name, name_bn)")
      .eq("id", data.chapter_id)
      .maybeSingle();
    if (chErr || !chapter) throw new Error("Chapter not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured");

    const subjectName = (chapter.subjects as any)?.name ?? "HSC Science";
    const sys = `You are an HSC Science exam question writer for Bangladesh students. Generate exam-quality questions in English with Bangla explanations.`;
    const userPrompt = `Generate ${data.count} ${data.difficulty} ${data.question_type.toUpperCase()} questions for:
Subject: ${subjectName}
Chapter: ${chapter.name} (${chapter.name_bn})

Return STRICT JSON: { "questions": [ { "question_text": "...", ${data.question_type === "mcq" ? '"options": ["A","B","C","D"], ' : ""}"correct_answer": "...", "explanation_bn": "Bangla explanation here" } ] }
${data.question_type === "mcq" ? "For MCQ, correct_answer must EXACTLY match one option string." : ""}
Only output JSON. No prose.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
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
    if (questions.length === 0) throw new Error("AI returned no questions");

    // Persist as approved=false (until reviewed by teacher) but make available for the user immediately
    const rows = questions.map((q) => ({
      chapter_id: data.chapter_id,
      question_type: data.question_type,
      difficulty: data.difficulty,
      question_text: q.question_text,
      options: data.question_type === "mcq" ? q.options ?? [] : null,
      correct_answer: q.correct_answer,
      explanation_bn: q.explanation_bn,
      is_approved: true, // auto-available to the generating user; admin can re-review
      teacher_reviewed: false,
      source: "ai",
      created_by: userId,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("questions").insert(rows).select("id, question_text, options, correct_answer, explanation_bn, question_type, difficulty");
    if (error) throw new Error(error.message);
    return { questions: inserted ?? [] };
  });
