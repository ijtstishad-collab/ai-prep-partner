import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, History, BarChart3, Sparkles, Play, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QuickPractice } from "@/components/QuickPractice";
import { Button } from "@/components/ui/button";
import { toBnDigits } from "@/lib/bn";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type Subject = { id: string; name: string; name_bn: string | null };

type LastAttempt = {
  id: string;
  chapter_id: string | null;
  subject_id: string | null;
  score: number;
  total_questions: number;
  completed_at: string | null;
  chapters?: { name: string | null } | null;
};

const fromTable = (n: string) => (supabase.from as unknown as (name: string) => any)(n);

function Dashboard() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [presetSubject, setPresetSubject] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && profile && !profile.onboarded) nav({ to: "/onboarding" });
  }, [loading, user, profile, nav]);

  // Subjects strip
  useEffect(() => {
    if (!user) return;
    fromTable("subjects")
      .select("id, name, name_bn")
      .eq("is_active", true)
      .limit(8)
      .then(({ data }: { data: Subject[] | null }) => setSubjects(data ?? []));
  }, [user]);

  // Most recent attempt → resume / next chapter
  useEffect(() => {
    if (!user) return;
    fromTable("test_attempts")
      .select("id, chapter_id, subject_id, score, total_questions, completed_at, chapters(name)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .then(({ data }: { data: LastAttempt[] | null }) => setLastAttempt(data?.[0] ?? null));
  }, [user]);

  const studentName = profile?.full_name?.split(" ")[0] || "শিক্ষার্থী";

  const openQuick = (subjectId?: string | null) => {
    setPresetSubject(subjectId ?? null);
    setQuickOpen(true);
  };

  const resumeChapter = lastAttempt?.chapter_id ?? null;
  const lastChapterName = lastAttempt?.chapters?.name ?? null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[480px] px-5 py-8 sm:max-w-3xl sm:px-10 lg:max-w-5xl">
        {/* Greeting */}
        <header className="mb-6">
          <h1 className="exam-heading text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            স্বাগতম, {studentName}
          </h1>
          <p className="bn-label mt-1 text-sm opacity-60">
            Welcome back — pick a chapter and start practicing.
          </p>
        </header>

        {/* HERO: Quick Start */}
        <div className="paper-tile relative mb-4 overflow-hidden p-5 sm:p-6">
          <span className="serial-marker hidden sm:block">০১.</span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                <Zap className="h-3 w-3" />
                দ্রুত শুরু · Quick Start
              </div>
              <h2 className="exam-heading text-xl font-bold leading-tight sm:text-2xl">
                আজ কোন অধ্যায় অনুশীলন করবেন?
              </h2>
              <p className="bn-label mt-1 text-xs opacity-60">
                Subject → Chapter → Start. Two clicks.
              </p>
            </div>
            <Button
              size="lg"
              className="exam-heading shrink-0"
              onClick={() => openQuick()}
            >
              <Play className="mr-2 h-4 w-4" />
              অনুশীলন শুরু করুন
            </Button>
          </div>

          {/* Resume row */}
          {resumeChapter && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3">
              <div className="min-w-0 text-xs">
                <span className="opacity-60">সর্বশেষ · Last: </span>
                <span className="exam-heading font-bold">
                  {lastChapterName ?? "অনুশীলন"}
                </span>
                {lastAttempt && (
                  <span className="ml-2 opacity-60">
                    স্কোর {toBnDigits(lastAttempt.score)}/{toBnDigits(lastAttempt.total_questions)}
                  </span>
                )}
              </div>
              <Link
                to="/practice"
                search={{ chapterId: resumeChapter, mode: "chapter" as const }}
                className="exam-heading shrink-0 text-xs font-bold underline-offset-4 hover:underline"
              >
                আবার অনুশীলন →
              </Link>
            </div>
          )}
        </div>

        {/* Subject quick-pick chips */}
        <div className="paper-tile relative mb-4 p-5">
          <span className="serial-marker hidden sm:block">০২.</span>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="exam-heading text-sm font-bold">
              আপনার বিষয়সমূহ
              <span className="bn-label ml-2 text-[10px] font-normal opacity-60">
                Jump into a subject
              </span>
            </h3>
            <Link
              to="/subjects"
              className="text-[11px] underline-offset-4 hover:underline opacity-70"
            >
              সব দেখুন →
            </Link>
          </div>
          {subjects.length === 0 ? (
            <p className="text-xs opacity-60">কোনো বিষয় পাওয়া যায়নি।</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openQuick(s.id)}
                  className="group flex items-center justify-between gap-2 rounded border border-foreground/15 px-3 py-2.5 text-left transition hover:border-foreground/40 hover:bg-foreground/[0.02]"
                >
                  <span className="min-w-0">
                    <span className="exam-heading block truncate text-sm font-semibold leading-tight">
                      {s.name}
                    </span>
                    {s.name_bn && (
                      <span className="bn-label block truncate text-[10px] opacity-60">
                        {s.name_bn}
                      </span>
                    )}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Secondary tiles row */}
        <div className="grid grid-cols-3 gap-3">
          <SmallTile
            to="/analytics"
            icon={BarChart3}
            bn="ফলাফল"
            en="Analytics"
          />
          <SmallTile
            to="/history"
            icon={History}
            bn="ইতিহাস"
            en="History"
          />
          <SmallTile
            to="/mock-test"
            icon={Sparkles}
            bn="মক টেস্ট"
            en="Mock Test"
          />
        </div>

        {/* Footer notation */}
        <div className="mt-10 text-center">
          <p className="exam-heading text-[10px] italic opacity-40">
            বোর্ড মানদণ্ড অনুসারে অনুশীলন · Board-Standard Practice Interface
          </p>
        </div>
      </div>

      <QuickPractice
        open={quickOpen}
        onOpenChange={setQuickOpen}
        initialSubjectId={presetSubject}
      />
    </AppShell>
  );
}

function SmallTile({
  to,
  icon: Icon,
  bn,
  en,
}: {
  to: string;
  icon: typeof BookOpen;
  bn: string;
  en: string;
}) {
  return (
    <Link
      to={to}
      className="paper-tile flex flex-col items-start justify-between p-3 transition hover:border-foreground/40"
    >
      <Icon className="h-4 w-4 opacity-70" />
      <div className="mt-3">
        <p className="exam-heading text-xs font-bold leading-tight">{bn}</p>
        <p className="bn-label text-[10px] opacity-60">{en}</p>
      </div>
    </Link>
  );
}
