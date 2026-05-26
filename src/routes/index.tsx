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
    title: "Subject-wise learning",
    desc: "HSC subjects organized by paper and chapter — Bangla, English, ICT, Physics, Chemistry, Biology, Higher Math.",
  },
  {
    icon: FileQuestion,
    title: "AI question generation",
    desc: "Generate original MCQs, short, creative, board, and admission-style questions — powered by Lovable AI.",
  },
  {
    icon: ClipboardCheck,
    title: "MCQ practice",
    desc: "Practice one question at a time with instant answer, Bangla explanation, and saved attempts.",
  },
  {
    icon: BarChart3,
    title: "Past paper trend analysis",
    desc: "See which chapters repeat most across board exams and focus your revision.",
  },
  {
    icon: Timer,
    title: "Personal study plan",
    desc: "Set your exam date and daily minutes — get a weekly schedule with weak-subject focus.",
  },
  {
    icon: ShieldCheck,
    title: "Admission preparation",
    desc: "Medical, engineering, and varsity admission-style questions integrated into the practice flow.",
  },
];

function HomePage() {
  return (
    <AppShell>
      <section className="border-b bg-gradient-card">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
              <GraduationCap className="h-3 w-3" /> HSC AI Prep Partner
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              AI-powered HSC preparation for Bangladeshi students
            </h1>
            <p className="text-lg text-muted-foreground">
              Practice MCQs, study by subject, analyze past questions, and generate new questions from your syllabus —
              all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/practice">Start Practicing</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/subjects">Explore Subjects</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Everything you need to crack HSC</h2>
          <p className="mt-2 text-muted-foreground">
            বিজ্ঞান · ব্যবসায় শিক্ষা · মানবিক — built around the way Bangladeshi students actually study.
          </p>
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
              <h2 className="text-2xl font-bold">Ready to start?</h2>
              <p className="mt-2 max-w-2xl opacity-90">
                Sign in, pick a subject, and generate your first AI question in under a minute.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link to="/auth">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Get Started Free
              </Link>
            </Button>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
