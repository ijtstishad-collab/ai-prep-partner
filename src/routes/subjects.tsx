import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Atom, BookOpen, FlaskConical, Languages, Leaf, Monitor } from "lucide-react";

export const Route = createFileRoute("/subjects")({ component: SubjectsPage });

const subjects = [
  {
    name: "Physics",
    group: "Science",
    icon: Atom,
    chapters: "Measurement, motion, force, waves, electricity",
  },
  {
    name: "Chemistry",
    group: "Science",
    icon: FlaskConical,
    chapters: "Atomic structure, bonding, organic chemistry",
  },
  {
    name: "Biology",
    group: "Science",
    icon: Leaf,
    chapters: "Cell biology, genetics, physiology",
  },
  {
    name: "ICT",
    group: "Common",
    icon: Monitor,
    chapters: "Number systems, web, programming, databases",
  },
  {
    name: "Bangla",
    group: "Common",
    icon: Languages,
    chapters: "Grammar, literature, writing practice",
  },
  {
    name: "English",
    group: "Common",
    icon: BookOpen,
    chapters: "Grammar, comprehension, writing",
  },
];

function SubjectsPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">HSC Subjects</p>
          <h1 className="mt-1 text-3xl font-bold">Subject-wise practice structure</h1>
          <p className="mt-2 text-muted-foreground">
            Placeholder subject cards for the HSC MVP. These will later connect to
            Supabase subjects, chapters, and approved question counts.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map(({ name, group, icon: Icon, chapters }) => (
            <Card key={name} className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="text-xs font-medium uppercase text-muted-foreground">{group}</div>
              <h2 className="mt-1 text-xl font-semibold">{name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{chapters}</p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/chapters">View Chapters</Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
