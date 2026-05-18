import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  ShieldCheck,
  Timer,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

const productAreas = [
  {
    icon: BookOpen,
    title: "HSC subjects",
    desc: "Physics, Chemistry, Biology, ICT, Bangla, English, and more as the content model grows.",
  },
  {
    icon: FileQuestion,
    title: "Chapter-wise practice",
    desc: "A focused placeholder for solving approved questions by subject and chapter.",
  },
  {
    icon: Timer,
    title: "Mock tests",
    desc: "Timed HSC-style exams with scoring and review planned for the next phases.",
  },
  {
    icon: BarChart3,
    title: "Result analytics",
    desc: "Track accuracy, recent attempts, and weak chapters once the data layer is ready.",
  },
  {
    icon: ShieldCheck,
    title: "Admin review",
    desc: "AI-generated questions will stay pending until a reviewer approves them.",
  },
  {
    icon: ClipboardCheck,
    title: "Board question bank",
    desc: "Past board questions will be organized by board, year, subject, and chapter.",
  },
];

function HomePage() {
  return (
    <AppShell>
      <section className="border-b bg-gradient-card">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
              <GraduationCap className="h-3 w-3" /> Bangladeshi HSC MVP
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              AI Prep Partner for HSC exam preparation
            </h1>
            <p className="text-lg text-muted-foreground">
              Phase 1 establishes the student and admin structure for an HSC-first
              platform: subjects, chapters, practice, mock tests, result analytics,
              and question review.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Start as Student</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/subjects">Explore HSC Subjects</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">MVP structure</h2>
            <p className="mt-2 text-muted-foreground">
              These are placeholder surfaces only. Database and authentication logic
              remain unchanged in this phase.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productAreas.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <Card className="p-8 bg-gradient-hero text-primary-foreground">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Phase 1 is about structure.</h2>
              <p className="mt-2 max-w-2xl opacity-90">
                The next phase can connect these pages to the Supabase-first schema,
                RLS policies, and approved question workflow.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link to="/dashboard">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
