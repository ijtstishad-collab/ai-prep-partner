import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tbl = (n: string) => (supabaseAdmin.from as unknown as (name: string) => any)(n);

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;

    // Profile
    const { data: profile } = await tbl("profiles")
      .select("board, weak_subject_ids, student_group, target_exam_year, exam_date, daily_minutes")
      .eq("id", uid)
      .maybeSingle();

    // Recent attempts (last 30 + last 7 days)
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await tbl("test_attempts")
      .select("id, subject_id, chapter_id, score, correct_count, total_questions, started_at, completed_at, chapters(id, name, name_bn, subject_id), subjects(id, name, name_bn)")
      .eq("user_id", uid)
      .order("started_at", { ascending: false })
      .limit(50);

    const rows = (attempts as any[]) ?? [];
    const lastAttempt = rows[0] ?? null;
    const totalAttempted = rows.reduce((s, r) => s + (r.total_questions ?? 0), 0);
    const totalCorrect = rows.reduce((s, r) => s + (r.correct_count ?? 0), 0);
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const last7Count = rows.filter((r) => r.started_at >= since7).length;

    // Weak chapters: aggregate by chapter_id from attempts in last 30d
    const chapterAgg = new Map<string, { name: string; attempted: number; correct: number }>();
    for (const r of rows) {
      if (!r.chapter_id || r.started_at < since30) continue;
      const key = r.chapter_id as string;
      const existing = chapterAgg.get(key) ?? { name: r.chapters?.name ?? "অধ্যায়", attempted: 0, correct: 0 };
      existing.attempted += r.total_questions ?? 0;
      existing.correct += r.correct_count ?? 0;
      chapterAgg.set(key, existing);
    }
    const weakChapters = Array.from(chapterAgg.entries())
      .map(([id, v]) => ({ id, name: v.name, attempted: v.attempted, accuracy: v.attempted ? Math.round((v.correct / v.attempted) * 100) : 0 }))
      .filter((c) => c.attempted >= 5 && c.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    // Revision queue count
    const { count: revisionCount } = await tbl("revision_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("status", "pending");

    // Recommended practice — pick a weak subject and a chapter that has board questions
    let recommended: any = null;
    const weakIds = (profile?.weak_subject_ids as string[] | null) ?? [];
    const candidateSubjectIds = weakIds.length ? weakIds : [];

    if (candidateSubjectIds.length > 0) {
      const { data: cands } = await tbl("chapters")
        .select("id, name, name_bn, subject_id, subjects(id, name, name_bn, paper)")
        .in("subject_id", candidateSubjectIds)
        .eq("is_active", true)
        .limit(20);
      // Choose first chapter that has board questions
      const ch = (cands as any[]) ?? [];
      for (const c of ch) {
        const { count } = await tbl("past_questions")
          .select("id", { count: "exact", head: true })
          .eq("chapter_id", c.id);
        if ((count ?? 0) > 0) {
          recommended = { chapter: c, source: "weak_subject", bqCount: count };
          break;
        }
      }
      if (!recommended && ch.length > 0) {
        recommended = { chapter: ch[0], source: "weak_subject", bqCount: 0 };
      }
    }

    if (!recommended && lastAttempt?.chapter_id) {
      recommended = {
        chapter: {
          id: lastAttempt.chapter_id,
          name: lastAttempt.chapters?.name ?? "অধ্যায়",
          name_bn: lastAttempt.chapters?.name_bn ?? null,
          subject_id: lastAttempt.subject_id,
          subjects: lastAttempt.subjects ?? null,
        },
        source: "continue",
        bqCount: 0,
      };
    }

    if (!recommended) {
      // Fallback: first chapter with board questions
      const { data: anyBQ } = await tbl("past_questions")
        .select("chapter_id, chapters(id, name, name_bn, subject_id, subjects(name, name_bn, paper))")
        .limit(1);
      const first = (anyBQ as any[])?.[0];
      if (first?.chapters) {
        recommended = { chapter: first.chapters, source: "popular", bqCount: 1 };
      }
    }

    return {
      profile,
      lastAttempt,
      totalAttempted,
      accuracy,
      last7Count,
      weakChapters,
      revisionCount: revisionCount ?? 0,
      recommended,
    };
  });
