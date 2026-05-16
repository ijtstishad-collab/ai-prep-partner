import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck, Sparkles, Star } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [chunks, setChunks] = useState<any[]>([]);
  const [pastQs, setPastQs] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [generated, setGenerated] = useState<any[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [queueSubject, setQueueSubject] = useState<string>("all");
  const [queueStatus, setQueueStatus] = useState<string>("pending");
  const [queueReviewed, setQueueReviewed] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && !isAdmin) {
      toast.error("Admin access required");
      nav({ to: "/dashboard" });
    }
  }, [loading, user, isAdmin, nav]);

  const reload = async () => {
    const [s, c, q, u, ch, p, r, g] = await Promise.all([
      supabase.from("subjects").select("*").order("name"),
      supabase.from("chapters").select("*, subjects(name)").order("order_index"),
      supabase.from("questions").select("*, chapters(name, subjects(name))").order("created_at", { ascending: false }).limit(100),
      (supabase.from as any)("syllabus_units").select("*, chapters(name, subjects(name))").order("created_at", { ascending: false }),
      (supabase.from as any)("textbook_chunks").select("*, chapters(name, subjects(name))").order("created_at", { ascending: false }),
      (supabase.from as any)("past_questions").select("*, chapters(name, subjects(name))").order("created_at", { ascending: false }),
      (supabase.from as any)("generation_rules").select("*, subjects(name)").order("created_at", { ascending: false }),
      (supabase.from as any)("generated_questions").select("*, chapters(name, subjects(name))").order("created_at", { ascending: false }).limit(200),
    ]);
    setSubjects(s.data ?? []); setChapters(c.data ?? []); setQuestions(q.data ?? []);
    setUnits(u.data ?? []); setChunks(ch.data ?? []); setPastQs(p.data ?? []);
    setRules(r.data ?? []); setGenerated(g.data ?? []);
  };

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  const addSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("subjects").insert({
      name: String(fd.get("name")), name_bn: String(fd.get("name_bn")),
      slug: String(fd.get("slug")), icon: "BookOpen",
    });
    if (error) return toast.error(error.message);
    toast.success("Subject added"); (e.currentTarget as HTMLFormElement).reset(); reload();
  };

  const addChapter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("chapters").insert({
      subject_id: String(fd.get("subject_id")),
      name: String(fd.get("name")), name_bn: String(fd.get("name_bn")),
      order_index: Number(fd.get("order_index") ?? 0),
    });
    if (error) return toast.error(error.message);
    toast.success("Chapter added"); (e.currentTarget as HTMLFormElement).reset(); reload();
  };

  const addUnit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const chapterId = String(fd.get("chapter_id"));
    const ch = chapters.find((x) => x.id === chapterId);
    const { error } = await (supabase.from as any)("syllabus_units").insert({
      subject_id: ch?.subject_id, chapter_id: chapterId,
      title: String(fd.get("title")),
      title_bn: String(fd.get("title_bn") || ""),
      learning_objectives: String(fd.get("objectives") || "").split("\n").map((x) => x.trim()).filter(Boolean),
      keywords: String(fd.get("keywords") || "").split(",").map((x) => x.trim()).filter(Boolean),
    });
    if (error) return toast.error(error.message);
    toast.success("Syllabus unit added"); (e.currentTarget as HTMLFormElement).reset(); reload();
  };

  const addChunk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const chapterId = String(fd.get("chapter_id"));
    const ch = chapters.find((x) => x.id === chapterId);
    const { error } = await (supabase.from as any)("textbook_chunks").insert({
      subject_id: ch?.subject_id, chapter_id: chapterId,
      content: String(fd.get("content")),
      source: String(fd.get("source") || ""),
      page_ref: String(fd.get("page_ref") || ""),
    });
    if (error) return toast.error(error.message);
    toast.success("Textbook chunk added"); (e.currentTarget as HTMLFormElement).reset(); reload();
  };

  const addRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await (supabase.from as any)("generation_rules").insert({
      subject_id: String(fd.get("subject_id")),
      question_type: String(fd.get("question_type")),
      instructions: String(fd.get("instructions")),
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Rule added"); (e.currentTarget as HTMLFormElement).reset(); reload();
  };

  const uploadPastCsv = async (e: React.ChangeEvent<HTMLInputElement>, chapterId: string) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ch = chapters.find((x) => x.id === chapterId);
    if (!ch) return toast.error("Pick a chapter first");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines.shift()?.split(",").map((h) => h.trim().toLowerCase()) ?? [];
    const idx = (k: string) => header.indexOf(k);
    const rows = lines.map((line) => {
      const cells = parseCsvLine(line);
      return {
        subject_id: ch.subject_id,
        chapter_id: chapterId,
        year: idx("year") >= 0 ? Number(cells[idx("year")]) || null : null,
        board: idx("board") >= 0 ? cells[idx("board")] : null,
        question_type: (idx("question_type") >= 0 ? cells[idx("question_type")] : "mcq") || "mcq",
        difficulty: (idx("difficulty") >= 0 ? cells[idx("difficulty")] : "medium") || "medium",
        question_text: idx("question_text") >= 0 ? cells[idx("question_text")] : cells[0],
        answer: idx("answer") >= 0 ? cells[idx("answer")] : null,
      };
    }).filter((r) => r.question_text);
    const { error } = await (supabase.from as any)("past_questions").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} past questions`); e.target.value = ""; reload();
  };

  const reviewGenerated = async (q: any, action: "approve" | "reject", quality?: number) => {
    const updates: any = action === "approve" ? { status: "approved" } : { status: "rejected" };
    if (quality) updates.quality_score = quality;
    const { error } = await (supabase.from as any)("generated_questions").update(updates).eq("id", q.id);
    if (error) return toast.error(error.message);
    await (supabase.from as any)("question_reviews").insert({
      generated_question_id: q.id, reviewer_id: user!.id, action, quality_score: quality ?? null,
    });
    reload();
  };
  const toggleTeacherReviewed = async (q: any) => {
    const { error } = await (supabase.from as any)("generated_questions").update({ is_teacher_reviewed: !q.is_teacher_reviewed }).eq("id", q.id);
    if (error) return toast.error(error.message);
    reload();
  };
  const setQuality = async (q: any, score: number) => {
    const { error } = await (supabase.from as any)("generated_questions").update({ quality_score: score }).eq("id", q.id);
    if (error) return toast.error(error.message);
    reload();
  };
  const editGenerated = async (q: any) => {
    const text = prompt("Edit question text:", q.question_text);
    if (text === null) return;
    const ans = prompt("Edit correct answer:", q.correct_answer ?? "");
    if (ans === null) return;
    const { error } = await (supabase.from as any)("generated_questions")
      .update({ question_text: text, correct_answer: ans }).eq("id", q.id);
    if (error) return toast.error(error.message);
    await (supabase.from as any)("question_reviews").insert({
      generated_question_id: q.id, reviewer_id: user!.id, action: "edit",
    });
    toast.success("Updated"); reload();
  };

  const toggleReview = async (q: any) => {
    const { error } = await supabase.from("questions").update({ teacher_reviewed: !q.teacher_reviewed }).eq("id", q.id);
    if (error) return toast.error(error.message); reload();
  };
  const toggleApprove = async (q: any) => {
    const { error } = await supabase.from("questions").update({ is_approved: !q.is_approved }).eq("id", q.id);
    if (error) return toast.error(error.message); reload();
  };

  const filteredQs = filterSubject ? questions.filter((q) => q.chapters?.subjects?.name === filterSubject) : questions;

  const queueList = generated.filter((q) => {
    if (queueSubject !== "all" && q.chapters?.subjects?.name !== queueSubject) return false;
    if (queueStatus !== "all" && q.status !== queueStatus) return false;
    if (queueReviewed === "yes" && !q.is_teacher_reviewed) return false;
    if (queueReviewed === "no" && q.is_teacher_reviewed) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllQueue = () => setSelectedIds(new Set(queueList.map((q) => q.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const bulkAction = async (action: "approve" | "reject" | "mark_reviewed" | "unmark_reviewed") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return toast.error("Select at least one question");
    let updates: any = {};
    if (action === "approve") updates = { status: "approved" };
    else if (action === "reject") updates = { status: "rejected" };
    else if (action === "mark_reviewed") updates = { is_teacher_reviewed: true };
    else updates = { is_teacher_reviewed: false };
    const { error } = await (supabase.from as any)("generated_questions").update(updates).in("id", ids);
    if (error) return toast.error(error.message);
    if (action === "approve" || action === "reject") {
      await (supabase.from as any)("question_reviews").insert(
        ids.map((id) => ({ generated_question_id: id, reviewer_id: user!.id, action }))
      );
    }
    toast.success(`Updated ${ids.length} question${ids.length > 1 ? "s" : ""}`);
    clearSelection();
    reload();
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai-review">AI Review</TabsTrigger>
            <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
            <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
            <TabsTrigger value="textbook">Textbook</TabsTrigger>
            <TabsTrigger value="past">Past Questions</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="chapters">Chapters</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4"><div className="text-xs text-muted-foreground">Subjects</div><div className="text-2xl font-bold">{subjects.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Chapters</div><div className="text-2xl font-bold">{chapters.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Pending AI questions</div><div className="text-2xl font-bold">{generated.filter((q) => q.status === "pending").length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Approved AI questions</div><div className="text-2xl font-bold">{generated.filter((q) => q.status === "approved").length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Syllabus units</div><div className="text-2xl font-bold">{units.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Textbook chunks</div><div className="text-2xl font-bold">{chunks.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Past questions</div><div className="text-2xl font-bold">{pastQs.length}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Generation rules</div><div className="text-2xl font-bold">{rules.length}</div></Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-review" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Sparkles className="h-4 w-4" /> AI-generated questions awaiting review</p>
            {generated.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No AI-generated questions yet.</Card>}
            {generated.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{q.chapters?.subjects?.name} · {q.chapters?.name} · {q.difficulty} · {q.question_type}</div>
                    <p className="font-medium mt-1">{q.question_text}</p>
                    {q.options && Array.isArray(q.options) && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {(q.options as string[]).map((o) => (
                          <li key={o} className={`px-2 py-1 rounded border ${o === q.correct_answer ? "bg-success/10 border-success" : ""}`}>{o}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">Answer: {q.correct_answer}</p>
                    {q.explanation_bn && <p className="text-xs text-muted-foreground mt-1">ব্যাখ্যা: {q.explanation_bn}</p>}
                  </div>
                  <div className="flex flex-col gap-2 items-end min-w-48">
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge variant={q.status === "approved" ? "default" : q.status === "rejected" ? "destructive" : "secondary"}>{q.status}</Badge>
                      {q.is_teacher_reviewed && <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Reviewed</Badge>}
                      {q.quality_score && <Badge variant="outline"><Star className="h-3 w-3 mr-1" />{q.quality_score}/5</Badge>}
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setQuality(q, n)} aria-label={`Set quality ${n}`}>
                          <Star className={`h-4 w-4 ${q.quality_score && n <= q.quality_score ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Button size="sm" variant="outline" onClick={() => editGenerated(q)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleTeacherReviewed(q)}>{q.is_teacher_reviewed ? "Unmark" : "Mark Reviewed"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => reviewGenerated(q, "reject")}>Reject</Button>
                      <Button size="sm" onClick={() => reviewGenerated(q, "approve")}>Approve</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="review-queue" className="mt-4 space-y-3">
            <Card className="p-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>Subject</Label>
                  <select value={queueSubject} onChange={(e) => { setQueueSubject(e.target.value); clearSelection(); }} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="all">All subjects</option>
                    {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={queueStatus} onChange={(e) => { setQueueStatus(e.target.value); clearSelection(); }} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="pending">Pending approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div>
                  <Label>Teacher reviewed</Label>
                  <select value={queueReviewed} onChange={(e) => { setQueueReviewed(e.target.value); clearSelection(); }} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="all">Any</option>
                    <option value="yes">Reviewed</option>
                    <option value="no">Not reviewed</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedIds.size} of {queueList.length} selected
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={selectAllQueue}>Select all</Button>
                  <Button size="sm" variant="outline" onClick={clearSelection} disabled={selectedIds.size === 0}>Clear</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction("mark_reviewed")} disabled={selectedIds.size === 0}>Mark reviewed</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction("unmark_reviewed")} disabled={selectedIds.size === 0}>Unmark reviewed</Button>
                  <Button size="sm" variant="destructive" onClick={() => bulkAction("reject")} disabled={selectedIds.size === 0}>Bulk reject</Button>
                  <Button size="sm" onClick={() => bulkAction("approve")} disabled={selectedIds.size === 0}>Bulk approve</Button>
                </div>
              </div>
            </Card>

            {queueList.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No questions match these filters.</Card>}
            {queueList.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={selectedIds.has(q.id)}
                    onChange={() => toggleSelect(q.id)}
                    aria-label="Select question"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{q.chapters?.subjects?.name} · {q.chapters?.name} · {q.difficulty} · {q.question_type}</div>
                    <p className="font-medium mt-1">{q.question_text}</p>
                    <p className="text-sm text-muted-foreground mt-1">Answer: {q.correct_answer}</p>
                    <div className="flex gap-2 flex-wrap mt-2">
                      <Badge variant={q.status === "approved" ? "default" : q.status === "rejected" ? "destructive" : "secondary"}>{q.status}</Badge>
                      {q.is_teacher_reviewed && <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Reviewed</Badge>}
                      {q.quality_score && <Badge variant="outline"><Star className="h-3 w-3 mr-1" />{q.quality_score}/5</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>


            <Card className="p-4">
              <form onSubmit={addUnit} className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Chapter</Label>
                  <select name="chapter_id" required className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="">—</option>
                    {chapters.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} · {c.name}</option>)}
                  </select>
                </div>
                <div><Label>Title</Label><Input name="title" required /></div>
                <div><Label>Bangla title</Label><Input name="title_bn" /></div>
                <div><Label>Keywords (comma separated)</Label><Input name="keywords" /></div>
                <div className="md:col-span-2"><Label>Learning objectives (one per line)</Label><Textarea name="objectives" rows={3} /></div>
                <div className="md:col-span-2"><Button>Add Syllabus Unit</Button></div>
              </form>
            </Card>
            <div className="space-y-2">
              {units.map((u) => (
                <Card key={u.id} className="p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{u.chapters?.subjects?.name} · {u.chapters?.name}</div>
                  <div className="font-medium">{u.title}</div>
                  {u.keywords?.length > 0 && <div className="text-xs text-muted-foreground">Keywords: {u.keywords.join(", ")}</div>}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="textbook" className="mt-4 space-y-3">
            <Card className="p-4">
              <form onSubmit={addChunk} className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Chapter</Label>
                  <select name="chapter_id" required className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="">—</option>
                    {chapters.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} · {c.name}</option>)}
                  </select>
                </div>
                <div><Label>Source</Label><Input name="source" placeholder="NCTB Physics 1st paper" /></div>
                <div><Label>Page ref</Label><Input name="page_ref" /></div>
                <div className="md:col-span-2"><Label>Content</Label><Textarea name="content" rows={5} required /></div>
                <div className="md:col-span-2"><Button>Add Textbook Chunk</Button></div>
              </form>
            </Card>
            <div className="space-y-2">
              {chunks.map((c) => (
                <Card key={c.id} className="p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{c.chapters?.subjects?.name} · {c.chapters?.name} {c.source ? `· ${c.source}` : ""}</div>
                  <div className="line-clamp-3">{c.content}</div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="past" className="mt-4 space-y-3">
            <Card className="p-4 space-y-3">
              <div>
                <Label>CSV Upload (columns: question_text, answer, year, board, question_type, difficulty)</Label>
                <div className="flex gap-2 mt-1 items-end">
                  <select id="past-chapter" className="h-10 rounded-md border bg-background px-3 text-sm flex-1">
                    <option value="">Pick chapter…</option>
                    {chapters.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} · {c.name}</option>)}
                  </select>
                  <Input type="file" accept=".csv" onChange={(e) => {
                    const sel = (document.getElementById("past-chapter") as HTMLSelectElement).value;
                    uploadPastCsv(e, sel);
                  }} />
                </div>
              </div>
            </Card>
            <div className="space-y-2">
              {pastQs.map((p) => (
                <Card key={p.id} className="p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{p.chapters?.subjects?.name} · {p.chapters?.name} · {p.year ?? "?"} {p.board ?? ""} · {p.question_type}</div>
                  <div>{p.question_text}</div>
                  {p.answer && <div className="text-muted-foreground text-xs mt-1">Ans: {p.answer}</div>}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-4 space-y-3">
            <Card className="p-4">
              <form onSubmit={addRule} className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Subject</Label>
                  <select name="subject_id" required className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="">—</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Question Type</Label>
                  <select name="question_type" required className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="mcq">MCQ</option>
                    <option value="short">Short</option>
                    <option value="written">Written</option>
                  </select>
                </div>
                <div className="md:col-span-3"><Label>Instructions</Label><Textarea name="instructions" rows={3} required /></div>
                <div className="md:col-span-3"><Button>Add Rule</Button></div>
              </form>
            </Card>
            <div className="space-y-2">
              {rules.map((r) => (
                <Card key={r.id} className="p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{r.subjects?.name} · {r.question_type}</div>
                  <div>{r.instructions}</div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="questions" className="mt-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={filterSubject === "" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterSubject("")}>All</Badge>
              {subjects.map((s) => (
                <Badge key={s.id} variant={filterSubject === s.name ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterSubject(s.name)}>{s.name}</Badge>
              ))}
            </div>
            {filteredQs.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{q.chapters?.subjects?.name} · {q.chapters?.name} · {q.difficulty} · {q.question_type}</div>
                    <p className="font-medium mt-1">{q.question_text}</p>
                    <p className="text-sm text-muted-foreground mt-1">Answer: {q.correct_answer}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      {q.is_approved && <Badge className="bg-success text-success-foreground">Approved</Badge>}
                      {q.teacher_reviewed && <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" /> Reviewed</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleApprove(q)}>{q.is_approved ? "Unapprove" : "Approve"}</Button>
                      <Button size="sm" onClick={() => toggleReview(q)}>{q.teacher_reviewed ? "Unmark" : "Mark Reviewed"}</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="subjects" className="mt-4">
            <Card className="p-4 mb-4">
              <form onSubmit={addSubject} className="grid md:grid-cols-4 gap-2 items-end">
                <div><Label>Name</Label><Input name="name" required /></div>
                <div><Label>Bangla Name</Label><Input name="name_bn" /></div>
                <div><Label>Slug</Label><Input name="slug" required /></div>
                <Button>Add Subject</Button>
              </form>
            </Card>
            <div className="space-y-2">
              {subjects.map((s) => (
                <Card key={s.id} className="p-3 flex justify-between"><span>{s.name} <span className="text-muted-foreground text-sm">{s.name_bn}</span></span><span className="text-xs text-muted-foreground">{s.slug}</span></Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="chapters" className="mt-4">
            <Card className="p-4 mb-4">
              <form onSubmit={addChapter} className="grid md:grid-cols-5 gap-2 items-end">
                <div className="md:col-span-1">
                  <Label>Subject</Label>
                  <select name="subject_id" required className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="">—</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><Label>Name</Label><Input name="name" required /></div>
                <div><Label>Bangla</Label><Input name="name_bn" /></div>
                <div><Label>Order</Label><Input name="order_index" type="number" defaultValue={1} /></div>
                <Button>Add Chapter</Button>
              </form>
            </Card>
            <div className="space-y-2">
              {chapters.map((c) => (
                <Card key={c.id} className="p-3 flex justify-between text-sm"><span><strong>{c.subjects?.name}</strong> · {c.name}</span><span className="text-muted-foreground">#{c.order_index}</span></Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ""; }
      else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
