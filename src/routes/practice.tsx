import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileQuestion, ListChecks } from "lucide-react";

export const Route = createFileRoute("/practice")({ component: PracticePage });

const modes = [
  "Subject-wise practice",
  "Chapter-wise practice",
  "Past board question practice",
  "AI-generated reviewed questions",
];

function PracticePage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Practice</p>
          <h1 className="mt-1 text-3xl font-bold">HSC practice placeholder</h1>
          <p className="mt-2 text-muted-foreground">
            This page reserves the student practice experience without connecting
            new database tables or changing authentication.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileQuestion className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Question workspace</h2>
                <p className="text-sm text-muted-foreground">Preview-only layout for Phase 1.</p>
              </div>
            </div>

            <div className="rounded-xl border p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge>Physics</Badge>
                <Badge variant="secondary">Chapter 1</Badge>
                <Badge variant="outline">MCQ</Badge>
              </div>
              <h3 className="font-semibold">
                A sample question will appear here after approved HSC questions are connected.
              </h3>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {["Option A", "Option B", "Option C", "Option D"].map((option) => (
                  <button
                    key={option}
                    className="rounded-lg border px-4 py-3 text-left text-sm text-muted-foreground"
                    disabled
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Planned practice modes</h2>
            </div>
            <div className="space-y-3">
              {modes.map((mode) => (
                <div key={mode} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {mode}
                </div>
              ))}
            </div>
            <Button asChild className="mt-6 w-full" variant="outline">
              <Link to="/chapters">Choose a Chapter</Link>
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
