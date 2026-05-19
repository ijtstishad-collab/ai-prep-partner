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
          <p className="text-sm font-medium text-primary">মক টেস্ট · Mock Test</p>
          <h1 className="mt-1 text-3xl font-bold">সময়সহ পূর্ণ মক পরীক্ষা</h1>
          <p className="mt-2 text-muted-foreground">
            এইচএসসি মক-টেস্ট ইঞ্জিনের জন্য প্রস্তুত কাঠামো। এই ধাপে কোনো সেশন বা স্কোর টেবিল পরিবর্তন করা হয়নি।
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Timer className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">এইচএসসি পদার্থবিজ্ঞান মক টেস্ট</h2>
                <p className="text-sm text-muted-foreground">শুধুমাত্র উদাহরণ কনফিগারেশন।</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="সময়সীমা" value="৬০ মিনিট" />
              <Info label="প্রশ্ন" value="৩০" />
              <Info label="অবস্থা" value="খসড়া" />
            </div>
            <div className="mt-6 rounded-xl border p-5 text-sm text-muted-foreground">
              পরে এখান থেকে সময়সহ সেশন শুরু করে যাচাইকৃত প্রশ্নের উত্তর দিয়ে একবারে জমা দেওয়া যাবে; অধ্যায়ভিত্তিক ব্রেকডাউনসহ স্কোর পাওয়া যাবে।
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">পরিকল্পিত টেস্ট ধরন</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>বিষয়ভিত্তিক মক</Badge>
              <Badge variant="secondary">অধ্যায়ভিত্তিক মক</Badge>
              <Badge variant="outline">পূর্ণ এইচএসসি পেপার</Badge>
            </div>
            <Button asChild className="mt-6 w-full">
              <Link to="/analytics">ফলাফল বিশ্লেষণ দেখুন</Link>
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
