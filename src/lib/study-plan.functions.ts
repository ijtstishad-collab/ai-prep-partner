import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SavePlanSchema = z.object({
  exam_date: z.string().min(8),
  daily_minutes: z.number().int().min(10).max(600),
  target_subject_ids: z.array(z.string().uuid()).max(20),
  weak_subject_ids: z.array(z.string().uuid()).max(20).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

export const getMyStudyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { plan: data };
  });

export const saveStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SavePlanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      exam_date: data.exam_date,
      daily_minutes: data.daily_minutes,
      target_subject_ids: data.target_subject_ids,
      weak_subject_ids: data.weak_subject_ids ?? [],
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data: row, error } = await context.supabase
      .from("study_plans")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { plan: row };
  });
