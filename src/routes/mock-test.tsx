import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Trophy } from "lucide-react";

export const Route = createFileRoute("/mock-test")({ component: MockTestPage });

function MockTestPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Mock Test</p>
          <h1 className="mt-1 text-3xl font-bold">Timed mock exam placeholder</h1>
          <p className="mt-2 text-muted-foreground">
            This structure is ready for the HSC mock-test engine. No exam sessions
            or scoring tables are changed in Phase 1.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Timer className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">HSC Physics Mock Test</h2>
                <p className="text-sm text-muted-foreground">Example configuration only.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Duration" value="60 min" />
              <Info label="Questions" value="30" />
              <Info label="Status" value="Draft" />
            </div>
            <div className="mt-6 rounded-xl border p-5 text-sm text-muted-foreground">
              Students will later start a timed session here, answer approved
              questions, submit once, and receive a score with chapter breakdown.
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Planned test types</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Subject mock</Badge>
              <Badge variant="secondary">Chapter mock</Badge>
              <Badge variant="outline">Full HSC paper</Badge>
            </div>
            <Button asChild className="mt-6 w-full">
              <Link to="/analytics">View Result Analytics</Link>
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
