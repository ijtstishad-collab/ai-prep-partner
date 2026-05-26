import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  chapter_id: z.string().uuid(),
  question_type: z.enum(["mcq", "short", "creative", "board", "admission"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(5),
  save: z.boolean().default(false),
});

export type GeneratedItem = {
  question_text: string;
  options?: string[];
  correct_answer?: string;
  answer_text?: string;
  explanation_bn: string | null;
};

const MAX_PER_HOUR = 40;

function parseResponse(content: string, kind: string): GeneratedItem[] {
  try {
    const json = JSON.parse(content) as { questions?: unknown[] };
    const rows = Array.isArray(json.questions) ? json.questions : [];
    return rows
      .map((r) => {
        const v = r as Partial<GeneratedItem> & { options?: unknown };
        const options = Array.isArray(v.options)
          ? (v.options as unknown[]).map((o) => String(o).trim()).filter(Boolean)
          : undefined;
        return {
          question_text: String(v.question_text ?? "").trim(),
          options,
          correct_answer: v.correct_answer ? String(v.correct_answer).trim() : undefined,
          answer_text: v.answer_text ? String(v.answer_text).trim() : undefined,
          explanation_bn: v.explanation_bn ? String(v.explanation_bn).trim() : null,
        } satisfies GeneratedItem;
      })
      .filter((r) => {
        if (r.question_text.length < 6) return false;
        if (kind === "mcq") {
          return (
            !!r.options && r.options.length >= 2 && !!r.correct_answer && r.options.includes(r.correct_answer)
          );
        }
        return !!(r.answer_text || r.explanation_bn);
      });
  } catch {
    return [];
  }
}

function promptFor(kind: string, count: number, difficulty: string, subject: string, chapter: string) {
  const base = `Subject: ${subject}\nChapter: ${chapter}\nDifficulty: ${difficulty}\nCount: ${count}`;
  if (kind === "mcq") {
    return `${base}\nGenerate ${count} original HSC MCQs with 4 short options each. correct_answer must exactly match one option. Provide a short Bangla explanation in explanation_bn.\nReturn JSON: {"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_answer":"...","explanation_bn":"..."}]}`;
  }
  if (kind === "short") {
    return `${base}\nGenerate ${count} short-answer HSC questions. Each has a 1-2 sentence answer_text in English and a Bangla explanation_bn.\nReturn JSON: {"questions":[{"question_text":"...","answer_text":"...","explanation_bn":"..."}]}`;
  }
  if (kind === "creative") {
    return `${base}\nGenerate ${count} HSC creative (CQ-style) questions with stimulus + 4 parts (ka/kha/ga/gha). Put the full question (stimulus and parts) in question_text. Provide a model answer in answer_text and brief Bangla note in explanation_bn.\nReturn JSON: {"questions":[{"question_text":"...","answer_text":"...","explanation_bn":"..."}]}`;
  }
  if (kind === "board") {
    return `${base}\nGenerate ${count} HSC board-exam style MCQs (rigor matching real board questions). 4 options, correct_answer exact, Bangla explanation.\nReturn JSON: {"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_answer":"...","explanation_bn":"..."}]}`;
  }
  return `${base}\nGenerate ${count} admission-test style MCQs (medical/engineering/varsity rigor). 4 options, correct_answer exact, Bangla explanation.\nReturn JSON: {"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_answer":"...","explanation_bn":"..."}]}`;
}

export const generateAiQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: chapter, error: chErr } = await supabaseAdmin
      .from("chapters")
      .select("id, name, name_bn, subject_id, subjects(name, name_bn)")
      .eq("id", data.chapter_id)
      .eq("is_active", true)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    if (!chapter) throw new Error("Chapter not found");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_HOUR) {
      throw new Error("Hourly AI generation limit reached. Try again later.");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const subject = (chapter.subjects as { name?: string; name_bn?: string } | null);
    const subjectLabel = `${subject?.name ?? "HSC subject"}${subject?.name_bn ? ` (${subject.name_bn})` : ""}`;
    const chapterLabel = `${chapter.name}${chapter.name_bn ? ` (${chapter.name_bn})` : ""}`;

    const userPrompt = promptFor(data.question_type, data.count, data.difficulty, subjectLabel, chapterLabel);
    const systemPrompt =
      "You write original HSC exam-preparation questions for Bangladeshi students. Do not copy verbatim past board questions. Return strict JSON only.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted in Lovable.");
      const t = await res.text();
      throw new Error(`AI generation failed: ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const items = parseResponse(content, data.question_type).slice(0, data.count);
    if (items.length === 0) throw new Error("AI did not return usable items. Try again.");

    let savedCount = 0;
    if (data.save) {
      const isMcq = data.question_type === "mcq" || data.question_type === "board" || data.question_type === "admission";
      const dbType = isMcq ? "mcq" : data.question_type === "short" ? "short" : "written";

      for (const item of items) {
        const optionsObj: Record<string, string> = {};
        let correctKey = item.correct_answer ?? "";
        if (isMcq && item.options) {
          item.options.forEach((o, i) => {
            const k = String.fromCharCode(65 + i);
            optionsObj[k] = o;
            if (o === item.correct_answer) correctKey = k;
          });
        }
        const { error } = await supabaseAdmin.from("questions").insert({
          chapter_id: chapter.id,
          question_type: dbType,
          difficulty: data.difficulty,
          question_text: item.question_text,
          options: isMcq ? optionsObj : null,
          correct_answer: isMcq ? correctKey : (item.answer_text ?? ""),
          explanation_bn: item.explanation_bn,
          is_approved: true,
          teacher_reviewed: false,
          source: `ai_generator_${data.question_type}`,
          created_by: context.userId,
        });
        if (!error) savedCount += 1;
      }
    }

    return { items, savedCount };
  });
