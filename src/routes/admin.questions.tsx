import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  BOARDS,
  upsertBoardQuestion,
  verifyBoardQuestion,
  rejectBoardQuestion,
  deleteBoardQuestion,
  listAdminBank,
  importBoardQuestionsCsv,
} from "@/lib/board-questions.functions";
import { Download, FileUp, CheckCircle2, XCircle, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/questions")({ component: AdminQuestionsPage });

const QUESTION_TYPES = ["mcq", "cq", "short", "grammar", "writing"];
const SOURCE_TYPES = [
  ["official_board", "Official Board"],
  ["teacher_verified", "Teacher Verified"],
  ["ai_generated", "AI Similar"],
  ["model_test", "Model Test"],
] as const;
const VERIFICATION = [
  ["verified", "Verified"],
  ["review_needed", "Review Needed"],
  ["rejected", "Rejected"],
] as const;
const DIFFICULTIES = ["easy", "medium", "hard"];
const GROUPS = ["Common", "Science", "Business Studies", "Humanities"];

const fromTable = (n: string) => (supabase.from as unknown as (s: string) => any)(n);

function AdminQuestionsPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading) return <AppShell><div className="p-8 text-sm text-muted-foreground">Loading…</div></AppShell>;

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="container mx-auto max-w-md px-4 py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h1 className="exam-heading text-xl font-bold">আপনার admin access নেই।</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is restricted to administrators.
          </p>
          <Button className="mt-5" onClick={() => nav({ to: "/dashboard" })}>Back to Dashboard</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-medium text-primary">Admin Console</p>
          <h1 className="exam-heading text-2xl font-bold sm:text-3xl">Board Question Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, import, verify, and manage HSC board questions.
          </p>
        </div>

        <Tabs defaultValue="single">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="single">Add Single</TabsTrigger>
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
            <TabsTrigger value="review">Review Queue</TabsTrigger>
            <TabsTrigger value="bank">Question Bank</TabsTrigger>
          </TabsList>
          <TabsContent value="single"><SingleQuestionTab /></TabsContent>
          <TabsContent value="csv"><CsvImportTab /></TabsContent>
          <TabsContent value="review"><ReviewQueueTab /></TabsContent>
          <TabsContent value="bank"><QuestionBankTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ============================== Single Add =============================== */

function useSubjectsAndChapters() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  useEffect(() => {
    fromTable("subjects")
      .select("id, name, name_bn, paper, group_type")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }: any) => setSubjects(data ?? []));
  }, []);
  const loadChapters = async (subjectId: string) => {
    const { data } = await fromTable("chapters")
      .select("id, name, name_bn, subject_id")
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .order("order_index");
    setChapters(data ?? []);
  };
  return { subjects, chapters, loadChapters };
}

function SingleQuestionTab() {
  const { subjects, chapters, loadChapters } = useSubjectsAndChapters();
  const upsert = useServerFn(upsertBoardQuestion);

  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [f, setF] = useState({
    group: "Common", paper: "", topic: "",
    question_type: "mcq",
    question_text: "",
    option_a: "", option_b: "", option_c: "", option_d: "",
    correct_answer: "",
    explanation_bn: "", explanation_en: "",
    common_mistake: "",
    why_a_wrong: "", why_b_wrong: "", why_c_wrong: "", why_d_wrong: "",
    formula_or_rule: "",
    board: "", year: "",
    source_type: "official_board",
    verification_status: "review_needed",
    difficulty: "medium",
  });

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const subject = subjects.find((s) => s.id === subjectId);
  useEffect(() => {
    if (subject?.paper) setF((p) => ({ ...p, paper: subject.paper }));
  }, [subject]);

  const buildPayload = (status: "verified" | "review_needed") => {
    const opts = [f.option_a, f.option_b, f.option_c, f.option_d].filter(Boolean);
    return {
      chapter_id: chapterId,
      subject_id: subjectId,
      question_text: f.question_text,
      answer: f.correct_answer || undefined,
      explanation_bn: f.explanation_bn || undefined,
      explanation_en: f.explanation_en || undefined,
      common_mistake: f.common_mistake || undefined,
      why_a_wrong: f.why_a_wrong || undefined,
      why_b_wrong: f.why_b_wrong || undefined,
      why_c_wrong: f.why_c_wrong || undefined,
      why_d_wrong: f.why_d_wrong || undefined,
      formula_or_rule: f.formula_or_rule || undefined,
      year: f.year ? parseInt(f.year) : undefined,
      board: f.board || undefined,
      exam_level: "HSC" as const,
      group_type: f.group,
      paper: f.paper || undefined,
      topic: f.topic || undefined,
      question_type: f.question_type,
      source_type: f.source_type,
      verification_status: status,
      difficulty: f.difficulty as "easy" | "medium" | "hard",
      options: opts.length ? opts : undefined,
    };
  };

  const handleSave = async (status: "verified" | "review_needed") => {
    if (!subjectId || !chapterId || !f.question_text.trim()) {
      toast.error("Subject, chapter and question text are required");
      return;
    }
    if (f.question_type === "mcq" && (!f.option_a || !f.option_b || !f.correct_answer)) {
      toast.error("MCQ needs options and correct answer");
      return;
    }
    if (f.source_type === "official_board" && (!f.board || !f.year)) {
      toast.error("Official Board questions require board and year");
      return;
    }
    try {
      await upsert({ data: buildPayload(status) });
      toast.success(status === "verified" ? "Saved as Verified" : "Saved to Review Queue");
      setF((p) => ({ ...p, question_text: "", correct_answer: "",
        option_a: "", option_b: "", option_c: "", option_d: "",
        explanation_bn: "", explanation_en: "", common_mistake: "",
        why_a_wrong: "", why_b_wrong: "", why_c_wrong: "", why_d_wrong: "",
        formula_or_rule: "", topic: "" }));
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const isAI = f.source_type === "ai_generated";

  return (
    <Card className="mt-4 space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Exam Level"><Input value="HSC" disabled /></Field>
        <Field label="Group">
          <Select value={f.group} onValueChange={(v) => set("group", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Paper"><Input value={f.paper} onChange={(e) => set("paper", e.target.value)} placeholder="1st / 2nd" /></Field>
        <Field label="Subject">
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); loadChapters(v); setChapterId(""); }}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Chapter">
          <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
            <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Topic"><Input value={f.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
        <Field label="Question Type">
          <Select value={f.question_type} onValueChange={(v) => set("question_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select value={f.difficulty} onValueChange={(v) => set("difficulty", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Source Type">
          <Select value={f.source_type} onValueChange={(v) => set("source_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCE_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Board">
          <Select value={f.board} onValueChange={(v) => set("board", v)}>
            <SelectTrigger><SelectValue placeholder="Select board" /></SelectTrigger>
            <SelectContent>{BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Year"><Input value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="2024" /></Field>
      </div>

      {isAI && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          AI Similar questions are not official board questions and will not be shown with an Official Board badge.
        </div>
      )}

      <Field label="Question Text">
        <Textarea rows={3} value={f.question_text} onChange={(e) => set("question_text", e.target.value)} />
      </Field>

      {f.question_type === "mcq" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Option A"><Input value={f.option_a} onChange={(e) => set("option_a", e.target.value)} /></Field>
            <Field label="Option B"><Input value={f.option_b} onChange={(e) => set("option_b", e.target.value)} /></Field>
            <Field label="Option C"><Input value={f.option_c} onChange={(e) => set("option_c", e.target.value)} /></Field>
            <Field label="Option D"><Input value={f.option_d} onChange={(e) => set("option_d", e.target.value)} /></Field>
          </div>
          <Field label="Correct Answer"><Input value={f.correct_answer} onChange={(e) => set("correct_answer", e.target.value)} placeholder="e.g. A or full answer text" /></Field>
        </>
      )}
      {f.question_type !== "mcq" && (
        <Field label="Correct Answer"><Textarea rows={2} value={f.correct_answer} onChange={(e) => set("correct_answer", e.target.value)} /></Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bangla Explanation"><Textarea rows={3} value={f.explanation_bn} onChange={(e) => set("explanation_bn", e.target.value)} /></Field>
        <Field label="English Explanation"><Textarea rows={3} value={f.explanation_en} onChange={(e) => set("explanation_en", e.target.value)} /></Field>
        <Field label="Common Mistake"><Textarea rows={2} value={f.common_mistake} onChange={(e) => set("common_mistake", e.target.value)} /></Field>
        <Field label="Formula or Rule"><Textarea rows={2} value={f.formula_or_rule} onChange={(e) => set("formula_or_rule", e.target.value)} /></Field>
      </div>

      {f.question_type === "mcq" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Why A Wrong"><Input value={f.why_a_wrong} onChange={(e) => set("why_a_wrong", e.target.value)} /></Field>
          <Field label="Why B Wrong"><Input value={f.why_b_wrong} onChange={(e) => set("why_b_wrong", e.target.value)} /></Field>
          <Field label="Why C Wrong"><Input value={f.why_c_wrong} onChange={(e) => set("why_c_wrong", e.target.value)} /></Field>
          <Field label="Why D Wrong"><Input value={f.why_d_wrong} onChange={(e) => set("why_d_wrong", e.target.value)} /></Field>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" onClick={() => handleSave("review_needed")}>Save as Review Needed</Button>
        <Button onClick={() => handleSave("verified")}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Save as Verified
        </Button>
      </div>
    </Card>
  );
}

/* =============================== CSV Import =============================== */

const CSV_COLUMNS = [
  "exam_level","group","subject_name","paper","chapter_name","topic","question_type",
  "question_text","option_a","option_b","option_c","option_d","correct_answer",
  "explanation_bangla","explanation_english","common_mistake",
  "why_a_wrong","why_b_wrong","why_c_wrong","why_d_wrong",
  "formula_or_rule","board","year","source_type","verification_status","difficulty",
];

function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); lines.push(cur); }
  if (lines.length === 0) return [];
  const headers = lines[0].map((h) => h.trim());
  return lines.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (row[idx] ?? "").trim(); });
    return obj;
  });
}

function downloadCsvTemplate() {
  const sample1 = [
    "HSC","Science","Physics 1st Paper","1st","গতি","Kinematics","mcq",
    "একটি বস্তুর প্রাথমিক বেগ 0 এবং ত্বরণ 2 m/s²; 5 সেকেন্ডে দূরত্ব কত?",
    "10 m","25 m","20 m","15 m","25 m",
    "s = ut + ½at² সূত্র প্রয়োগ করে: s = 0 + ½ × 2 × 25 = 25 m",
    "Apply s = ut + ½at² → s = 25 m",
    "অনেকে v × t ব্যবহার করে ভুল করে",
    "u = 0 ধরা হয়নি","ত্বরণ বাদ পড়েছে","সময় বর্গ করা হয়নি","সূত্র ভুল",
    "s = ut + ½at²","Dhaka","2024","official_board","verified","medium",
  ];
  const sample2 = [
    "HSC","Science","Physics 1st Paper","1st","গতি","Kinematics","mcq",
    "AI Similar — একটি বস্তু 3 m/s² ত্বরণে স্থির অবস্থা থেকে 4 সেকেন্ডে কত দূরত্ব অতিক্রম করবে?",
    "12 m","18 m","24 m","30 m","24 m",
    "s = ½at² = ½ × 3 × 16 = 24 m",
    "Apply s = ½at²",
    "ত্বরণকে বেগ ভেবে ভুল করা",
    "u≠0 ধরা","সময় ভুল","ত্বরণ ভুল","সূত্র ভুল",
    "s = ut + ½at²","","","ai_generated","verified","medium",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [CSV_COLUMNS.join(","), sample1.map(escape).join(","), sample2.map(escape).join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "board-questions-template.csv"; a.click();
  URL.revokeObjectURL(url);
}

function CsvImportTab() {
  const importFn = useServerFn(importBoardQuestionsCsv);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    setResult(null);
  };

  const validate = async () => {
    if (!rows.length) return;
    setRunning(true);
    try {
      const res = await importFn({ data: { rows, dry_run: true } });
      setResult(res);
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const importAll = async () => {
    if (!rows.length) return;
    setRunning(true);
    try {
      const res = await importFn({ data: { rows, dry_run: false } });
      setResult(res);
      toast.success(`Imported ${res.imported} questions`);
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const downloadErrors = () => {
    if (!result?.errors?.length) return;
    const lines = ["row,error", ...result.errors.map((e: any) => `${e.row},"${(e.error ?? "").replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "import-errors.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mt-4 space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={downloadCsvTemplate}>
          <Download className="mr-1 h-4 w-4" /> Download CSV Template
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
          <FileUp className="h-4 w-4" /> Choose CSV file
          <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {rows.length > 0 && <Badge variant="secondary">{rows.length} rows loaded</Badge>}
      </div>

      {rows.length > 0 && (
        <>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Preview (first 10 rows)</p>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Board</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="min-w-64">Question</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.subject_name}</TableCell>
                      <TableCell>{r.chapter_name}</TableCell>
                      <TableCell>{r.question_type}</TableCell>
                      <TableCell>{r.board}</TableCell>
                      <TableCell>{r.year}</TableCell>
                      <TableCell>{r.source_type}</TableCell>
                      <TableCell className="max-w-md truncate">{r.question_text}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={validate} disabled={running}>Validate</Button>
            <Button onClick={importAll} disabled={running}>Import Valid Rows</Button>
          </div>
        </>
      )}

      {result && (
        <Card className="space-y-2 border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-semibold">Import Summary</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Total" v={result.total} />
            <Stat label="Valid" v={result.valid_count} />
            <Stat label="Imported" v={result.imported} accent />
            <Stat label="Skipped" v={result.skipped} />
            <Stat label="Duplicates" v={result.duplicates} />
          </div>
          {result.errors?.length > 0 && (
            <div>
              <Button size="sm" variant="outline" onClick={downloadErrors}>
                <Download className="mr-1 h-3 w-3" /> Download Error Report
              </Button>
              <ul className="mt-2 max-h-40 overflow-auto space-y-1 text-xs">
                {result.errors.slice(0, 20).map((e: any, i: number) => (
                  <li key={i} className="text-red-700">Row {e.row}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
          {result.duplicates > 0 && (
            <p className="text-xs text-amber-700">
              {result.duplicates} duplicate rows were skipped (matching subject + chapter + question text + board + year).
            </p>
          )}
        </Card>
      )}
    </Card>
  );
}

function Stat({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-2 text-center ${accent ? "border-primary/40 bg-primary/10" : ""}`}>
      <div className="text-lg font-bold">{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/* ============================== Review Queue ============================== */

function ReviewQueueTab() {
  const list = useServerFn(listAdminBank);
  const verify = useServerFn(verifyBoardQuestion);
  const reject = useServerFn(rejectBoardQuestion);
  const del = useServerFn(deleteBoardQuestion);

  const q = useQuery({
    queryKey: ["admin-review"],
    queryFn: () => list({ data: { verification_status: "review_needed", limit: 100 } }),
  });

  const rows: any[] = q.data?.questions ?? [];

  const act = async (id: string, action: "verify" | "reject" | "delete") => {
    try {
      if (action === "verify") await verify({ data: { id, verified: true } });
      else if (action === "reject") await reject({ data: { id } });
      else await del({ data: { id } });
      toast.success(action === "verify" ? "Verified" : action === "reject" ? "Rejected" : "Deleted");
      q.refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="mt-4 space-y-3 p-5">
      <p className="text-sm text-muted-foreground">
        Questions awaiting verification. Verified questions appear to students immediately.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Review queue is empty.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <div className="mb-1 flex flex-wrap gap-1">
                {r.year && <Badge variant="outline">{r.year}</Badge>}
                {r.board && <Badge variant="secondary">{r.board}</Badge>}
                <Badge variant="outline" className="uppercase">{r.question_type}</Badge>
                <Badge variant="outline">{r.source_type}</Badge>
              </div>
              <p className="text-sm">{r.question_text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => act(r.id, "verify")}>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, "reject")}>
                  <XCircle className="mr-1 h-3 w-3" /> Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act(r.id, "delete")}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============================== Question Bank ============================= */

function QuestionBankTab() {
  const list = useServerFn(listAdminBank);
  const verify = useServerFn(verifyBoardQuestion);
  const del = useServerFn(deleteBoardQuestion);

  const { subjects, chapters, loadChapters } = useSubjectsAndChapters();
  const [filters, setFilters] = useState<any>({});
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-bank", filters, search],
    queryFn: () => list({ data: { ...filters, search: search || undefined, limit: 200 } }),
  });

  const rows: any[] = q.data?.questions ?? [];

  const setF = (k: string, v: any) => {
    setFilters((p: any) => {
      const next = { ...p };
      if (!v || v === "any") delete next[k]; else next[k] = v;
      return next;
    });
  };

  return (
    <Card className="mt-4 space-y-3 p-5">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Bk label="Subject">
          <Select value={filters.subject_id ?? "any"} onValueChange={(v) => { setF("subject_id", v); if (v !== "any") loadChapters(v); setF("chapter_id", undefined); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Bk>
        <Bk label="Chapter">
          <Select value={filters.chapter_id ?? "any"} onValueChange={(v) => setF("chapter_id", v)} disabled={!filters.subject_id}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Bk>
        <Bk label="Board">
          <Select value={filters.board ?? "any"} onValueChange={(v) => setF("board", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </Bk>
        <Bk label="Source">
          <Select value={filters.source_type ?? "any"} onValueChange={(v) => setF("source_type", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {SOURCE_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Bk>
        <Bk label="Status">
          <Select value={filters.verification_status ?? "any"} onValueChange={(v) => setF("verification_status", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {VERIFICATION.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Bk>
        <Bk label="Type">
          <Select value={filters.question_type ?? "any"} onValueChange={(v) => setF("question_type", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </Bk>
      </div>

      <Input placeholder="Search question text…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">Question</TableHead>
              <TableHead>Board</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-md truncate">{r.question_text}</TableCell>
                <TableCell>{r.board ?? "—"}</TableCell>
                <TableCell>{r.year ?? "—"}</TableCell>
                <TableCell className="uppercase">{r.question_type}</TableCell>
                <TableCell>{r.source_type}</TableCell>
                <TableCell>
                  <Badge variant={r.verification_status === "verified" ? "default" : "outline"}>
                    {r.verification_status}
                  </Badge>
                </TableCell>
                <TableCell>{r.priority_score ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.verification_status !== "verified" && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        await verify({ data: { id: r.id, verified: true } }); toast.success("Verified"); q.refetch();
                      }}>Verify</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm("Delete this question?")) return;
                      await del({ data: { id: r.id } }); toast.success("Deleted"); q.refetch();
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">No questions match these filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function Bk({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
