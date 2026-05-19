import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    class: "HSC 1st Year",
    student_group: "Science",
    target_exam_year: new Date().getFullYear() + 1,
  });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (profile) setForm((f) => ({ ...f, full_name: profile.full_name ?? f.full_name }));
  }, [loading, user, profile, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        class: form.class,
        student_group: form.student_group,
        target_exam_year: Number(form.target_exam_year),
        onboarded: true,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("প্রোফাইল সংরক্ষণ হয়েছে!");
    nav({ to: "/dashboard" });
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <Card className="p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            শুরু করুন · Get Started
          </p>
          <h1 className="exam-heading mt-1 text-2xl font-bold">আপনার এইচএসসি প্রোফাইল তৈরি করুন</h1>
          <p className="text-sm text-muted-foreground mb-6">
            আপনার শ্রেণি, বিভাগ ও লক্ষ্য বছর জানালে অনুশীলন আরও সঠিকভাবে সাজানো যাবে।
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>পূর্ণ নাম · Full Name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="যেমন: রায়হান আহমেদ"
                required
              />
            </div>
            <div>
              <Label>শ্রেণি · Class</Label>
              <Select value={form.class} onValueChange={(v) => setForm({ ...form, class: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HSC 1st Year">এইচএসসি ১ম বর্ষ</SelectItem>
                  <SelectItem value="HSC 2nd Year">এইচএসসি ২য় বর্ষ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>বিভাগ · Group</Label>
              <Select
                value={form.student_group}
                onValueChange={(v) => setForm({ ...form, student_group: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Science">বিজ্ঞান · Science</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>লক্ষ্য পরীক্ষার বছর · Target Exam Year</Label>
              <Input
                type="number"
                min={2024}
                max={2035}
                value={form.target_exam_year}
                onChange={(e) => setForm({ ...form, target_exam_year: Number(e.target.value) })}
                required
              />
            </div>
            <Button className="w-full" disabled={busy}>
              {busy ? "সংরক্ষণ হচ্ছে..." : "ড্যাশবোর্ডে চলুন · Continue"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
