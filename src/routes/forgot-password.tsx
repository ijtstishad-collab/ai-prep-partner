import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent — check your email.");
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-6 shadow-elegant">
          <h1 className="text-2xl font-bold text-center mb-1">Forgot Password</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm">
                If an account exists for that email, a reset link is on its way. Check your inbox
                (and spam folder).
              </p>
              <Button variant="outline" className="w-full" onClick={() => nav({ to: "/auth" })}>
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy ? "Sending..." : "Send Reset Link"}
              </Button>
              <button
                type="button"
                onClick={() => nav({ to: "/auth" })}
                className="block w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Back to Login
              </button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
