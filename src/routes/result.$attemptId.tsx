import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/result/$attemptId")({ component: ResultPage });

function ResultPage() {
  const { attemptId } = Route.useParams();

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="p-8 text-center">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-primary" />
          <p className="text-sm font-medium text-primary">Result detail placeholder</p>
          <h1 className="mt-1 text-3xl font-bold">Result for attempt {attemptId}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            This legacy result route is preserved for future links. Real answer
            review, score calculation, and explanations will be connected after
            the MVP database work.
          </p>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>Placeholder score</span>
              <span>--</span>
            </div>
            <Progress value={0} />
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link to="/analytics">Open Analytics</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/history">Open History</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
