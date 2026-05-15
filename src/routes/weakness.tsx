import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/weakness")({ component: WeaknessPage });

function WeaknessPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("performance_summary")
      .select("*, subjects(name), chapters(id, name, name_bn)")
      .eq("user_id", user.id)
      .then(({ data }) => setRows(data ?? []));
  }, [user]);

  const sorted = [...rows].sort((a, b) => (a.total_correct / Math.max(a.total_attempted, 1)) - (b.total_correct / Math.max(b.total_attempted, 1)));
  const weak = sorted.filter((r) => r.total_attempted >= 3 && r.total_correct / r.total_attempted < 0.6);
  const strong = sorted.filter((r) => r.total_attempted >= 3 && r.total_correct / r.total_attempted >= 0.8);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Weak Areas</h1>
        <p className="text-muted-foreground mb-6">দুর্বল chapter চিহ্নিত করে practice করুন</p>

        {rows.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">Take a few tests to see your weak areas.</Card>
        )}

        {weak.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><TrendingDown className="h-4 w-4 text-destructive" /> Needs Improvement</h2>
            <div className="space-y-2">
              {weak.map((r) => <PerfRow key={r.id} row={r} />)}
            </div>
          </section>
        )}

        {strong.length > 0 && (
          <section>
            <h2 className="font-semibold flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-success" /> Strong Areas</h2>
            <div className="space-y-2">
              {strong.map((r) => <PerfRow key={r.id} row={r} />)}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function PerfRow({ row }: { row: any }) {
  const pct = Math.round((row.total_correct / Math.max(row.total_attempted, 1)) * 100);
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="font-medium text-sm">{row.subjects?.name} · {row.chapters?.name}</div>
        <div className="text-xs text-muted-foreground">{row.chapters?.name_bn} · {row.total_attempted} questions attempted</div>
      </div>
      <div className="w-32"><Progress value={pct} /></div>
      <div className="text-sm font-semibold w-12 text-right">{pct}%</div>
      <Button asChild size="sm" variant="outline"><Link to="/practice/$chapterId" params={{ chapterId: row.chapters?.id }}>Practice</Link></Button>
    </Card>
  );
}
