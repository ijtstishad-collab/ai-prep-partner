import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { GraduationCap, Mail, UserRound, LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Profile</span>
        </nav>

        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Profile · প্রোফাইল</p>
          <h1 className="exam-heading mt-1 text-3xl font-bold">
            {profile?.full_name || "HSC Student"}
          </h1>
          <p className="mt-1 text-muted-foreground">{user?.email || "Not signed in"}</p>
        </div>

        <Card className="paper-sheet p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground">
              <UserRound className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <div className="exam-heading text-xl font-semibold">
                {profile?.full_name || "HSC Student"}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">HSC</Badge>
                <Badge variant="secondary">শিক্ষার্থী</Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info icon={GraduationCap} label="Exam track" value="HSC" />
            <Info icon={Mail} label="Email" value={user?.email || "Pending"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/onboarding">Update Onboarding</Link>
            </Button>
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={async () => {
                await signOut();
                nav({ to: "/" });
              }}
            >
              <LogOut className="mr-1 h-4 w-4" /> Logout
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-white/60 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
