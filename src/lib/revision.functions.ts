import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tbl = (n: string) => (supabaseAdmin.from as unknown as (name: string) => any)(n);

export const addToRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      question_id: z.string().uuid(),
      subject_id: z.string().uuid().optional(),
      chapter_id: z.string().uuid().optional(),
      reason: z.enum(["manual", "wrong_answer", "skipped"]).default("manual"),
      source_table: z.string().default("past_questions"),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await tbl("revision_items")
      .select("id")
      .eq("user_id", context.userId)
      .eq("question_id", data.question_id)
      .maybeSingle();
    if (existing) return { ok: true, duplicate: true };

    const { error } = await tbl("revision_items").insert({
      user_id: context.userId,
      question_id: data.question_id,
      subject_id: data.subject_id ?? null,
      chapter_id: data.chapter_id ?? null,
      reason: data.reason,
      status: "pending",
      source_table: data.source_table,
      note: data.note ?? null,
    });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { ok: true, duplicate: false };
  });

export const getRevisionCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await tbl("revision_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending");
    return { count: count ?? 0 };
  });
