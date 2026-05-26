import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpen, Loader2, Sparkles, TrendingUp, Upload } from "lucide-react";

export const Route = createFileRoute("/past-paper-analyzer")({ component: AnalyzerPage });


type Row = { chapter_id: string; chapter: string; subject: string };

function AnalyzerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("past_questions")
        .select("chapter_id, chapters(name, subjects(name))")
        .limit(1000);
      const mapped: Row[] = ((data ?? []) as unknown as Array<{
        chapter_id: string;
        chapters: { name: string; subjects: { name: string } | null } | null;
      }>).map((r) => ({
        chapter_id: r.chapter_id,
        chapter: r.chapters?.name ?? "Unknown",
        subject: r.chapters?.subjects?.name ?? "Unknown",
      }));
      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  const chapterFreq = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.chapter, (m.get(r.chapter) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rows]);

  const subjectFreq = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.subject, (m.get(r.subject) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const colors = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];
  const total = rows.length;

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Past Paper Analyzer</h1>
          <p className="mt-1 text-muted-foreground">
            Frequency analysis of past board questions — focus on what comes up most.
          </p>
        </div>

        {loading ? (
          <Card className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </Card>
        ) : total === 0 ? (
          <Card className="p-8">
            <div className="mx-auto max-w-md text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">প্রশ্ন ব্যাংক এখনো খালি</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                বোর্ড প্রশ্ন যোগ হওয়ার পর এখানে বছরভিত্তিক ও বোর্ডভিত্তিক ফ্রিকোয়েন্সি ট্রেন্ড দেখা যাবে।
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/chapters">
                    <BookOpen className="mr-1.5 h-4 w-4" /> বোর্ড প্রশ্ন ব্রাউজ করুন
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/board-questions">
                    <Upload className="mr-1.5 h-4 w-4" /> Admin: প্রশ্ন যোগ করুন
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/practice">
                    <Sparkles className="mr-1.5 h-4 w-4" /> AI প্র্যাকটিস শুরু করুন
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Most repeated chapters</h2>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chapterFreq}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value">
                    {chapterFreq.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1 text-sm">
                {chapterFreq.map((c) => (
                  <li key={c.name} className="flex justify-between">
                    <span className="truncate">{c.name}</span>
                    <Badge variant="outline">{c.value}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Subject-wise distribution</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={subjectFreq} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5 md:col-span-2">
              <h2 className="mb-3 font-semibold">Suggested priority topics</h2>
              <div className="flex flex-wrap gap-2">
                {chapterFreq.slice(0, 6).map((c) => (
                  <Badge key={c.name} className="text-sm">
                    {c.name} · {c.value}×
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Based on {total} past questions in the bank.
              </p>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
