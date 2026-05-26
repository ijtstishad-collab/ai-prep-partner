import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FlaskConical,
  GraduationCap,
  Layers,
  Repeat,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "AI Prep Partner — HSC Board Question Practice & Smart Revision" },
      {
        name: "description",
        content:
          "HSC board question practice, year & board tracking, AI Bangla explanation, weak chapter detection and smart study plan — for Bangladeshi HSC examinees.",
      },
    ],
  }),
});

const groups = [
  { key: "science", en: "Science", bn: "বিজ্ঞান", icon: FlaskConical },
  { key: "business", en: "Business Studies", bn: "ব্যবসায় শিক্ষা", icon: TrendingUp },
  { key: "humanities", en: "Humanities", bn: "মানবিক", icon: Layers },
];

const features = [
  {
    icon: FileSpreadsheet,
    title: "Previous Board Questions",
    bn: "বিগত বোর্ড প্রশ্ন",
    desc: "Verified MCQ, CQ and short questions from every education board, organised by chapter.",
  },
  {
    icon: CalendarDays,
    title: "Year & Board Tracking",
    bn: "বছর ও বোর্ড ট্র্যাকিং",
    desc: "Instantly see which year and which board each question appeared in.",
  },
  {
    icon: Repeat,
    title: "Repeated Pattern Analysis",
    bn: "পুনরাবৃত্ত প্যাটার্ন",
    desc: "Spot the questions that keep coming back across boards and years.",
  },
  {
    icon: Brain,
    title: "AI Explanation in Bangla",
    bn: "AI ব্যাখ্যা (বাংলায়)",
    desc: "Step-by-step Bangla explanation, common mistakes and why other options are wrong.",
  },
  {
    icon: Target,
    title: "Weak Chapter Detection",
    bn: "দুর্বল অধ্যায় শনাক্ত",
    desc: "Track which chapters need more revision based on your real performance.",
  },
  {
    icon: Timer,
    title: "Smart Study Plan",
    bn: "স্মার্ট স্টাডি প্ল্যান",
    desc: "Weekly plan built around your exam date, daily time and weak subjects.",
  },
  {
    icon: Sparkles,
    title: "Mock Test Simulation",
    bn: "মক টেস্ট",
    desc: "Chapter, subject, board pattern and full HSC mock tests with timer.",
  },
];

function HomePage() {
  return (
    <AppShell>
      {/* HERO */}
      <section className="border-b">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
              <GraduationCap className="h-3.5 w-3.5" /> HSC · Bangladesh Boards
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
              HSC Board Question Practice, AI Explanation &amp; Smart Revision
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              বোর্ড প্রশ্ন, বছর-ভিত্তিক বিশ্লেষণ, AI ব্যাখ্যা ও দুর্বল অধ্যায় ট্র্যাকিং — সব এক জায়গায়।
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Get Started
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/past-paper-analyzer">Board Question Trends</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* GROUPS */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold">Choose your group · বিভাগ নির্বাচন</h2>
        <p className="mt-2 text-muted-foreground">
          Science · Business Studies · Humanities — subjects load automatically after onboarding.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {groups.map(({ key, en, bn, icon: Icon }) => (
            <Card key={key} className="p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{en}</h3>
                <p className="text-sm text-muted-foreground">{bn}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold">Built for the HSC examinee</h2>
        <p className="mt-2 text-muted-foreground">
          Everything board-aligned — no random demo content, no filler.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, bn, desc }) => (
            <Card key={title} className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">{bn}</p>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-16">
        <Card className="p-8 bg-gradient-hero text-primary-foreground">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">এখনই শুরু করুন</h2>
              <p className="mt-2 max-w-2xl opacity-90">
                Sign up, complete the 5-step onboarding, and your board-question dashboard is ready.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg">
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
