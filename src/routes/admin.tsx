import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { BookOpen, Database, FileQuestion, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type AdminAreaRoute = "/admin/question-review" | "/chapters" | "/subjects";

const adminAreas: Array<{
  title: string;
  desc: string;
  status: string;
  to: AdminAreaRoute;
  icon: typeof ShieldCheck;
}> = [
  {
    title: "Question Review",
    desc: "Review AI-generated drafts before they go live for students.",
    status: "Phase 1 placeholder",
    to: "/admin/question-review",
    icon: ShieldCheck,
  },
  {
    title: "Subject and Chapter Setup",
    desc: "Future workspace for managing HSC subjects, chapters, and content coverage.",
    status: "Planned",
    to: "/chapters",
    icon: BookOpen,
  },
  {
    title: "Board Question Bank",
    desc: "Future import flow for board, year, subject, and chapter metadata.",
    status: "Planned",
    to: "/subjects",
    icon: FileQuestion,
  },
  {
    title: "AI Generation Jobs",
    desc: "Future queue for textbook-based question generation and review handoff.",
    status: "Planned",
    to: "/admin/question-review",
    icon: Sparkles,
  },
];

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && !isAdmin) {
      toast.error("Admin access required");
      nav({ to: "/dashboard" });
    }
  }, [loading, user, isAdmin, nav]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-medium text-primary">Admin Structure</p>
          <h1 className="mt-1 text-3xl font-bold">AI Prep Partner admin console</h1>
          <p className="mt-2 text-muted-foreground">
            Phase 1 keeps the admin area as a safe placeholder. No Supabase tables,
            policies, or authentication rules are changed here.
          </p>
        </div>

        <Card className="mb-8 p-6 border-primary/30 bg-primary/5">
          <div className="flex gap-3">
            <Database className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Database work intentionally deferred</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The previous live admin database forms are hidden for this phase.
                They should return only after the new Supabase-first schema and RLS
                policies are approved.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {adminAreas.map(({ title, desc, status, to, icon: Icon }) => (
            <Card key={title} className="p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="secondary">{status}</Badge>
              </div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              <Button asChild className="mt-5" variant="outline">
                <Link to={to}>Open</Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
