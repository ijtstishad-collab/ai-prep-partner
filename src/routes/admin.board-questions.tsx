import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertBoardQuestion,
  verifyBoardQuestion,
  mergeIntoPattern,
  listBoardQuestions,
  BOARDS,
} from "@/lib/board-questions.functions";

export const Route = createFileRoute("/admin/board-questions")({
  component: AdminBoardQuestionsPage,
});

const QUESTION_TYPES = ["mcq", "cq", "short", "grammar", "writing"];

const fromTable = (n: string) => (supabase.from as unknown as (s: string) => any)(n);

function AdminBoardQuestionsPage() {
  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <h1 className="exam-heading mb-1 text-2xl font-bold">Board Questions Admin</h1>
        <p className="mb-5 text-sm text-muted-foreground">Upload, verify, and merge similar questions into patterns.</p>

        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="verify">Verify & Merge</TabsTrigger>
          </TabsList>
          <TabsContent value="upload"><UploadTab /></TabsContent>
          <TabsContent value="verify"><VerifyMergeTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function useSubjectsAndChapters() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  useEffect(() => {
    fromTable("subjects").select("id, name, name_bn, group_type").eq("is_active", true).then(({ data }: any) => setSubjects(data ?? []));
  }, []);
  const loadChapters = async (subjectId: string) => {
    const { data } = await fromTable("chapters").select("id, name, name_bn").eq("subject_id", subjectId).eq("is_active", true).order("order_index");
    setChapters(data ?? []);
  };
  return { subjects, chapters, loadChapters };
}

function UploadTab() {
  const { subjects, chapters, loadChapters } = useSubjectsAndChapters();
  const upsert = useServerFn(upsertBoardQuestion);

  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [form, setForm] = useState({
    question_text: "", answer: "", explanation_bn: "", year: "", board: "",
    exam_level: "", paper: "", topic: "", question_type: "mcq",
    source_type: "official_board", verification_status: "verified",
    options_csv: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!subjectId || !chapterId || !form.question_text.trim()) {
      toast.error("Subject, chapter & question text are required");
      return;
    }
    try {
      const options = form.question_type === "mcq" && form.options_csv
        ? form.options_csv.split("|").map((s) => s.trim()).filter(Boolean)
        : undefined;
      await upsert({
        data: {
          chapter_id: chapterId,
          subject_id: subjectId,
          question_text: form.question_text,
          answer: form.answer || undefined,
          explanation_bn: form.explanation_bn || undefined,
          year: form.year ? parseInt(form.year) : undefined,
          board: form.board || undefined,
          exam_level: (form.exam_level || undefined) as any,
          paper: form.paper || undefined,
          topic: form.topic || undefined,
          question_type: form.question_type,
          source_type: form.source_type,
          verification_status: form.verification_status,
          options,
        },
      });
      toast.success("Question uploaded");
      setForm({ ...form, question_text: "", answer: "", explanation_bn: "", options_csv: "", topic: "" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  return (
    <Card className="mt-4 space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
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
        <Field label="Exam Level">
          <Select value={form.exam_level} onValueChange={(v) => set("exam_level", v)}>
            <SelectTrigger><SelectValue placeholder="SSC/HSC" /></SelectTrigger>
            <SelectContent><SelectItem value="SSC">SSC</SelectItem><SelectItem value="HSC">HSC</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Paper"><Input value={form.paper} onChange={(e) => set("paper", e.target.value)} placeholder="1st / 2nd" /></Field>
        <Field label="Year"><Input value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="2023" /></Field>
        <Field label="Board">
          <Select value={form.board} onValueChange={(v) => set("board", v)}>
            <SelectTrigger><SelectValue placeholder="Select board" /></SelectTrigger>
            <SelectContent>{BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Topic"><Input value={form.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
        <Field label="Question Type">
          <Select value={form.question_type} onValueChange={(v) => set("question_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Source">
          <Select value={form.source_type} onValueChange={(v) => set("source_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="official_board">Official Board</SelectItem>
              <SelectItem value="test_paper">Test Paper</SelectItem>
              <SelectItem value="model_test">Model Test</SelectItem>
              <SelectItem value="ai_generated">AI Generated</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Verification">
          <Select value={form.verification_status} onValueChange={(v) => set("verification_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="review_needed">Review Needed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Question Text">
        <Textarea rows={3} value={form.question_text} onChange={(e) => set("question_text", e.target.value)} />
      </Field>
      {form.question_type === "mcq" && (
        <Field label="Options (separate with |)"><Input value={form.options_csv} onChange={(e) => set("options_csv", e.target.value)} placeholder="Option A | Option B | Option C | Option D" /></Field>
      )}
      <Field label="Correct Answer"><Input value={form.answer} onChange={(e) => set("answer", e.target.value)} /></Field>
      <Field label="Explanation (Bangla)">
        <Textarea rows={3} value={form.explanation_bn} onChange={(e) => set("explanation_bn", e.target.value)} />
      </Field>
      <Button onClick={submit}>Upload Question</Button>
    </Card>
  );
}

function VerifyMergeTab() {
  const { subjects, chapters, loadChapters } = useSubjectsAndChapters();
  const list = useServerFn(listBoardQuestions);
  const verify = useServerFn(verifyBoardQuestion);
  const merge = useServerFn(mergeIntoPattern);

  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [patternName, setPatternName] = useState("");
  const [patternNameBn, setPatternNameBn] = useState("");
  const [topicImp, setTopicImp] = useState("50");

  const q = useQuery({
    queryKey: ["admin-bq", chapterId],
    queryFn: () => list({ data: { chapter_id: chapterId } }),
    enabled: !!chapterId,
  });

  const rows: any[] = q.data?.questions ?? [];

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleVerify = async (id: string, v: boolean) => {
    await verify({ data: { id, verified: v } });
    toast.success(v ? "Verified" : "Marked review needed");
    q.refetch();
  };

  const handleMerge = async () => {
    if (!patternName || selected.size === 0 || !subjectId || !chapterId) {
      toast.error("Pattern name + at least one question required"); return;
    }
    try {
      await merge({
        data: {
          pattern: {
            chapter_id: chapterId, subject_id: subjectId,
            name: patternName, name_bn: patternNameBn || undefined,
            topic_importance: parseInt(topicImp) || 50,
          },
          question_ids: Array.from(selected),
        },
      });
      toast.success("Merged into pattern");
      setSelected(new Set());
      setPatternName(""); setPatternNameBn("");
      q.refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="mt-4 space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject">
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); loadChapters(v); setChapterId(""); }}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Chapter">
          <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>

      {chapterId && (
        <>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1">
                    {r.year && <Badge variant="outline">{r.year}</Badge>}
                    {r.board && <Badge variant="secondary">{r.board}</Badge>}
                    <Badge variant="outline" className="uppercase">{r.question_type}</Badge>
                    {r.verification_status === "review_needed" && <Badge className="bg-amber-100 text-amber-700">Review Needed</Badge>}
                  </div>
                  <p>{r.question_text}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleVerify(r.id, r.verification_status !== "verified")}>
                  {r.verification_status === "verified" ? "Unverify" : "Verify"}
                </Button>
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No questions for this chapter yet.</p>}
          </div>

          {selected.size > 0 && (
            <Card className="space-y-3 border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold">Merge {selected.size} questions into a pattern</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Pattern name (English)" value={patternName} onChange={(e) => setPatternName(e.target.value)} />
                <Input placeholder="Pattern name (Bangla)" value={patternNameBn} onChange={(e) => setPatternNameBn(e.target.value)} />
                <Input placeholder="Topic importance 0-100" value={topicImp} onChange={(e) => setTopicImp(e.target.value)} />
              </div>
              <Button onClick={handleMerge}>Create Pattern & Merge</Button>
            </Card>
          )}
        </>
      )}
    </Card>
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
