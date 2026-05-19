import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BookOpenText, ChevronRight, GraduationCap, Loader2 } from "lucide-react";

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

function ChaptersPage() {
  const { subjectId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Chapters</p>
          <h1 className="mt-1 text-3xl font-bold">Choose a chapter for HSC practice</h1>
          <p className="mt-2 text-muted-foreground">
            Chapters are loaded from Supabase for the selected subject.
          </p>
        </div>

        {authLoading ? (
          <Card className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking your student session...
          </Card>
        ) : !user ? (
          <Card className="p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold">Login required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Sign in to select a subject and load chapter-wise practice.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          </Card>
        ) : error ? (
          <Card className="p-6">
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
            <Card className="p-8 text-center">
              <BookOpenText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">No active subjects yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Add active HSC subjects in Supabase to choose chapters.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => (
                <Card key={subject.id} className="p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpenText className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold">{subject.name}</h2>
                  {subject.name_bn ? (
                    <p className="mt-1 text-sm text-muted-foreground">{subject.name_bn}</p>
                  ) : null}
                  <Button asChild className="mt-5 w-full" variant="outline">
                    <a href={`/chapters?subjectId=${subject.id}`}>
                      Show Chapters <ChevronRight className="h-4 w-4" />
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
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{selectedSubject?.name ?? "Selected subject"}</Badge>
              <Button asChild variant="ghost" size="sm">
                <Link to="/subjects">Change Subject</Link>
              </Button>
            </div>

            {chapters.length === 0 ? (
              <Card className="p-8 text-center">
                <BookOpenText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">No active chapters yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add active chapters for this subject in Supabase to make practice available.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {chapters.map((chapter, index) => (
                  <Card key={chapter.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <BookOpenText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            Chapter {chapter.order_index ?? index + 1}
                          </Badge>
                          {chapter.readiness_status ? (
                            <span className="text-xs text-muted-foreground">
                              {chapter.readiness_status}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 font-semibold">{chapter.name}</h2>
                        {chapter.name_bn ? (
                          <p className="mt-1 text-sm text-muted-foreground">{chapter.name_bn}</p>
                        ) : null}
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/practice?chapterId=${chapter.id}`}>
                          Practice <ChevronRight className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
