import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenText } from "lucide-react";

export const Route = createFileRoute("/subjects/$slug")({ component: SubjectChaptersPage });

function SubjectChaptersPage() {
  const { slug } = Route.useParams();
  const subjectName = slug
    .split("-")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <Link to="/subjects" className="text-sm text-muted-foreground hover:text-foreground">
          Back to HSC subjects
        </Link>
        <Card className="mt-6 p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpenText className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-primary">Subject chapters placeholder</p>
          <h1 className="mt-1 text-3xl font-bold">{subjectName}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            This legacy subject detail route is kept as a placeholder for now.
            The main Phase 1 chapter browser lives on the Chapters page.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/chapters">Open Chapters</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/practice">Start Practice Placeholder</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
