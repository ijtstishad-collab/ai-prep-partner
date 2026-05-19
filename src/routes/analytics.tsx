import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/bn";
import {
  BarChart3,
  GraduationCap,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

type Attempt = {
  id: string;
  status: string;
  score: number | string | null;
  max_score: number | string | null;
  total_questions: number | null;
  correct_count: number | null;
  chapter_id: string | null;
};

type Chapter = { id: string; name: string; name_bn: string | null };

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [chapters, setChapters] = useState<Record<string, Chapter>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await fromTable("attempts")
        .select("id, status, score, max_score, total_questions, correct_count, chapter_id")
        .eq("status", "submitted")
        .limit(500);

      if (!alive) return;
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Attempt[];
      setAttempts(rows);

      const ids = Array.from(
        new Set(rows.map((r) => r.chapter_id).filter((id): id is string => !!id)),
      );
      if (ids.length > 0) {
        const { data: chRows } = await fromTable("chapters")
          .select("id, name, name_bn")
          .in("id", ids);
        if (!alive) return;
        const map: Record<string, Chapter> = {};
        for (const c of (chRows ?? []) as Chapter[]) map[c.id] = c;
        setChapters(map);
      }
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const summary = useMemo(() => {
    const total = attempts.reduce(
      (acc, a) => {
        acc.score += Number(a.score ?? 0);
        acc.max += Number(a.max_score ?? 0);
        acc.correct += a.correct_count ?? 0;
        acc.questions += a.total_questions ?? 0;
        return acc;
      },
      { score: 0, max: 0, correct: 0, questions: 0 },
    );
    const accuracy =
      total.questions > 0 ? Math.round((total.correct / total.questions) * 100) : 0;
    const readiness = total.max > 0 ? Math.round((total.score / total.max) * 100) : 0;

    // Per-chapter accuracy
    const byChapter = new Map<string, { correct: number; total: number; score: number; max: number }>();
    for (const a of attempts) {
      if (!a.chapter_id) continue;
      const cur =
        byChapter.get(a.chapter_id) ?? { correct: 0, total: 0, score: 0, max: 0 };
      cur.correct += a.correct_count ?? 0;
      cur.total += a.total_questions ?? 0;
      cur.score += Number(a.score ?? 0);
      cur.max += Number(a.max_score ?? 0);
      byChapter.set(a.chapter_id, cur);
    }
    const chapterRows = Array.from(byChapter.entries())
      .map(([id, v]) => ({
        id,
        name: chapters[id]?.name ?? "Unknown chapter",
        name_bn: chapters[id]?.name_bn ?? null,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
        attempts: v.total,
      }))
      .filter((r) => r.attempts > 0)
      .sort((a, b) => a.accuracy - b.accuracy);
    const weak = chapterRows.filter((r) => r.accuracy < 50);

    return { accuracy, readiness, weakCount: weak.length, chapterRows };
  }, [attempts, chapters]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">ড্যাশবোর্ড</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">বিশ্লেষণ</span>
        </nav>

        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium text-primary">ফলাফল বিশ্লেষণ</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold">আপনার প্রস্তুতির অবস্থা</h1>
          <p className="mt-2 text-muted-foreground">
            জমা দেওয়া সব অনুশীলন থেকে নির্ভুলতা, দুর্বল অধ্যায় ও সামগ্রিক প্রস্তুতি হিসাব করা হয়েছে।
          </p>
        </div>

        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> সেশন যাচাই হচ্ছে…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">লগইন প্রয়োজন</h2>
            <Button asChild className="mt-4">
              <Link to="/auth">লগইন / সাইন আপ</Link>
            </Button>
          </Card>
        ) : loading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> বিশ্লেষণ তৈরি হচ্ছে…
          </Card>
        ) : error ? (
          <Card className="paper-sheet p-6">
            <h2 className="font-semibold text-destructive">বিশ্লেষণ লোড করা যায়নি</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                title="সামগ্রিক নির্ভুলতা"
                bn="Accuracy"
                value={`${toBnDigits(summary.accuracy)}%`}
                icon={BarChart3}
              />
              <Metric
                title="দুর্বল অধ্যায়"
                bn="Weak Chapters"
                value={toBnDigits(summary.weakCount)}
                icon={TrendingDown}
              />
              <Metric
                title="প্রস্তুতি"
                bn="Readiness"
                value={`${toBnDigits(summary.readiness)}%`}
                icon={Target}
              />
            </div>

            <Card className="paper-sheet mt-6 p-6">
              <h2 className="exam-heading font-semibold">অধ্যায়ভিত্তিক পারফরম্যান্স</h2>
              <p className="text-sm text-muted-foreground">
                কম নির্ভুলতার অধ্যায়গুলো প্রথমে দেখানো হচ্ছে — সেখানেই রিভিশনে জোর দিন।
              </p>
              {summary.chapterRows.length === 0 ? (
                <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  কয়েকটি অধ্যায় অনুশীলন করলে অধ্যায়ভিত্তিক বিশ্লেষণ আনলক হবে।
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {summary.chapterRows.slice(0, 8).map((row) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{row.name}</div>
                        {row.name_bn ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {row.name_bn}
                          </div>
                        ) : null}
                      </div>
                      <div className="w-40">
                        <Progress value={row.accuracy} />
                      </div>
                      <div className="w-20 text-right text-sm font-semibold">
                        {toBnDigits(row.accuracy)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/history">ইতিহাস দেখুন</Link>
                </Button>
                <Button asChild>
                  <Link to="/subjects">
                    <TrendingUp className="mr-1 h-4 w-4" />
                    দুর্বল অধ্যায় অনুশীলন করুন
                  </Link>
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({
  title,
  bn,
  value,
  icon: Icon,
}: {
  title: string;
  bn: string;
  value: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card className="paper-sheet p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {title} <span className="lowercase">· {bn}</span>
          </div>
          <div className="exam-heading mt-0.5 text-2xl font-bold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

// Used by Card import—keep usage consistent.
type _PreserveBadge = typeof Badge;
