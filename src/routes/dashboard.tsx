import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileQuestion,
  Timer,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type DashboardRoute = "/subjects" | "/practice" | "/mock-test" | "/analytics";

const dashboardCards: Array<{
  title: string;
  body: string;
  to: DashboardRoute;
  icon: typeof BookOpen;
}> = [
  {
    title: "HSC Subjects",
    body: "Browse the subject structure that will power subject-wise practice.",
    to: "/subjects",
    icon: BookOpen,
  },
  {
    title: "Chapter Practice",
    body: "Placeholder flow for chapter-wise MCQ and written practice.",
    to: "/practice",
    icon: FileQuestion,
  },
  {
    title: "Mock Test",
    body: "Timed HSC-style test structure waiting for the exam engine.",
    to: "/mock-test",
    icon: Timer,
  },
  {
    title: "Result Analytics",
    body: "Weak chapter detection and scoring summaries will appear here.",
    to: "/analytics",
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Student Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold">
            Welcome to AI Prep Partner, {profile?.full_name || "Student"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Phase 1 keeps the dashboard as a placeholder while the Supabase schema
            and approved question workflow are prepared.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Subjects ready" value="6" icon={BookOpen} />
          <StatCard label="Practice modes" value="2" icon={ClipboardList} />
          <StatCard label="Mock test status" value="Draft" icon={Timer} />
        </div>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">MVP readiness</h2>
              <p className="text-sm text-muted-foreground">
                UI structure is being prepared before database and auth work.
              </p>
            </div>
            <span className="text-2xl font-bold text-primary">25%</span>
          </div>
          <Progress value={25} className="mt-4" />
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {dashboardCards.map(({ title, body, to, icon: Icon }) => (
            <Card key={title} className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              <Button asChild className="mt-5" variant="outline">
                <Link to={to}>Open</Link>
              </Button>
            </Card>
          ))}
        </div>

        <Card className="mt-8 p-6 border-warning/40 bg-warning/5">
          <div className="flex gap-3">
            <TrendingDown className="mt-0.5 h-5 w-5 text-warning" />
            <div>
              <h3 className="font-semibold">Weak chapter detection placeholder</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Real weak chapter detection will be connected after attempts,
                scoring, and analytics tables are finalized.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BookOpen;
}) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}
