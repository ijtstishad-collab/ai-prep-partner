import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText } from "lucide-react";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">History</p>
          <h1 className="mt-1 text-3xl font-bold">Practice and mock-test history</h1>
          <p className="mt-2 text-muted-foreground">
            This placeholder keeps the history surface in the product structure.
            Real attempts will appear after scoring is connected.
          </p>
        </div>

        <Card className="p-10 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No history yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Student practice attempts, mock tests, and board-question sessions will
            be listed here once the MVP data model is implemented.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link to="/practice">
                <FileText className="mr-2 h-4 w-4" />
                Start Practice
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/mock-test">Open Mock Test</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
