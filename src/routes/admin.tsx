import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && !isAdmin) {
      toast.error("Admin access required");
      nav({ to: "/dashboard" });
    }
  }, [loading, user, isAdmin, nav]);

  const reload = async () => {
    const [{ data: s }, { data: c }, { data: q }] = await Promise.all([
      supabase.from("subjects").select("*").order("name"),
      supabase.from("chapters").select("*, subjects(name)").order("order_index"),
      supabase.from("questions").select("*, chapters(name, subjects(name))").order("created_at", { ascending: false }).limit(100),
    ]);
    setSubjects(s ?? []); setChapters(c ?? []); setQuestions(q ?? []);
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

  const toggleReview = async (q: any) => {
    const { error } = await supabase.from("questions").update({ teacher_reviewed: !q.teacher_reviewed }).eq("id", q.id);
    if (error) return toast.error(error.message);
    reload();
  };
  const toggleApprove = async (q: any) => {
    const { error } = await supabase.from("questions").update({ is_approved: !q.is_approved }).eq("id", q.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const filteredQs = filterSubject ? questions.filter((q) => q.chapters?.subjects?.name === filterSubject) : questions;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs defaultValue="questions">
          <TabsList>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="chapters">Chapters</TabsTrigger>
          </TabsList>

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
