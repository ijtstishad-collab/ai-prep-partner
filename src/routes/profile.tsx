import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { GraduationCap, Mail, UserRound } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Profile</p>
          <h1 className="mt-1 text-3xl font-bold">Student profile placeholder</h1>
          <p className="mt-2 text-muted-foreground">
            Profile editing is intentionally not changed in Phase 1. This page only
            shows the future profile structure.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground">
              <UserRound className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{profile?.full_name || "HSC Student"}</h2>
              <p className="text-sm text-muted-foreground">{user?.email || "Not signed in"}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info icon={GraduationCap} label="Exam track" value="HSC" />
            <Info icon={Mail} label="Contact" value={user?.email || "Pending"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/onboarding">Existing Onboarding</Link>
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
    <div className="rounded-xl border p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
