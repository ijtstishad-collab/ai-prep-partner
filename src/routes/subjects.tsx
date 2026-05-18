import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ChevronRight, GraduationCap, Loader2 } from "lucide-react";

export const Route = createFileRoute("/subjects")({ component: SubjectsPage });

type Subject = {
  id: string;
  name: string;
  name_bn: string | null;
  slug: string;
  icon: string | null;
  sort_order: number | null;
};

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

function SubjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let alive = true;
    setLoading(true);
    setError(null);

    fromTable("subjects")
      .select("id, name, name_bn, slug, icon, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error: queryError }: { data: Subject[] | null; error: Error | null }) => {
        if (!alive) return;
        if (queryError) {
          setError(queryError.message);
          setSubjects([]);
        } else {
          setSubjects(data ?? []);
        }
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">HSC Subjects</p>
          <h1 className="mt-1 text-3xl font-bold">Choose a subject to begin practice</h1>
          <p className="mt-2 text-muted-foreground">
            Subjects are loaded from Supabase and filtered through row-level security.
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
              Sign in as a student to load HSC subjects and start chapter-wise practice.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Login / Sign up</Link>
            </Button>
          </Card>
        ) : error ? (
          <Card className="p-6">
            <h2 className="font-semibold text-destructive">Could not load subjects</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Card key={item} className="h-40 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No active subjects yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add active HSC subjects in Supabase to make them available here.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <Card key={subject.id} className="p-5">
                <div className="flex h-full flex-col">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary">HSC</Badge>
                  </div>
                  <div className="min-h-[72px]">
                    <h2 className="text-xl font-semibold">{subject.name}</h2>
                    {subject.name_bn ? (
                      <p className="mt-1 text-sm text-muted-foreground">{subject.name_bn}</p>
                    ) : null}
                  </div>
                  <Button asChild className="mt-5 w-full" variant="outline">
                    <a href={`/chapters?subjectId=${subject.id}`}>
                      View Chapters <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
