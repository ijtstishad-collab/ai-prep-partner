import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getMyStudyPlan, saveStudyPlan } from "@/lib/study-plan.functions";
import { CalendarDays, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/study-plan")({ component: StudyPlanPage });

type Subject = { id: string; name: string };
type Plan = {
  exam_date: string;
  daily_minutes: number;
  target_subject_ids: string[];
  weak_subject_ids: string[];
  notes: string | null;
} | null;

const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

function StudyPlanPage() {
  const fetchPlan = useServerFn(getMyStudyPlan);
  const persistPlan = useServerFn(saveStudyPlan);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plan, setPlan] = useState<Plan>(null);
  const [examDate, setExamDate] = useState("");
  const [dailyMin, setDailyMin] = useState(60);
  const [targets, setTargets] = useState<string[]>([]);
  const [weaks, setWeaks] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: subs }, res] = await Promise.all([
        supabase.from("subjects").select("id, name").eq("is_active", true),
        fetchPlan(),
      ]);
      setSubjects((subs ?? []) as Subject[]);
      if (res.plan) {
        setPlan(res.plan as Plan);
        setExamDate(res.plan.exam_date);
        setDailyMin(res.plan.daily_minutes);
        setTargets(res.plan.target_subject_ids ?? []);
        setWeaks(res.plan.weak_subject_ids ?? []);
        setNotes(res.plan.notes ?? "");
      }
      setLoading(false);
    })();
  }, [fetchPlan]);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const onSave = async () => {
    if (!examDate || targets.length === 0) {
      toast.error("Pick exam date and at least one target subject");
      return;
    }
    setSaving(true);
    try {
      const res = await persistPlan({
        data: {
          exam_date: examDate,
          daily_minutes: dailyMin,
          target_subject_ids: targets,
          weak_subject_ids: weaks,
          notes: notes || null,
        },
      });
      setPlan(res.plan as Plan);
      toast.success("Study plan saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const weekly = useMemo(() => {
    if (!plan) return [];
    const focus = plan.target_subject_ids.map((id) => subjects.find((s) => s.id === id)?.name).filter(Boolean) as string[];
    const weakNames = plan.weak_subject_ids.map((id) => subjects.find((s) => s.id === id)?.name).filter(Boolean) as string[];
    return DAYS.map((d, i) => {
      const primary = focus[i % Math.max(focus.length, 1)] ?? "Review";
      const secondary = weakNames[i % Math.max(weakNames.length, 1)] ?? null;
      return {
        day: d,
        minutes: plan.daily_minutes,
        tasks: [
          `Study: ${primary} (${Math.round(plan.daily_minutes * 0.6)} min)`,
          `Practice MCQs: ${primary} (${Math.round(plan.daily_minutes * 0.3)} min)`,
          secondary ? `Weak focus: ${secondary} (${Math.round(plan.daily_minutes * 0.1)} min)` : "Revision",
        ],
      };
    });
  }, [plan, subjects]);

  if (loading) {
    return (
      <AppShell>
        <div className="container mx-auto max-w-4xl px-4 py-10">
          <Card className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Study Plan</h1>
          <p className="mt-1 text-muted-foreground">Set your exam date and daily time — we'll build a weekly plan.</p>
        </div>

        <Card className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <Label>Exam date</Label>
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div>
            <Label>Daily study time (minutes)</Label>
            <Input
              type="number"
              min={10}
              max={600}
              value={dailyMin}
              onChange={(e) => setDailyMin(Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Target subjects</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <Badge
                  key={s.id}
                  variant={targets.includes(s.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggle(targets, setTargets, s.id)}
                >
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Weak subjects (extra focus)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <Badge
                  key={s.id}
                  variant={weaks.includes(s.id) ? "secondary" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggle(weaks, setWeaks, s.id)}
                >
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save plan"}
            </Button>
          </div>
        </Card>

        {plan && (
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Exam: <strong className="text-foreground">{plan.exam_date}</strong>
              <Target className="ml-4 h-4 w-4" /> Daily: {plan.daily_minutes} min
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {weekly.map((d) => (
                <Card key={d.day} className="p-4">
                  <h3 className="mb-2 font-semibold">{d.day}</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {d.tasks.map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
