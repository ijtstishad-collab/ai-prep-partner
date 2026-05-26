import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { BookOpen, Database, FileQuestion, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type AdminAreaRoute = "/admin/question-review" | "/admin/questions" | "/chapters" | "/subjects";

const adminAreas: Array<{
  title: string;
  desc: string;
  status: string;
  to: AdminAreaRoute;
  icon: typeof ShieldCheck;
}> = [
  {
    title: "প্রশ্ন পর্যালোচনা",
    desc: "শিক্ষার্থীদের জন্য প্রকাশের আগে এআই-জেনারেটেড খসড়া যাচাই করুন।",
    status: "চালু",
    to: "/admin/question-review",
    icon: ShieldCheck,
  },
  {
    title: "বিষয় ও অধ্যায় সেটআপ",
    desc: "এইচএসসি বিষয়, অধ্যায় ও কভারেজ ব্যবস্থাপনার জন্য ভবিষ্যৎ ওয়ার্কস্পেস।",
    status: "পরিকল্পিত",
    to: "/chapters",
    icon: BookOpen,
  },
  {
    title: "বোর্ড প্রশ্নব্যাংক",
    desc: "Single add, CSV import, review queue ও question bank — সব এক জায়গায়।",
    status: "চালু",
    to: "/admin/questions",
    icon: FileQuestion,
  },
  {
    title: "এআই জেনারেশন জব",
    desc: "পাঠ্যবইভিত্তিক প্রশ্ন তৈরি ও পর্যালোচনার ভবিষ্যৎ কিউ।",
    status: "পরিকল্পিত",
    to: "/admin/question-review",
    icon: Sparkles,
  },
];

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && !isAdmin) {
      toast.error("অ্যাডমিন অ্যাক্সেস প্রয়োজন");
      nav({ to: "/dashboard" });
    }
  }, [loading, user, isAdmin, nav]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-medium text-primary">অ্যাডমিন কনসোল</p>
          <h1 className="mt-1 text-3xl font-bold">এআই প্রেপ পার্টনার · অ্যাডমিন</h1>
          <p className="mt-2 text-muted-foreground">
            এই ধাপে অ্যাডমিন এরিয়া নিরাপদ প্লেসহোল্ডার হিসেবে রাখা হয়েছে। কোনো ব্যাকএন্ড টেবিল, পলিসি বা অথেনটিকেশন রুল এখানে পরিবর্তন হয়নি।
          </p>
        </div>

        <Card className="mb-8 p-6 border-primary/30 bg-primary/5">
          <div className="flex gap-3">
            <Database className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">ডেটাবেস কাজ পরিকল্পিতভাবে স্থগিত</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                পুরোনো লাইভ অ্যাডমিন ফর্মগুলো এই ধাপে লুকানো আছে। নতুন স্কিমা ও RLS পলিসি অনুমোদনের পরেই সেগুলো ফিরবে।
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {adminAreas.map(({ title, desc, status, to, icon: Icon }) => (
            <Card key={title} className="p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="secondary">{status}</Badge>
              </div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              <Button asChild className="mt-5" variant="outline">
                <Link to={to}>খুলুন</Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
