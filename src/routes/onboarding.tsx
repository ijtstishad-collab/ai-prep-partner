import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { allowedGroupsFor, subjectMatchesGroup } from "@/lib/student-group";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

type Group = "Science" | "Business" | "Humanities";

const GROUPS: { key: Group; en: string; bn: string }[] = [
  { key: "Science", en: "Science", bn: "বিজ্ঞান" },
  { key: "Business", en: "Business Studies", bn: "ব্যবসায় শিক্ষা" },
  { key: "Humanities", en: "Humanities", bn: "মানবিক" },
];

const BOARDS = [
  ["dhaka", "Dhaka", "ঢাকা"],
  ["rajshahi", "Rajshahi", "রাজশাহী"],
  ["chattogram", "Chattogram", "চট্টগ্রাম"],
  ["cumilla", "Cumilla", "কুমিল্লা"],
  ["jashore", "Jashore", "যশোর"],
  ["sylhet", "Sylhet", "সিলেট"],
  ["barishal", "Barishal", "বরিশাল"],
  ["dinajpur", "Dinajpur", "দিনাজপুর"],
  ["mymensingh", "Mymensingh", "ময়মনসিংহ"],
  ["madrasah", "Madrasah", "মাদ্রাসা"],
  ["technical", "Technical", "কারিগরি"],
] as const;

const YEARS = [2026, 2027];

type Subject = { id: string; name: string; name_bn: string | null; group_type: string | null };

const STEPS = ["Group", "Board", "Exam Year", "Weak Subjects", "Daily Time"] as const;

function Onboarding() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [form, setForm] = useState({
    group: "Science" as Group,
    board: "dhaka",
    year: 2026,
    weak: [] as string[],
    minutes: 90,
  });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    (supabase.from("subjects") as any)
      .select("id, name, name_bn, group_type")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }: { data: Subject[] | null }) => setSubjects(data ?? []));
  }, []);

  const groupSubjects = useMemo(() => {
    const allowed = allowedGroupsFor(form.group);
    return subjects.filter((s) => subjectMatchesGroup(s, allowed));
  }, [subjects, form.group]);

  const toggleWeak = (id: string) =>
    setForm((f) => ({
      ...f,
      weak: f.weak.includes(id) ? f.weak.filter((x) => x !== id) : [...f.weak, id],
    }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await (supabase.from("profiles") as any)
      .update({
        full_name: profile?.full_name ?? "",
        class: form.year === 2026 ? "HSC 2nd Year" : "HSC 1st Year",
        student_group: form.group,
        target_exam_year: form.year,
        board: form.board,
        weak_subject_ids: form.weak,
        daily_minutes: form.minutes,
        onboarded: true,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("সেটআপ সম্পূর্ণ! ড্যাশবোর্ডে যাচ্ছি…");
    nav({ to: "/dashboard" });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Stepper */}
        <div className="mb-6 flex items-center gap-2 text-xs">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  i < step && "bg-primary text-primary-foreground border-primary",
                  i === step && "border-primary text-primary",
                  i > step && "text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            ধাপ {step + 1} / {STEPS.length} · {STEPS[step]}
          </p>

          {step === 0 && (
            <>
              <h1 className="mt-1 text-2xl font-bold">আপনার বিভাগ নির্বাচন করুন</h1>
              <p className="text-sm text-muted-foreground mb-4">Pick your HSC group.</p>
              <div className="grid gap-3">
                {GROUPS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setForm({ ...form, group: g.key })}
                    className={cn(
                      "rounded-lg border p-4 text-left transition hover:border-primary",
                      form.group === g.key && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="font-semibold">{g.en}</div>
                    <div className="text-sm text-muted-foreground">{g.bn}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="mt-1 text-2xl font-bold">আপনার বোর্ড</h1>
              <p className="text-sm text-muted-foreground mb-4">Select your education board.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BOARDS.map(([key, en, bn]) => (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, board: key })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition hover:border-primary",
                      form.board === key && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="font-semibold text-sm">{en}</div>
                    <div className="text-xs text-muted-foreground">{bn}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mt-1 text-2xl font-bold">পরীক্ষার বছর</h1>
              <p className="text-sm text-muted-foreground mb-4">Which HSC batch?</p>
              <div className="grid grid-cols-2 gap-3">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setForm({ ...form, year: y })}
                    className={cn(
                      "rounded-lg border p-4 text-center transition hover:border-primary",
                      form.year === y && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="text-xl font-bold">HSC {y}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="mt-1 text-2xl font-bold">দুর্বল বিষয় বেছে নিন</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Tick any subject you find hard — recommendations will focus there.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {groupSubjects.map((s) => {
                  const on = form.weak.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleWeak(s.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition hover:border-primary",
                        on && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="text-sm font-semibold flex items-center justify-between gap-2">
                        <span className="truncate">{s.name}</span>
                        {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      {s.name_bn && (
                        <div className="text-xs text-muted-foreground truncate">{s.name_bn}</div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {form.weak.length} টি বিষয় নির্বাচিত (later পরিবর্তন করা যাবে)
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="mt-1 text-2xl font-bold">দৈনিক অধ্যয়নের সময়</h1>
              <p className="text-sm text-muted-foreground mb-6">How many minutes can you study daily?</p>
              <div className="flex items-center justify-between mb-3">
                <Label>মিনিট / দিন</Label>
                <span className="text-2xl font-bold text-primary">{form.minutes} min</span>
              </div>
              <Slider
                value={[form.minutes]}
                min={30}
                max={240}
                step={15}
                onValueChange={(v) => setForm({ ...form, minutes: v[0] })}
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>30</span>
                <span>120</span>
                <span>240</span>
              </div>
              <div className="mt-6">
                <Label>পূর্ণ নাম (ঐচ্ছিক)</Label>
                <Input
                  placeholder="যেমন: রায়হান আহমেদ"
                  defaultValue={profile?.full_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ["__name" as any]: e.target.value }) as any)
                  }
                />
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-2">
            <Button variant="outline" onClick={back} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> পেছনে
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                পরবর্তী <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                শেষ করুন & ড্যাশবোর্ড
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
