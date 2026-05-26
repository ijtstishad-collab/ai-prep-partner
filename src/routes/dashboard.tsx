import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toBnDigits } from "@/lib/bn";
import { getDashboardData } from "@/lib/dashboard.functions";
import {
  CalendarClock,
  Target,
  History,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Trophy,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const fetchDash = useServerFn(getDashboardData);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && profile && !profile.onboarded) nav({ to: "/onboarding" });
  }, [loading, user, profile, nav]);

  const q = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDash(),
    enabled: !!user,
  });

  const data = q.data;
  const studentName = profile?.full_name?.split(" ")[0] || "শিক্ষার্থী";
  const examYear = (data?.profile as any)?.target_exam_year ?? profile?.target_exam_year ?? 2026;
  const examDate = (data?.profile as any)?.exam_date ?? null;
  const daysLeft = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const rec = data?.recommended;

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {/* Greeting */}
        <header className="mb-5">
          <h1 className="exam-heading text-2xl font-bold sm:text-3xl">স্বাগতম, {studentName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">আজকের প্রস্তুতি শুরু করুন।</p>
        </header>

        {/* Row 1: Countdown + Today Recommended */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {/* Countdown */}
          <Card className="p-4 md:col-span-1">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> HSC Countdown
            </div>
            {daysLeft !== null ? (
              <>
                <div className="exam-heading text-3xl font-bold">{toBnDigits(daysLeft)} দিন</div>
                <p className="mt-1 text-xs text-muted-foreground">HSC {toBnDigits(examYear)} বাকি</p>
              </>
            ) : (
              <>
                <div className="exam-heading text-lg font-bold">HSC {toBnDigits(examYear)} প্রস্তুতি চলছে</div>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/profile">Exam date সেট করুন</Link>
                </Button>
              </>
            )}
          </Card>

          {/* Today's Recommended (HERO) */}
          <Card className="border-primary/30 bg-primary/[0.03] p-5 md:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Target className="h-3.5 w-3.5" /> আজকের ফোকাস
            </div>
            {q.isLoading ? (
              <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>
            ) : rec?.chapter ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {rec.chapter.subjects?.name ?? ""}
                  {rec.chapter.subjects?.paper ? ` · ${rec.chapter.subjects.paper}` : ""}
                </p>
                <h2 className="exam-heading mt-0.5 text-xl font-bold">{rec.chapter.name}</h2>
                {rec.chapter.name_bn && (
                  <p className="text-sm text-muted-foreground">{rec.chapter.name_bn}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {(data?.profile as any)?.board ? `${(data!.profile as any).board} Board` : "All Boards"}
                  </Badge>
                  {rec.bqCount > 0 ? (
                    <Badge className="text-[10px]">{toBnDigits(rec.bqCount)}টি Board Question</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">AI Practice</Badge>
                  )}
                  {rec.source === "weak_subject" && (
                    <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
                      Weak Subject
                    </Badge>
                  )}
                </div>
                <Button asChild className="mt-3">
                  <Link
                    to="/chapters/$chapterId"
                    params={{ chapterId: rec.chapter.id }}
                  >
                    আজকের Practice শুরু করুন <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <h2 className="exam-heading text-base font-semibold">শুরু করার জন্য একটি বিষয় বাছুন</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Onboarding-এ weak subject সেট করলে এখানে recommendation দেখানো হবে।
                </p>
                <Button asChild className="mt-3" variant="outline">
                  <Link to="/subjects">বিষয় দেখুন</Link>
                </Button>
              </>
            )}
          </Card>
        </div>

        {/* Row 2: Continue + Recent Performance */}
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> সর্বশেষ অধ্যায়
            </div>
            {data?.lastAttempt?.chapter_id ? (
              <>
                <p className="exam-heading text-base font-semibold">
                  {data.lastAttempt.chapters?.name ?? "অধ্যায়"}
                </p>
                <p className="text-xs text-muted-foreground">
                  স্কোর {toBnDigits(Math.round(Number(data.lastAttempt.score)))}/
                  {toBnDigits(data.lastAttempt.total_questions)}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/chapters/$chapterId" params={{ chapterId: data.lastAttempt.chapter_id }}>
                    আবার practice
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                আপনি এখনো কোনো chapter শুরু করেননি।
              </p>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> সাম্প্রতিক পারফরম্যান্স
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="মোট" value={data?.totalAttempted ?? 0} />
              <Stat label="শুদ্ধতা" value={`${toBnDigits(data?.accuracy ?? 0)}%`} />
              <Stat label="Revision" value={data?.revisionCount ?? 0} />
              <Stat label="৭ দিন" value={data?.last7Count ?? 0} />
            </div>
          </Card>
        </div>

        {/* Row 3: Weak Chapters */}
        <Card className="mb-4 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> দুর্বল অধ্যায়
          </div>
          {(data?.totalAttempted ?? 0) < 20 ? (
            <p className="text-sm text-muted-foreground">
              ২০টি প্রশ্ন practice করলে weak chapter দেখা যাবে। এখন পর্যন্ত: {toBnDigits(data?.totalAttempted ?? 0)}।
            </p>
          ) : data?.weakChapters?.length ? (
            <div className="space-y-2">
              {data.weakChapters.map((c) => (
                <Link
                  key={c.id}
                  to="/chapters/$chapterId"
                  params={{ chapterId: c.id }}
                  className="flex items-center justify-between rounded-md border p-2 text-sm hover:border-foreground/40"
                >
                  <span className="exam-heading font-medium">{c.name}</span>
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    {toBnDigits(c.accuracy)}% শুদ্ধ
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">কোনো দুর্বল অধ্যায় চিহ্নিত হয়নি — চালিয়ে যান।</p>
          )}
        </Card>

        {/* Row 4: Trends + Mock shortcuts */}
        <div className="grid gap-3 md:grid-cols-2">
          <ShortcutCard
            to="/past-paper-analyzer"
            icon={Sparkles}
            title="যেসব প্রশ্ন বারবার এসেছে"
            cta="Board Trends দেখুন"
          />
          <ShortcutCard
            to="/mock-test"
            icon={Trophy}
            title="Chapter mock দিয়ে নিজেকে যাচাই করুন"
            cta="Mock Test শুরু করুন"
          />
        </div>

        {/* Footer quick links */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/board-questions" className="text-xs underline-offset-4 hover:underline">
            <BookOpen className="mr-1 inline h-3 w-3" /> সব Board Questions
          </Link>
          <Link to="/history" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            <History className="mr-1 inline h-3 w-3" /> Practice History
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="exam-heading text-xl font-bold">
        {typeof value === "number" ? toBnDigits(value) : value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ShortcutCard({
  to,
  icon: Icon,
  title,
  cta,
}: {
  to: string;
  icon: typeof Sparkles;
  title: string;
  cta: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="flex items-center gap-3 p-4 transition hover:border-foreground/40">
        <Icon className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="exam-heading text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{cta} →</p>
        </div>
      </Card>
    </Link>
  );
}
