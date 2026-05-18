import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { CheckCircle2, Edit3, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/question-review")({
  component: AdminQuestionReviewPage,
});

const reviewSteps = [
  {
    title: "AI draft generated",
    desc: "Questions are created from verified textbook or board-question content.",
    icon: Edit3,
  },
  {
    title: "Admin reviews",
    desc: "Reviewer checks wording, answer, explanation, difficulty, and chapter fit.",
    icon: ShieldCheck,
  },
  {
    title: "Approve or reject",
    desc: "Only approved questions become visible to students.",
    icon: CheckCircle2,
  },
];

function AdminQuestionReviewPage() {
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
          <p className="text-sm font-medium text-primary">Admin Question Review</p>
          <h1 className="mt-1 text-3xl font-bold">AI-generated question review queue</h1>
          <p className="mt-2 text-muted-foreground">
            Placeholder for the human-in-the-loop review flow. No AI generation,
            database writes, or RLS changes are implemented in Phase 1.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {reviewSteps.map(({ title, desc, icon: Icon }) => (
            <Card key={title} className="p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-8 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Review queue preview</h2>
              <p className="text-sm text-muted-foreground">
                Sample layout for pending questions.
              </p>
            </div>
            <Badge variant="secondary">Placeholder</Badge>
          </div>

          <div className="rounded-xl border p-5">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>Physics</Badge>
              <Badge variant="outline">MCQ</Badge>
              <Badge variant="secondary">Pending review</Badge>
            </div>
            <h3 className="font-semibold">
              Sample AI-generated HSC question awaiting teacher review.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The real queue will show question text, options, answer key,
              explanation, source reference, and reviewer actions.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled variant="outline">
                <Edit3 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button disabled variant="destructive">
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button disabled>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>

          <Button asChild className="mt-6" variant="outline">
            <Link to="/admin">Back to Admin Console</Link>
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
