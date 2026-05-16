import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Atom, FlaskConical, Leaf } from "lucide-react";

export const Route = createFileRoute("/subjects")({ component: SubjectsPage });

const ICONS: Record<string, any> = { Atom, FlaskConical, Leaf };

function SubjectsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  useEffect(() => {
    supabase.from("subjects").select("*").eq("is_active", true).then(({ data }) => setSubjects(data ?? []));
  }, []);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Choose a subject</h1>
        <p className="text-muted-foreground mb-8">HSC Science · বিষয় নির্বাচন করুন</p>
        {subjects.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Subjects are being prepared. Please check back shortly.
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {subjects.map((s) => {
              const Icon = ICONS[s.icon ?? "BookOpen"] ?? Atom;
              return (
                <Link key={s.id} to="/subjects/$slug" params={{ slug: s.slug }}>
                  <Card className="p-6 hover:shadow-elegant transition cursor-pointer h-full bg-gradient-card">
                    <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h2 className="text-xl font-semibold">{s.name}</h2>
                    <p className="text-sm text-muted-foreground">{s.name_bn}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
