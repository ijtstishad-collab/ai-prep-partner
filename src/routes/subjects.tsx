import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ChevronRight, GraduationCap, Loader2 } from "lucide-react";
import { toBnDigits } from "@/lib/bn";
import { QuickPractice } from "@/components/QuickPractice";

export const Route = createFileRoute("/subjects")({ component: SubjectsPage });

type Subject = {
  id: string;
  name: string;
  name_bn: string | null;
  slug: string;
  icon: string | null;
  sort_order?: number | null;
};

const fromTable = (tableName: string) =>
  (supabase.from as unknown as (name: string) => any)(tableName);

const sortSubjects = (items: Subject[]) =>
  [...items].sort((a, b) => {
    const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });

// Heuristic group classification from subject name (UI only).
const groupOf = (name: string): { label: string; bn: string } => {
  const n = name.toLowerCase();
  if (/(phys|chem|bio|math|stat|comp|ict|higher math)/.test(n))
    return { label: "Science", bn: "বিজ্ঞান" };
  if (/(account|business|finance|management|marketing|production|econ)/.test(n))
    return { label: "Business Studies", bn: "ব্যবসায় শিক্ষা" };
  if (/(history|civic|logic|geog|sociology|islam|psych|arts)/.test(n))
    return { label: "Humanities", bn: "মানবিক" };
  return { label: "HSC", bn: "এইচএসসি" };
};

function SubjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [presetSubject, setPresetSubject] = useState<string | null>(null);

  const openQuick = (subjectId: string) => {
    setPresetSubject(subjectId);
    setQuickOpen(true);
  };

  useEffect(() => {
    if (!user) return;

    let alive = true;

    async function loadSubjects() {
      setLoading(true);
      setError(null);

      let { data, error: queryError } = (await fromTable("subjects")
        .select("id, name, name_bn, slug, icon, sort_order")
        .eq("is_active", true)) as { data: Subject[] | null; error: Error | null };

      if (queryError && /sort_order|t_order/i.test(queryError.message)) {
        const fallback = (await fromTable("subjects")
          .select("id, name, name_bn, slug, icon")
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
      setLoading(false);
    }

    loadSubjects();

    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">
            ড্যাশবোর্ড
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">এইচএসসি বিষয়সমূহ</span>
        </nav>

        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium text-primary">ধাপ ১ · বিষয় নির্বাচন</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold">আপনার বিষয় বেছে নিন</h1>
          <p className="mt-2 text-muted-foreground">
            বিজ্ঞান · ব্যবসায় শিক্ষা · মানবিক — বিভাগ অনুসারে সাজানো, দ্রুত খুঁজে পাওয়া যায়।
          </p>
        </div>

        {authLoading ? (
          <Card className="paper-sheet flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            সেশন যাচাই হচ্ছে…
          </Card>
        ) : !user ? (
          <Card className="paper-sheet p-8 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h2 className="exam-heading text-xl font-semibold">লগইন প্রয়োজন</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              বিষয় দেখতে শিক্ষার্থী হিসেবে লগইন করুন।
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">লগইন / সাইন আপ</Link>
            </Button>
          </Card>
        ) : error ? (
          <Card className="paper-sheet p-6">
            <h2 className="font-semibold text-destructive">বিষয় লোড করা যায়নি</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Card key={item} className="h-40 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <Card className="paper-sheet p-8 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="exam-heading text-xl font-semibold">এখনো কোনো বিষয় সক্রিয় নয়</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              বিষয় সক্রিয় হলে এখানে দেখা যাবে।
            </p>
          </Card>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {toBnDigits(subjects.length)} টি বিষয় পাওয়া গেছে
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject, idx) => {
                const group = groupOf(subject.name);
                return (
                  <Card key={subject.id} className="paper-sheet p-5">
                    {/* Paper "header" stripe */}
                    <div className="paper-rule -mx-5 -mt-5 mb-4 flex items-center justify-between px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <span>{group.label} · {group.bn}</span>
                      <span>বিষয় {toBnDigits(idx + 1)}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-foreground">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="exam-heading text-lg font-semibold leading-tight">
                          {subject.name}
                        </h2>
                        {subject.name_bn ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{subject.name_bn}</p>
                        ) : null}
                      </div>
                      <Badge variant="outline">HSC</Badge>
                    </div>
                    <Button className="mt-5 w-full" onClick={() => openQuick(subject.id)}>
                      অনুশীলন শুরু করুন <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
      <QuickPractice
        open={quickOpen}
        onOpenChange={setQuickOpen}
        initialSubjectId={presetSubject}
      />
    </AppShell>
  );
}
