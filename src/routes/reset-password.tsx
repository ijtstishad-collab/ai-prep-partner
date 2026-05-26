import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands here via the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also handle case where session already exists from the recovery link hash.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    const confirm = String(fd.get("confirm"));
    if (password !== confirm) return toast.error("Passwords do not match.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please log in.");
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-6 shadow-elegant">
          <h1 className="text-2xl font-bold text-center mb-1">Reset Password</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Choose a new password for your account.
          </p>
          {!ready ? (
            <p className="text-sm text-center text-muted-foreground">
              Open this page from the password reset link in your email.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>New Password</Label>
                <PasswordInput name="password" minLength={8} required />
              </div>
              <div>
                <Label>Confirm Password</Label>
                <PasswordInput name="confirm" minLength={8} required />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
