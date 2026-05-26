import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/resources")({ component: ResourcesPage });

type Subject = { id: string; name: string; name_bn: string | null };
type Resource = {
  id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  resource_type: string;
  paper: string | null;
  source_url: string | null;
  page_reference: string | null;
  mvp_use: string[];
  status: string;
};

const TYPES = [
  { value: "textbook", label: "Textbook" },
  { value: "guide", label: "Guide" },
  { value: "test_paper", label: "Test Paper" },
  { value: "mcq_suggestion", label: "MCQ Suggestion" },
  { value: "question_bank", label: "Question Bank" },
  { value: "solution_book", label: "Solution Book" },
  { value: "admission_prep", label: "Admission Prep" },
  { value: "external_link", label: "External Link" },
];

function ResourcesPage() {
  const { user, isAdmin } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rs }, { data: ss }] = await Promise.all([
      supabase.from("resources").select("*").order("created_at", { ascending: false }),
      supabase.from("subjects").select("id, name, name_bn").eq("is_active", true),
    ]);
    setResources((rs ?? []) as Resource[]);
    setSubjects((ss ?? []) as Subject[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (subjectFilter !== "all" && r.subject_id !== subjectFilter) return false;
      if (typeFilter !== "all" && r.resource_type !== typeFilter) return false;
      if (query && !`${r.title} ${r.description ?? ""}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [resources, subjectFilter, typeFilter, query]);

  const subjectName = (id: string | null) =>
    subjects.find((s) => s.id === id)?.name ?? "—";

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Resource Bank</h1>
            <p className="mt-1 text-muted-foreground">
              HSC textbooks, guides, test papers, MCQ suggestions, and admission question banks.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> Add resource
                </Button>
              </DialogTrigger>
              <ResourceFormDialog
                subjects={subjects}
                onSaved={() => {
                  setOpen(false);
                  void load();
                }}
              />
            </Dialog>
          )}
        </div>

        <Card className="mb-4 grid gap-3 p-4 md:grid-cols-4">
          <Input
            placeholder="Search title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground self-center">
            {filtered.length} of {resources.length}
          </div>
        </Card>

        {loading ? (
          <Card className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No resources yet. {isAdmin ? "Add the first one above." : "Check back soon."}
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <Card key={r.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{r.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {subjectName(r.subject_id)} · {TYPES.find((t) => t.value === r.resource_type)?.label}
                      {r.paper ? ` · ${r.paper}` : ""}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(r.id)}
                      aria-label="delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {r.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {r.mvp_use.includes("ai_training") && (
                    <Badge variant="secondary">Use for AI Training</Badge>
                  )}
                  {r.mvp_use.includes("practice") && (
                    <Badge variant="secondary">Use for Practice</Badge>
                  )}
                  <Badge variant={r.status === "approved" ? "default" : "outline"}>
                    {r.status}
                  </Badge>
                </div>
                {r.source_url && (
                  <Button asChild variant="outline" size="sm" className="mt-1 w-fit">
                    <a href={r.source_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3 w-3" /> Source
                    </a>
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ResourceFormDialog({
  subjects,
  onSaved,
}: {
  subjects: Subject[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [type, setType] = useState<string>("textbook");
  const [paper, setPaper] = useState("");
  const [url, setUrl] = useState("");
  const [pageRef, setPageRef] = useState("");
  const [aiTraining, setAiTraining] = useState(true);
  const [practice, setPractice] = useState(true);
  const [status, setStatus] = useState("approved");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const mvp_use: string[] = [];
    if (aiTraining) mvp_use.push("ai_training");
    if (practice) mvp_use.push("practice");
    const { error } = await supabase.from("resources").insert({
      title: title.trim(),
      description: description.trim() || null,
      subject_id: subjectId || null,
      resource_type: type,
      paper: paper.trim() || null,
      source_url: url.trim() || null,
      page_reference: pageRef.trim() || null,
      mvp_use,
      status,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Resource added");
      onSaved();
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Add resource</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Paper</Label>
            <Input
              placeholder="e.g. 1st paper"
              value={paper}
              onChange={(e) => setPaper(e.target.value)}
            />
          </div>
          <div>
            <Label>Page reference</Label>
            <Input value={pageRef} onChange={(e) => setPageRef(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Source URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={aiTraining}
              onChange={(e) => setAiTraining(e.target.checked)}
            />
            Use for AI Training
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={practice}
              onChange={(e) => setPractice(e.target.checked)}
            />
            Use for Practice
          </label>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save resource"}
        </Button>
      </div>
    </DialogContent>
  );
}
