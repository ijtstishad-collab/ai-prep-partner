import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileQuestion } from "lucide-react";

export const Route = createFileRoute("/practice/$chapterId")({
  component: ChapterPracticePlaceholder,
});

function ChapterPracticePlaceholder() {
  const { chapterId } = Route.useParams();

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Link to="/practice" className="text-sm text-muted-foreground hover:text-foreground">
          Back to practice
        </Link>
        <Card className="mt-6 p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileQuestion className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-primary">Chapter practice placeholder</p>
          <h1 className="mt-1 text-3xl font-bold">Practice for chapter {chapterId}</h1>
          <p className="mt-3 text-muted-foreground">
            This route is preserved for future deep links, but Phase 1 does not
            create attempts, fetch questions, score answers, or change database tables.
          </p>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>Placeholder progress</span>
              <span>0 of 10</span>
            </div>
            <Progress value={0} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/mock-test">Try Mock Test Placeholder</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/analytics">View Analytics Placeholder</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
