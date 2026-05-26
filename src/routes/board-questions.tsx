import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { allowedGroupsFor, subjectMatchesGroup } from "@/lib/student-group";
import { BookOpen, ChevronRight, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/board-questions")({ component: BoardQuestionsHub });

type Subject = {
  id: string;
  name: string;
  name_bn: string | null;
  paper: string | null;
  group_type: string | null;
};

type Chapter = {
  id: string;
  name: string;
  name_bn: string | null;
  subject_id: string;
};

type QCount = { chapter_id: string; count: number };

function BoardQuestionsHub() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: subs }, { data: chs }, { data: pqs }] = await Promise.all([
        (supabase.from("subjects") as any)
          .select("id,name,name_bn,paper,group_type")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        (supabase.from("chapters") as any)
          .select("id,name,name_bn,subject_id")
          .eq("is_active", true)
          .order("order_index", { ascending: true }),
        (supabase.from("past_questions") as any).select("chapter_id").eq("verification_status", "verified").limit(5000),
      ]);
      setSubjects((subs as Subject[]) ?? []);
      setChapters((chs as Chapter[]) ?? []);
      const m = new Map<string, number>();
      ((pqs as { chapter_id: string }[]) ?? []).forEach((r) =>
        m.set(r.chapter_id, (m.get(r.chapter_id) ?? 0) + 1),
      );
      setCounts(m);
      setLoading(false);
    })();
  }, []);

  const allowed = allowedGroupsFor(profile?.student_group);
  const filteredSubjects = useMemo(
    () =>
      subjects
        .filter((s) => subjectMatchesGroup(s, allowed))
        .filter((s) =>
          q
            ? s.name.toLowerCase().includes(q.toLowerCase()) ||
              (s.name_bn ?? "").includes(q)
            : true,
        ),
    [subjects, allowed, q],
  );

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Board Questions</h1>
        <p className="mt-1 text-muted-foreground">
          বিষয় ও অধ্যায় বেছে নিন — বছর, বোর্ড ও প্যাটার্ন অনুযায়ী প্রশ্ন অনুশীলন করুন।
        </p>

        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="বিষয় খুঁজুন · Search subject"
            className="pl-9"
          />
        </div>

        {loading ? (
          <Card className="mt-6 flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে…
          </Card>
        ) : (
          <div className="mt-6 space-y-6">
            {filteredSubjects.map((s) => {
              const subjectChapters = chapters.filter((c) => c.subject_id === s.id);
              const totalQs = subjectChapters.reduce(
                (acc, c) => acc + (counts.get(c.id) ?? 0),
                0,
              );
              return (
                <Card key={s.id} className="p-5">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold leading-tight">
                        {s.name}{" "}
                        {s.paper && (
                          <Badge variant="outline" className="ml-1">
                            {s.paper}
                          </Badge>
                        )}
                      </h2>
                      {s.name_bn && (
                        <p className="text-sm text-muted-foreground">{s.name_bn}</p>
                      )}
                    </div>
                    <Badge variant="secondary">{totalQs} verified Qs</Badge>
                  </div>

                  {subjectChapters.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      এই বিষয়ের জন্য এখনো কোনো অধ্যায় যোগ হয়নি।
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {subjectChapters.map((c) => (
                        <Link
                          key={c.id}
                          to="/chapters/$chapterId/board-questions"
                          params={{ chapterId: c.id }}
                          className="group flex items-center justify-between gap-2 rounded-lg border p-3 hover:border-primary"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            {c.name_bn && (
                              <p className="text-xs text-muted-foreground truncate">
                                {c.name_bn}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline">{counts.get(c.id) ?? 0}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            {filteredSubjects.length === 0 && (
              <Card className="p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">কোনো বিষয় পাওয়া যায়নি।</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
