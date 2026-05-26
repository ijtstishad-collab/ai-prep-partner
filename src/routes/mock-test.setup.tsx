import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { checkMockAvailability, startMockTest, MOCK_TYPES } from "@/lib/mock-test.functions";
import { BOARDS } from "@/lib/board-questions.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  type: z.enum(MOCK_TYPES).catch("chapter"),
});

export const Route = createFileRoute("/mock-test/setup")({
  validateSearch: searchSchema,
  component: SetupPage,
});

type Subj = { id: string; name: string; name_bn: string | null };
type Chap = { id: string; name: string; name_bn: string | null; subject_id: string };

function SetupPage() {
  const { type } = Route.useSearch();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const check = useServerFn(checkMockAvailability);
  const start = useServerFn(startMockTest);

  const [subjects, setSubjects] = useState<Subj[]>([]);
  const [chapters, setChapters] = useState<Chap[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [board, setBoard] = useState<string>(profile?.board ?? "all");
  const [yearFrom, setYearFrom] = useState<string>("2018");
  const [yearTo, setYearTo] = useState<string>(String(new Date().getFullYear()));
  const [questionCount, setQuestionCount] = useState<string>(type === "final_hsc" ? "50" : "20");
  const [sourceMode, setSourceMode] = useState<string>("verified");
  const [difficulty, setDifficulty] = useState<string>("mixed");
  const [language, setLanguage] = useState<string>("bn");
  const [timer, setTimer] = useState<string>(type === "final_hsc" ? "60" : "20");
  const [availability, setAvailability] = useState<{ verified: number; requested: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: subs }, { data: chs }] = await Promise.all([
        (supabase.from("subjects") as any)
          .select("id,name,name_bn")
          .eq("is_active", true)
          .order("sort_order"),
        (supabase.from("chapters") as any)
          .select("id,name,name_bn,subject_id")
          .eq("is_active", true)
          .order("order_index"),
      ]);
      setSubjects((subs as Subj[]) ?? []);
      setChapters((chs as Chap[]) ?? []);
    })();
  }, []);

  const showSubject = type !== "final_hsc";
  const showChapter = type === "chapter";

  const filteredChapters = useMemo(
    () => (subjectId ? chapters.filter((c) => c.subject_id === subjectId) : []),
    [chapters, subjectId],
  );

  async function runAvailability() {
    try {
      const res = await check({
        data: {
          mock_type: type,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          board: board === "all" ? null : board,
          year_range_start: Number(yearFrom) || null,
          year_range_end: Number(yearTo) || null,
          question_count: Number(questionCount),
          source_mode: sourceMode as any,
          difficulty: difficulty as any,
          language: language as any,
          timer_minutes: Number(timer),
        },
      });
      setAvailability(res);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    if (showSubject && !subjectId) return;
    if (showChapter && !chapterId) return;
    runAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, chapterId, board, yearFrom, yearTo, questionCount, difficulty]);

  async function handleStart() {
    if (showSubject && !subjectId) return toast.error("বিষয় নির্বাচন করুন");
    if (showChapter && !chapterId) return toast.error("অধ্যায় নির্বাচন করুন");
    setBusy(true);
    try {
      const res = await start({
        data: {
          mock_type: type,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          board: board === "all" ? null : board,
          year_range_start: Number(yearFrom) || null,
          year_range_end: Number(yearTo) || null,
          question_count: Number(questionCount),
          source_mode: sourceMode as any,
          difficulty: difficulty as any,
          language: language as any,
          timer_minutes: Number(timer),
        },
      });
      if (type === "final_hsc") {
        toast("Final mock চলাকালীন explanation দেখা যাবে না। Submit করার পর result ও explanation দেখা যাবে।");
      }
      navigate({ to: "/mock-test/$mockId", params: { mockId: res.mock_id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const shortage = availability && availability.verified < Number(questionCount);

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <p className="text-sm text-primary capitalize">{type.replace("_", " ")} Mock</p>
          <h1 className="mt-1 text-2xl font-bold">মক টেস্ট সেটআপ</h1>
        </div>

        <Card className="p-6 space-y-5">
          {showSubject && (
            <Field label="বিষয় / Subject">
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
                <SelectTrigger><SelectValue placeholder="বিষয় নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name_bn ?? s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {showChapter && (
            <Field label="অধ্যায় / Chapter">
              <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder={subjectId ? "অধ্যায় নির্বাচন করুন" : "আগে বিষয় নির্বাচন করুন"} /></SelectTrigger>
                <SelectContent>
                  {filteredChapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name_bn ?? c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="বোর্ড / Board">
              <Select value={board} onValueChange={setBoard}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব বোর্ড</SelectItem>
                  {BOARDS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="প্রশ্ন সংখ্যা">
              <Select value={questionCount} onValueChange={setQuestionCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10","20","30","50"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="বছর শুরু">
              <Select value={yearFrom} onValueChange={setYearFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions().map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="বছর শেষ">
              <Select value={yearTo} onValueChange={setYearTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions().map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="প্রশ্নের উৎস">
              <Select value={sourceMode} onValueChange={setSourceMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">Verified Board Questions</SelectItem>
                  <SelectItem value="patterns">Repeated Patterns</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="ai_similar">AI Similar only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="কঠিনতা">
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="টাইমার">
              <Select value={timer} onValueChange={setTimer}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No timer</SelectItem>
                  <SelectItem value="10">10 মিনিট</SelectItem>
                  <SelectItem value="20">20 মিনিট</SelectItem>
                  <SelectItem value="30">30 মিনিট</SelectItem>
                  <SelectItem value="60">60 মিনিট</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="ভাষা">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bn">বাংলা</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {availability && (
            <div className={`rounded-lg border p-4 text-sm ${shortage ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-muted/40"}`}>
              {shortage ? (
                <>
                  এই সেটআপে পর্যাপ্ত verified board question নেই ({availability.verified} টি পাওয়া গেছে)।
                  আপনি চাইলে AI Similar question দিয়ে বাকি অংশ পূরণ করতে পারেন।
                </>
              ) : (
                <>উপলব্ধ verified প্রশ্ন: <strong>{availability.verified}</strong></>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleStart} disabled={busy}>
              {busy ? "শুরু হচ্ছে…" : "Start Mock Test"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/mock-test">Change Setup</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function yearOptions() {
  const cur = new Date().getFullYear();
  const out: number[] = [];
  for (let y = cur; y >= 2010; y--) out.push(y);
  return out;
}
