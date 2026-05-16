import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

const tiers = [
  { name: "Free", price: "৳0", period: "forever", features: ["3 AI-generated questions per day", "Practice tests", "Basic progress tracking"], cta: "Start Free", highlight: false },
  { name: "Premium", price: "৳299", period: "/month", features: ["Unlimited AI-generated questions", "All subjects & chapters", "Mock exams", "Weak area analysis", "Simple Bangla explanations"], cta: "Go Premium", highlight: true },
  { name: "Yearly", price: "৳2,499", period: "/year", features: ["Everything in Premium", "Save ৳1,089", "Priority support", "Teacher-reviewed question bank"], cta: "Choose Yearly", highlight: false },
];

function PricingPage() {
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold">Simple, student-friendly pricing</h1>
          <p className="text-muted-foreground mt-2">শিক্ষার্থীদের জন্য সাশ্রয়ী প্ল্যান</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {tiers.map((t) => (
            <Card key={t.name} className={`p-6 ${t.highlight ? "border-primary shadow-elegant bg-gradient-card" : ""}`}>
              {t.highlight && <div className="text-xs font-semibold text-primary mb-2">MOST POPULAR</div>}
              <h3 className="text-xl font-bold">{t.name}</h3>
              <div className="mt-2 mb-4"><span className="text-4xl font-bold">{t.price}</span><span className="text-muted-foreground"> {t.period}</span></div>
              <ul className="space-y-2 mb-6 text-sm">
                {t.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-success mt-0.5" /> {f}</li>)}
              </ul>
              <Button asChild className="w-full" variant={t.highlight ? "default" : "outline"}><Link to="/auth">{t.cta}</Link></Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
