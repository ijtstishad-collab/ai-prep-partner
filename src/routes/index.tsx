import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Target, BookOpen, BarChart3, MessageSquare, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <AppShell>
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3" /> HSC Science · AI Powered
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              এইচএসসি প্রস্তুতি, এবার <span className="bg-gradient-hero bg-clip-text text-transparent">AI দিয়ে</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Chapter-wise AI questions, mock tests, Bangla explanations, and weak-area tracking — built for HSC Science students in Bangladesh.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth">Start Free</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/pricing">View Pricing</Link></Button>
            </div>
            <div className="flex flex-wrap gap-4 pt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-success" /> Physics</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-success" /> Chemistry</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-success" /> Biology</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-hero rounded-3xl blur-3xl opacity-20" />
            <Card className="relative p-6 shadow-elegant bg-gradient-card">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" /> AI Generated · Physics 1st Paper
                </div>
                <div className="rounded-xl bg-card p-4 border">
                  <p className="font-medium">What is the SI unit of force?</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {["Newton", "Joule", "Watt", "Pascal"].map((o, i) => (
                      <div key={o} className={`p-2 rounded-lg border ${i === 0 ? "bg-success/10 border-success text-success" : "bg-muted"}`}>{o}</div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    ব্যাখ্যা: বলের এসআই একক হলো নিউটন (N)।
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">Everything you need to prepare smarter for HSC</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, title: "AI Question Generator", desc: "Generate MCQs, short questions, and written questions by chapter and difficulty." },
            { icon: MessageSquare, title: "Simple Bangla explanations", desc: "প্রতিটি উত্তরের সাথে সহজ বাংলা ব্যাখ্যা।" },
            { icon: BookOpen, title: "Chapter-wise practice", desc: "Physics, Chemistry, and Biology — 1st papers, all chapters." },
            { icon: Target, title: "Mock tests", desc: "Timed practice tests with instant scoring." },
            { icon: BarChart3, title: "Weak area analysis", desc: "See exactly which chapters need more work." },
            { icon: CheckCircle2, title: "Teacher-reviewed question bank", desc: "Quality questions vetted by teachers." },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6 hover:shadow-soft transition">
              <div className="h-10 w-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <Card className="p-10 bg-gradient-hero text-primary-foreground text-center shadow-elegant">
          <h2 className="text-3xl font-bold mb-2">Ready to prepare smarter for HSC?</h2>
          <p className="opacity-90 mb-6">আজই শুরু করুন — ফ্রি একাউন্ট খুলে practice শুরু করুন।</p>
          <Button asChild size="lg" variant="secondary"><Link to="/auth">Create free account</Link></Button>
        </Card>
      </section>
    </AppShell>
  );
}
