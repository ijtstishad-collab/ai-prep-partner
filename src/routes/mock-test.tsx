import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMockHistory } from "@/lib/mock-test.functions";
import { BookCheck, GraduationCap, Layers, Target, Timer } from "lucide-react";

export const Route = createFileRoute("/mock-test")({ component: MockTestHub });

const TYPES = [
  {
    key: "chapter",
    icon: Layers,
    title: "Chapter Mock",
    title_bn: "অধ্যায়ভিত্তিক মক",
    use: "একটি নির্দিষ্ট অধ্যায়ের দ্রুত প্রস্তুতি",
    time: "১০–২০ মিনিট",
    source: "নির্বাচিত অধ্যায়ের verified board প্রশ্ন",
  },
  {
    key: "subject",
    icon: BookCheck,
    title: "Subject Mock",
    title_bn: "বিষয়ভিত্তিক মক",
    use: "পুরো বিষয়ের revision",
    time: "৩০–৬০ মিনিট",
    source: "একটি বিষয়ের সব অধ্যায়ের verified প্রশ্ন",
  },
  {
    key: "board_pattern",
    icon: Target,
    title: "Board Pattern Mock",
    title_bn: "বোর্ড প্যাটার্ন মক",
    use: "নির্দিষ্ট বোর্ড ও বছর অনুযায়ী repeated pattern",
    time: "৩০ মিনিট",
    source: "Repeated pattern + verified board question",
  },
  {
    key: "final_hsc",
    icon: GraduationCap,
    title: "Final HSC Mock",
    title_bn: "Final HSC মক",
    use: "Full exam simulation",
    time: "৬০–৯০ মিনিট",
    source: "Group অনুযায়ী মিশ্র verified প্রশ্ন",
  },
] as const;

function MockTestHub() {
  const fetchHistory = useServerFn(listMockHistory);
  const { data } = useQuery({ queryKey: ["mock-history"], queryFn: () => fetchHistory() });

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">মক টেস্ট · Mock Test</p>
          <h1 className="mt-1 text-3xl font-bold">সময়সহ পূর্ণ মক পরীক্ষা</h1>
          <p className="mt-2 text-muted-foreground">
            বোর্ড প্রশ্ন, repeated pattern এবং chapter-wise practice দিয়ে নিজেকে যাচাই করুন।
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.key} className="p-6 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{t.title_bn}</h2>
                    <p className="text-xs text-muted-foreground">{t.title}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="ব্যবহার" value={t.use} />
                  <Row label="সময়" value={t.time} />
                  <Row label="প্রশ্নের উৎস" value={t.source} />
                </div>
                <Button asChild className="mt-auto">
                  <Link to="/mock-test/setup" search={{ type: t.key }}>সেটআপ শুরু করুন</Link>
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">সাম্প্রতিক মক টেস্ট</h2>
          {(!data?.items || data.items.length === 0) ? (
            <Card className="p-6 text-sm text-muted-foreground">এখনো কোনো mock test দেওয়া হয়নি।</Card>
          ) : (
            <Card className="divide-y">
              {data.items.map((m: any) => (
                <Link
                  key={m.id}
                  to="/mock-test/$mockId"
                  params={{ mockId: m.id }}
                  search={m.status === "in_progress" ? {} : { view: "result" }}
                  className="flex items-center justify-between p-4 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium text-sm capitalize">{m.mock_type.replace("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.started_at).toLocaleString("bn-BD")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.status === "in_progress" ? (
                      <Badge variant="secondary"><Timer className="mr-1 h-3 w-3" />চলমান</Badge>
                    ) : (
                      <Badge>{m.correct_count}/{m.question_count} · {Math.round(m.accuracy)}%</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
