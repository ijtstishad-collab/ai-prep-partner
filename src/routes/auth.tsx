import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      nav({ to: profile?.onboarded ? "/dashboard" : "/onboarding" });
    }
  }, [loading, user, profile, nav]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name: String(fd.get("name") ?? "") },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created!");
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-6 shadow-elegant">
          <h1 className="text-2xl font-bold text-center mb-1">Welcome to AI Prep Partner</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            HSC exam preparation for Bangladeshi students.
          </p>
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <PasswordInput name="password" required />
                </div>
                <Button className="w-full" disabled={busy}>
                  {busy ? "..." : "Login"}
                </Button>
                <button
                  type="button"
                  onClick={() => nav({ to: "/forgot-password" })}
                  className="block w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <Label>Full Name</Label>
                  <Input name="name" required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label>Password</Label>
                  <PasswordInput name="password" minLength={8} required />
                </div>
                <Button className="w-full" disabled={busy}>
                  {busy ? "..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}
