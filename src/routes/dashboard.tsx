import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  History,
  Sparkles,
  Timer,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type JourneyStep = { step: string; title: string; bn: string };

const journey: JourneyStep[] = [
  { step: "1", title: "Choose Subject", bn: "বিষয় নির্বাচন" },
  { step: "2", title: "Choose Chapter", bn: "অধ্যায় নির্বাচন" },
  { step: "3", title: "Pick Practice Mode", bn: "প্রস্তুতি মোড" },
  { step: "4", title: "Answer & Submit", bn: "উত্তর ও জমা" },
  { step: "5", title: "Result & Weak Chapter", bn: "ফলাফল ও দুর্বলতা" },
];

const quickLinks = [
  {
    title: "HSC Subjects",
    bn: "এইচএসসি বিষয়সমূহ",
    body: "Browse subjects and jump into chapter-wise practice.",
    to: "/subjects" as const,
    icon: BookOpen,
  },
  {
    title: "Continue Practice",
    bn: "প্র্যাকটিস চালিয়ে যান",
    body: "Resume the last chapter or pick a fresh one.",
    to: "/practice" as const,
    icon: FileQuestion,
  },
  {
    title: "Mock Test",
    bn: "মক টেস্ট",
    body: "Sit a timed, full-paper style mock exam.",
    to: "/mock-test" as const,
    icon: Timer,
  },
  {
    title: "Result Analytics",
    bn: "ফলাফল বিশ্লেষণ",
    body: "See accuracy, weak chapters, and your next focus.",
    to: "/analytics" as const,
    icon: BarChart3,
  },
];

function Dashboard() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && profile && !profile.onboarded) nav({ to: "/onboarding" });
  }, [loading, user, profile, nav]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Student Dashboard · ড্যাশবোর্ড</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold sm:text-4xl">
            স্বাগতম, {profile?.full_name || "শিক্ষার্থী"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pick a subject → chapter → practice mode. Each set is presented in HSC
            exam-paper style.
          </p>
        </div>

        {/* Journey strip */}
        <Card className="paper-sheet mb-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="exam-heading text-lg font-semibold">Your Practice Journey</h2>
            <Badge variant="secondary">৫ ধাপ</Badge>
          </div>
          <ol className="grid gap-2 sm:grid-cols-5">
            {journey.map((s, i) => (
              <li key={s.step} className="flex items-start gap-2 rounded-md border bg-white/60 p-3">
                <span className="omr-bubble" style={{ width: "1.75rem", height: "1.75rem" }}>
                  {s.step}
                </span>
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.bn}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* Primary CTAs */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card className="paper-sheet p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="exam-heading text-xl font-semibold">Start a New Practice</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Begin from the subjects page and pick a chapter.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/subjects">
                    Choose Subject <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="paper-sheet p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="exam-heading text-xl font-semibold">Try AI-Generated MCQs</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fresh chapter-aware MCQs generated for instant practice.
                </p>
                <Button asChild className="mt-4" variant="outline">
                  <Link to="/practice">
                    Open Practice <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick links grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map(({ title, bn, body, to, icon: Icon }) => (
            <Card key={title} className="paper-sheet p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{bn}</div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{body}</p>
              <Button asChild size="sm" variant="ghost" className="mt-3 -ml-2">
                <Link to={to}>
                  Open <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </Card>
          ))}
        </div>

        {/* Footer helpers */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card className="paper-sheet p-5">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">Recent History</div>
                <p className="text-sm text-muted-foreground">
                  Review your past attempts and scores.
                </p>
                <Button asChild size="sm" variant="link" className="px-0">
                  <Link to="/history">
                    Open History <History className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
          <Card className="paper-sheet p-5">
            <div className="flex items-start gap-3">
              <TrendingDown className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <div className="font-semibold">Weak Chapter Focus</div>
                <p className="text-sm text-muted-foreground">
                  Analytics highlights chapters needing revision.
                </p>
                <Button asChild size="sm" variant="link" className="px-0">
                  <Link to="/analytics">
                    Open Analytics <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
