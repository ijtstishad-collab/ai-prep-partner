import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, BookOpen, Target, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ attempts: 0, accuracy: 0, weakChapters: 0, readiness: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && profile && !profile.onboarded) nav({ to: "/onboarding" });
  }, [loading, user, profile, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("id, score, total_questions, correct_count, completed_at, subjects(name), chapters(name)")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(5);
      const { data: perf } = await supabase
        .from("performance_summary")
        .select("total_attempted, total_correct, chapters(id, name), subjects(name)")
        .eq("user_id", user.id);
      const totalA = perf?.reduce((s, p) => s + p.total_attempted, 0) ?? 0;
      const totalC = perf?.reduce((s, p) => s + p.total_correct, 0) ?? 0;
      const eligible = (perf ?? []).filter((p) => p.total_attempted >= 3);
      const weak = eligible.filter((p) => p.total_correct / p.total_attempted < 0.6);
      const next = [...eligible].sort((a, b) =>
        (a.total_correct / a.total_attempted) - (b.total_correct / b.total_attempted)
      )[0] ?? null;
      setRecent(attempts ?? []);
      setSuggested(next);
      setStats({
        attempts: attempts?.length ?? 0,
        accuracy: totalA > 0 ? Math.round((totalC / totalA) * 100) : 0,
        weakChapters: weak.length,
        readiness: totalA > 0 ? Math.round((totalC / totalA) * 100) : 0,
      });
    })();
  }, [user]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">স্বাগতম, {profile?.full_name || "Student"}! 👋</h1>
          <p className="text-muted-foreground">Class: {profile?.class} · Target: {profile?.target_exam_year}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Target} label="Tests Taken" value={String(stats.attempts)} tone="primary" />
          <StatCard icon={Sparkles} label="Avg Accuracy" value={`${stats.accuracy}%`} tone="success" />
          <StatCard icon={TrendingDown} label="Weak Chapters" value={String(stats.weakChapters)} tone="warning" />
        </div>

        <Card className="p-6 mb-8 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">HSC Readiness Score</h3>
            <span className="text-2xl font-bold text-primary">{stats.readiness}%</span>
          </div>
          <Progress value={stats.readiness} />
          <p className="text-xs text-muted-foreground mt-2">Based on overall accuracy across all attempted chapters.</p>
        </Card>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Card className="p-6 bg-gradient-hero text-primary-foreground shadow-soft">
            <Sparkles className="h-8 w-8 mb-3" />
            <h3 className="text-xl font-semibold mb-1">Generate AI Questions</h3>
            <p className="text-sm opacity-90 mb-4">Pick a chapter, type, and difficulty.</p>
            <Button asChild variant="secondary"><Link to="/generate">Start →</Link></Button>
          </Card>
          {suggested ? (
            <Card className="p-6 shadow-soft border-warning/40">
              <TrendingDown className="h-8 w-8 mb-3 text-warning" />
              <h3 className="text-xl font-semibold mb-1">Suggested Next Practice</h3>
              <p className="text-sm text-muted-foreground mb-1">{suggested.subjects?.name} · {suggested.chapters?.name}</p>
              <p className="text-xs text-muted-foreground mb-4">Accuracy {Math.round((suggested.total_correct / suggested.total_attempted) * 100)}% — focus here next.</p>
              <Button asChild><Link to="/practice/$chapterId" params={{ chapterId: suggested.chapters?.id }}>Practice now →</Link></Button>
            </Card>
          ) : (
            <Card className="p-6 shadow-soft">
              <BookOpen className="h-8 w-8 mb-3 text-primary" />
              <h3 className="text-xl font-semibold mb-1">Practice by Chapter</h3>
              <p className="text-sm text-muted-foreground mb-4">Browse subjects & chapters.</p>
              <Button asChild><Link to="/subjects">Browse Subjects →</Link></Button>
            </Card>
          )}
        </div>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Recent Tests</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tests yet. Start practicing!</p>
          ) : (
            <div className="space-y-3">
              {recent.map((a) => {
                const pct = Math.round((a.correct_count / Math.max(a.total_questions, 1)) * 100);
                return (
                  <div key={a.id} className="flex items-center gap-4 p-3 rounded-xl border">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{a.subjects?.name} · {a.chapters?.name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(a.completed_at).toLocaleString()}</div>
                    </div>
                    <div className="w-32"><Progress value={pct} /></div>
                    <div className="text-sm font-semibold w-16 text-right">{a.correct_count}/{a.total_questions}</div>
                    <Button asChild size="sm" variant="ghost"><Link to="/result/$attemptId" params={{ attemptId: a.id }}>View</Link></Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary" | "success" | "warning" }) {
  const toneCls = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning" }[tone];
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${toneCls}`}><Icon className="h-6 w-6" /></div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}
