import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Target, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Result Analytics</p>
          <h1 className="mt-1 text-3xl font-bold">Weak chapter detection placeholder</h1>
          <p className="mt-2 text-muted-foreground">
            Analytics will be calculated from practice attempts and mock-test
            sessions after the Supabase schema is finalized.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric title="Overall accuracy" value="--" icon={BarChart3} />
          <Metric title="Weak chapters" value="--" icon={TrendingDown} />
          <Metric title="Readiness score" value="--" icon={Target} />
        </div>

        <Card className="mt-8 p-6">
          <h2 className="font-semibold">Chapter performance preview</h2>
          <div className="mt-5 space-y-4">
            {["Physics - Vector", "Chemistry - Bonding", "Biology - Cell"].map((label) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-48 text-sm font-medium">{label}</div>
                <div className="flex-1">
                  <Progress value={0} />
                </div>
                <div className="w-16 text-right text-sm text-muted-foreground">No data</div>
              </div>
            ))}
          </div>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/history">Open History</Link>
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </Card>
  );
}
