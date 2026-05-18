import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export const Route = createFileRoute("/practice/$chapterId")({
  component: ChapterPracticeRedirect,
});

function ChapterPracticeRedirect() {
  const { chapterId } = Route.useParams();

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="p-8 text-center">
          <FileQuestion className="mx-auto mb-4 h-12 w-12 text-primary" />
          <p className="text-sm font-medium text-primary">Chapter practice</p>
          <h1 className="mt-1 text-3xl font-bold">Open this chapter in practice mode</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Practice now uses the Supabase-backed chapter query route so answer submission can be
            saved cleanly.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <a href={`/practice?chapterId=${chapterId}`}>Start Practice</a>
            </Button>
            <Button asChild variant="outline">
              <Link to="/chapters">Choose Another Chapter</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
