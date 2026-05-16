import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/subjects/$slug")({ component: ChaptersPage });

function ChaptersPage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [subject, setSubject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("subjects").select("*").eq("slug", slug).maybeSingle();
      setSubject(s);
      if (s) {
        const { data: c } = await supabase.from("chapters").select("*").eq("subject_id", s.id).eq("is_active", true).order("order_index");
        setChapters(c ?? []);
      }
    })();
  }, [slug]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <Link to="/subjects" className="text-sm text-muted-foreground hover:text-foreground">← All subjects</Link>
        <h1 className="text-3xl font-bold mt-2">{subject?.name}</h1>
        <p className="text-muted-foreground mb-6">{subject?.name_bn} · Chapters</p>
        {chapters.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Chapters for this subject are being prepared. Please check back shortly.
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {chapters.map((c) => (
              <Card key={c.id} className="p-4 flex items-center gap-3 hover:shadow-soft transition">
                <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold">{c.order_index}</div>
                <div className="flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.name_bn}</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/practice/$chapterId" params={{ chapterId: c.id }}>Practice <ChevronRight className="h-4 w-4" /></Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
