import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpenText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/chapters")({ component: ChaptersPage });

const chapters = [
  { subject: "Physics", chapter: "Physical World and Measurement", status: "Planned" },
  { subject: "Physics", chapter: "Vector and Motion", status: "Planned" },
  { subject: "Chemistry", chapter: "Qualitative Chemistry", status: "Planned" },
  { subject: "Chemistry", chapter: "Chemical Bonding", status: "Planned" },
  { subject: "Biology", chapter: "Cell and Its Structure", status: "Planned" },
  { subject: "ICT", chapter: "Number System and Digital Device", status: "Planned" },
];

function ChaptersPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Chapters</p>
          <h1 className="mt-1 text-3xl font-bold">Chapter-wise practice map</h1>
          <p className="mt-2 text-muted-foreground">
            This placeholder shows how students will choose a chapter before
            practice or mock-test generation. No database changes are included.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {chapters.map((item, index) => (
            <Card key={`${item.subject}-${item.chapter}`} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.subject}</Badge>
                    <span className="text-xs text-muted-foreground">Chapter {index + 1}</span>
                  </div>
                  <h2 className="mt-2 font-semibold">{item.chapter}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Status: {item.status}. Approved question counts will appear here later.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/practice">
                    Practice <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
