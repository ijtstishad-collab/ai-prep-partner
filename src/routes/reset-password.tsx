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

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const errDesc = url.searchParams.get("error_description") || hash.get("error_description");
        if (errDesc) {
          setError(errDesc);
          return;
        }

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            setError(exErr.message);
            return;
          }
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }

        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sErr) {
            setError(sErr.message);
            return;
          }
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) setReady(true);
      } catch (e: any) {
        setError(e?.message ?? "Could not verify reset link.");
      }
    })();

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
