import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpenText,
  ChevronRight,
  GraduationCap,
  Loader2,
  FileText,
  Library,
  Sparkles,
  Shuffle,
} from "lucide-react";
import { toBnDigits } from "@/lib/bn";

export const Route = createFileRoute("/chapters")({
  validateSearch: (search: Record<string, unknown>) => ({
    subjectId: typeof search.subjectId === "string" ? search.subjectId : undefined,
  }),
  component: ChaptersPage,
});

type Subject = {
  id: string;
  name: string;
  name_bn: string | null;
  slug: string;
  sort_order?: number | null;
};

type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  name_bn: string | null;
  order_index: number | null;
  readiness_status: string | null;
};

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

const sortSubjects = (items: Subject[]) =>
  [...items].sort((a, b) => {
    const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });

const practiceModes = [
  {
    key: "chapter",
    title: "Chapter Practice",
    bn: "অধ্যায়ভিত্তিক প্র্যাকটিস",
    desc: "Approved MCQs from this chapter.",
    icon: FileText,
  },
  {
    key: "board",
    title: "Past Board Questions",
    bn: "বোর্ড প্রশ্ন",
    desc: "Previously asked board MCQs (when available).",
    icon: Library,
  },
  {
    key: "ai",
    title: "AI Generated",
    bn: "এআই প্রশ্ন",
    desc: "Fresh questions generated for this chapter.",
    icon: Sparkles,
  },
  {
    key: "mixed",
    title: "Mixed Exam Prep",
    bn: "মিশ্র প্রস্তুতি",
    desc: "A mix of board + chapter + AI items.",
    icon: Shuffle,
  },
] as const;

function ChaptersPage() {
  const { subjectId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId) ?? null,
    [subjectId, subjects],
  );

  useEffect(() => {
    if (!user) return;

    let alive = true;

    async function loadSubjects() {
      setSubjectsLoading(true);
      setError(null);

      let { data, error: queryError } = (await fromTable("subjects")
        .select("id, name, name_bn, slug, sort_order")
        .eq("is_active", true)) as { data: Subject[] | null; error: Error | null };

      if (queryError && /sort_order|t_order/i.test(queryError.message)) {
        const fallback = (await fromTable("subjects")
          .select("id, name, name_bn, slug")
          .eq("is_active", true)) as { data: Subject[] | null; error: Error | null };
        data = fallback.data;
        queryError = fallback.error;
      }

      if (!alive) return;

      if (queryError) {
        setError(queryError.message);
        setSubjects([]);
      } else {
        setSubjects(sortSubjects(data ?? []));
      }
      setSubjectsLoading(false);
    }

    loadSubjects();

    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !subjectId) {
      setChapters([]);
      return;
    }

    let alive = true;
    setChaptersLoading(true);
    setError(null);
    setActiveChapter(null);

    fromTable("chapters")
      .select("id, subject_id, name, name_bn, order_index, readiness_status")
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .order("order_index", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error: queryError }: { data: Chapter[] | null; error: Error | null }) => {
        if (!alive) return;
        if (queryError) {
          setError(queryError.message);
          setChapters([]);
        } else {
          setChapters(data ?? []);
        }
        setChaptersLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [subjectId, user]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link to="/subjects" className="hover:text-foreground">Subjects</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">
            {selectedSubject?.name ?? "Chapters"}
          </span>
        </nav>

        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium text-primary">Step 2 · অধ্যায় নির্বাচন</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold">
            {selectedSubject ? selectedSubject.name : "Choose a subject"}
          </h1>
          {selectedSubject?.name_bn ? (
            <p className="mt-1 text-muted-foreground">{selectedSubject.name_bn}</p>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Pick a subject from the list, then choose a chapter and a practice mode.
            </p>
          )}
        </div>

        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking your student session…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">Login required</h2>
            <Button asChild className="mt-4">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          </Card>
        ) : error ? (
          <Card className="paper-sheet p-6">
            <h2 className="font-semibold text-destructive">Could not load chapters</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : !subjectId ? (
          subjectsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Card key={item} className="h-36 animate-pulse bg-muted/50" />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <Card className="paper-sheet p-8 text-center">
              <BookOpenText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="exam-heading text-xl font-semibold">No active subjects yet</h2>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <Card key={subject.id} className="paper-sheet p-5">
                  <h2 className="exam-heading text-lg font-semibold">{subject.name}</h2>
                  {subject.name_bn ? (
                    <p className="mt-1 text-sm text-muted-foreground">{subject.name_bn}</p>
                  ) : null}
                  <Button asChild className="mt-5 w-full" variant="outline">
                    <a href={`/chapters?subjectId=${subject.id}`}>
                      Show Chapters <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                </Card>
              ))}
            </div>
          )
        ) : subjectsLoading || chaptersLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <Card key={item} className="h-32 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{selectedSubject?.name ?? "Selected subject"}</Badge>
              <Badge variant="outline">
                {toBnDigits(chapters.length)} অধ্যায় · {chapters.length} chapters
              </Badge>
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link to="/subjects">Change Subject</Link>
              </Button>
            </div>

            {chapters.length === 0 ? (
              <Card className="paper-sheet p-8 text-center">
                <BookOpenText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="exam-heading text-xl font-semibold">No active chapters yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Chapters for this subject will appear here once activated.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {chapters.map((chapter, index) => {
                  const isActive = activeChapter?.id === chapter.id;
                  return (
                    <Card
                      key={chapter.id}
                      className={`paper-sheet p-5 transition ${
                        isActive ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="omr-bubble shrink-0">
                          {toBnDigits(chapter.order_index ?? index + 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="exam-heading font-semibold leading-tight">
                            {chapter.name}
                          </h2>
                          {chapter.name_bn ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {chapter.name_bn}
                            </p>
                          ) : null}
                          {chapter.readiness_status ? (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {chapter.readiness_status}
                            </Badge>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          onClick={() => setActiveChapter(isActive ? null : chapter)}
                        >
                          {isActive ? "Selected" : "Select"}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Practice mode picker — appears once a chapter is selected */}
            {activeChapter ? (
              <Card className="paper-sheet mt-6 p-6">
                <div className="paper-rule -mx-6 -mt-6 mb-5 px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Step 3 · প্রস্তুতি মোড
                      </p>
                      <h2 className="exam-heading text-lg font-semibold">
                        Pick a practice mode for: {activeChapter.name}
                      </h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveChapter(null)}>
                      Change chapter
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {practiceModes.map(({ key, title, bn, desc, icon: Icon }) => (
                    <a
                      key={key}
                      href={`/practice?chapterId=${activeChapter.id}&mode=${key}`}
                      className="group rounded-lg border bg-white p-4 transition hover:border-primary hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{title}</div>
                          <div className="text-xs text-muted-foreground">{bn}</div>
                          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                      </div>
                    </a>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
