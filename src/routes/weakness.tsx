import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TrendingDown, TrendingUp, Activity, Target } from "lucide-react";

export const Route = createFileRoute("/weakness")({ component: WeaknessPage });

type Row = {
  id: string;
  total_attempted: number;
  total_correct: number;
  subject_id: string | null;
  chapter_id: string | null;
  subjects: { name: string } | null;
  chapters: { id: string; name: string; name_bn: string | null } | null;
};

const MIN_ATTEMPTS = 3;

function WeaknessPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("performance_summary")
      .select("id, total_attempted, total_correct, subject_id, chapter_id, subjects(name), chapters(id, name, name_bn)")
      .eq("user_id", user.id)
      .then(({ data }) => setRows((data as any) ?? []));
  }, [user]);

  const { weak, improving, strong, bySubject, readiness, suggested } = useMemo(() => {
    const eligible = rows.filter((r) => r.total_attempted >= MIN_ATTEMPTS && r.chapters);
    const acc = (r: Row) => r.total_correct / Math.max(r.total_attempted, 1);
    const sorted = [...eligible].sort((a, b) => acc(a) - acc(b));
    const weak = sorted.filter((r) => acc(r) < 0.6);
    const improving = sorted.filter((r) => acc(r) >= 0.6 && acc(r) < 0.8);
    const strong = sorted.filter((r) => acc(r) >= 0.8);

    const subjMap = new Map<string, { name: string; attempted: number; correct: number }>();
    rows.forEach((r) => {
      const key = r.subject_id ?? "_";
      const cur = subjMap.get(key) ?? { name: r.subjects?.name ?? "—", attempted: 0, correct: 0 };
      cur.attempted += r.total_attempted;
      cur.correct += r.total_correct;
      subjMap.set(key, cur);
    });
    const bySubject = Array.from(subjMap.values()).filter((s) => s.attempted > 0);

    const totalA = rows.reduce((s, r) => s + r.total_attempted, 0);
    const totalC = rows.reduce((s, r) => s + r.total_correct, 0);
    const readiness = totalA > 0 ? Math.round((totalC / totalA) * 100) : 0;

    const suggested = weak[0] ?? improving[0] ?? null;

    return { weak, improving, strong, bySubject, readiness, suggested };
  }, [rows]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold mb-2">Weak Areas & Performance</h1>
        <p className="text-muted-foreground mb-6">দুর্বল chapter চিহ্নিত করে practice করুন</p>

        {rows.length === 0 ? (
          <Card className="p-10 text-center">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No performance data yet</p>
            <p className="text-sm text-muted-foreground mb-4">Take a few practice tests and we'll show your weak, improving, and strong chapters here.</p>
            <Button asChild><Link to="/subjects">Browse subjects →</Link></Button>
          </Card>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><Target className="h-4 w-4" /> Readiness</div>
                <div className="text-3xl font-bold mb-2">{readiness}%</div>
                <Progress value={readiness} />
              </Card>
              <Card className="p-5">
                <div className="text-sm text-muted-foreground mb-2">Chapters tracked</div>
                <div className="text-3xl font-bold">{rows.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Min {MIN_ATTEMPTS} attempts to classify</div>
              </Card>
              <Card className="p-5">
                <div className="text-sm text-muted-foreground mb-2">Suggested next</div>
                {suggested ? (
                  <>
                    <div className="font-medium text-sm mb-2">{suggested.subjects?.name} · {suggested.chapters?.name}</div>
                    <Button asChild size="sm"><Link to="/practice/$chapterId" params={{ chapterId: suggested.chapters!.id }}>Practice now →</Link></Button>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Great pace — keep going!</div>
                )}
              </Card>
            </div>

            <Card className="p-6 mb-8">
              <h2 className="font-semibold mb-4">Subject-wise accuracy</h2>
              <div className="space-y-3">
                {bySubject.map((s) => {
                  const pct = Math.round((s.correct / Math.max(s.attempted, 1)) * 100);
                  return (
                    <div key={s.name} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium">{s.name}</div>
                      <div className="flex-1"><Progress value={pct} /></div>
                      <div className="w-12 text-sm text-right font-semibold">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Section title="Weak (below 60%)" icon={<TrendingDown className="h-4 w-4 text-destructive" />} rows={weak} empty="No weak chapters — well done!" />
            <Section title="Improving (60–80%)" icon={<Activity className="h-4 w-4 text-warning" />} rows={improving} empty="Nothing in this band yet." />
            <Section title="Strong (above 80%)" icon={<TrendingUp className="h-4 w-4 text-success" />} rows={strong} empty="Push more chapters above 80% to land here." />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, icon, rows, empty }: { title: string; icon: React.ReactNode; rows: Row[]; empty: string }) {
  return (
    <section className="mb-6">
      <h2 className="font-semibold flex items-center gap-2 mb-3">{icon} {title}</h2>
      {rows.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">{empty}</Card>
      ) : (
        <div className="space-y-2">{rows.map((r) => <PerfRow key={r.id} row={r} />)}</div>
      )}
    </section>
  );
}

function PerfRow({ row }: { row: Row }) {
  const pct = Math.round((row.total_correct / Math.max(row.total_attempted, 1)) * 100);
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="font-medium text-sm">{row.subjects?.name} · {row.chapters?.name}</div>
        <div className="text-xs text-muted-foreground">{row.chapters?.name_bn} · {row.total_attempted} attempted</div>
      </div>
      <div className="w-32"><Progress value={pct} /></div>
      <div className="text-sm font-semibold w-12 text-right">{pct}%</div>
      <Button asChild size="sm" variant="outline"><Link to="/practice/$chapterId" params={{ chapterId: row.chapters!.id }}>Practice</Link></Button>
    </Card>
  );
}
