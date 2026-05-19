import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type JourneyStep = { step: string; title: string; bn: string; done?: boolean; current?: boolean };

const journey: JourneyStep[] = [
  { step: "1", title: "Choose Subject", bn: "বিষয় নির্বাচন", current: true },
  { step: "2", title: "Choose Chapter", bn: "অধ্যায় নির্বাচন" },
  { step: "3", title: "Pick Practice Mode", bn: "প্রস্তুতি মোড" },
  { step: "4", title: "Answer & Submit", bn: "উত্তর ও জমা" },
  { step: "5", title: "Result & Weak Chapter", bn: "ফলাফল ও দুর্বলতা" },
];

// Small inline tile primitive — keeps the journal-style hairline tile consistent.
function Tile({
  serial,
  className = "",
  children,
}: {
  serial?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`paper-tile relative p-4 ${className}`}>
      {serial && <span className="serial-marker hidden sm:block">{serial}</span>}
      {children}
    </div>
  );
}

function TileTitle({ en, bn }: { en: string; bn: string }) {
  return (
    <h2 className="exam-heading text-sm font-bold leading-tight text-foreground">
      {en}
      <br />
      <span className="bn-label block text-[10px] font-normal opacity-70">{bn}</span>
    </h2>
  );
}

function Dashboard() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && profile && !profile.onboarded) nav({ to: "/onboarding" });
  }, [loading, user, profile, nav]);

  const studentName = profile?.full_name || "শিক্ষার্থী";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[440px] px-5 py-8 sm:max-w-2xl sm:px-10 lg:max-w-5xl">
        {/* Header / Greeting */}
        <header className="relative mb-10 sm:pl-8">
          <span className="serial-marker hidden sm:block" style={{ top: 0 }}>
            01.
          </span>
          <h1 className="exam-heading text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Welcome, {profile?.full_name ? profile.full_name.split(" ")[0] : "Student"}
            <br />
            <span className="bn-label text-xl font-normal opacity-80 sm:text-2xl">
              স্বাগতম, {studentName}
            </span>
          </h1>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Track your progress and practice HSC exam-style questions daily — pick a subject,
            choose a chapter, sit the paper.
          </p>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {/* Practice Journey — full width */}
          <Tile serial="02." className="col-span-2 sm:col-span-4">
            <div className="mb-4 flex items-start justify-between">
              <TileTitle en="Practice Journey" bn="আপনার প্রস্তুতি যাত্রা" />
              <div className="border border-foreground/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                5 Steps · ৫ ধাপ
              </div>
            </div>
            <ol className="space-y-2.5 sm:grid sm:grid-cols-5 sm:gap-3 sm:space-y-0">
              {journey.map((s) => (
                <li
                  key={s.step}
                  className={`flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2 ${
                    s.current ? "" : "opacity-50"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                      s.current
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30"
                    }`}
                  >
                    {s.step}
                  </div>
                  <div className="flex-1 border-b border-foreground/5 pb-1 sm:w-full sm:border-b-0">
                    <p className="text-[11px] font-bold leading-tight">{s.title}</p>
                    <p className="bn-label text-[9px] opacity-60">{s.bn}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Tile>

          {/* HSC Subjects */}
          <Tile serial="03." className="col-span-1 aspect-square sm:col-span-2 sm:aspect-auto sm:min-h-[160px]">
            <Link to="/subjects" className="flex h-full flex-col justify-between">
              <TileTitle en="HSC Subjects" bn="এইচএসসি বিষয়সমূহ" />
              <div className="mt-auto flex items-end justify-between">
                <span className="text-[10px] uppercase tracking-widest opacity-50">Browse</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/15">
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          </Tile>

          {/* AI MCQs */}
          <Tile className="col-span-1 aspect-square sm:col-span-2 sm:aspect-auto sm:min-h-[160px]">
            <Link to="/practice" className="flex h-full flex-col justify-between">
              <TileTitle en="AI MCQs" bn="এআই এমসিকিউ" />
              <div className="mt-auto">
                <p className="text-[10px] opacity-60">Freshly generated</p>
                <p className="bn-label mt-0.5 text-[9px] opacity-50">তাজা প্রশ্ন</p>
              </div>
            </Link>
          </Tile>

          {/* Result Analytics — full width with bar chart */}
          <Tile serial="04." className="col-span-2 sm:col-span-4">
            <Link to="/analytics" className="block">
              <div className="mb-6 flex items-center justify-between">
                <TileTitle en="Result Analytics" bn="ফলাফল বিশ্লেষণ" />
                <div className="text-right">
                  <p className="exam-heading text-2xl font-bold leading-none">—</p>
                  <p className="mt-1 text-[8px] uppercase tracking-tighter opacity-50">
                    Run a practice to populate
                  </p>
                </div>
              </div>
              <div className="flex h-12 items-end gap-1 px-1">
                {[40, 60, 30, 80, 95].map((h, i) => (
                  <div
                    key={i}
                    className={i === 4 ? "flex-1 bg-foreground" : "flex-1 bg-foreground/10"}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </Link>
          </Tile>

          {/* Mock Test */}
          <Tile className="col-span-1 sm:col-span-2">
            <Link to="/mock-test" className="block">
              <h3 className="exam-heading text-xs font-bold leading-tight">
                Mock Test
                <br />
                <span className="bn-label text-[9px] font-normal opacity-70">মক টেস্ট</span>
              </h3>
              <div className="mt-4 flex gap-1.5">
                <div className="h-2 w-2 rounded-full border border-foreground/40" />
                <div className="h-2 w-2 rounded-full border border-foreground/40" />
                <div className="h-2 w-2 rounded-full border border-foreground/40 bg-foreground" />
              </div>
              <p className="mt-2 text-[9px] opacity-50">Full-paper timed simulation</p>
            </Link>
          </Tile>

          {/* Weak Areas */}
          <Tile className="col-span-1 sm:col-span-2">
            <Link to="/analytics" className="block">
              <h3 className="exam-heading text-xs font-bold leading-tight">
                Weak Areas
                <br />
                <span className="bn-label text-[9px] font-normal opacity-70">দুর্বল অধ্যায়</span>
              </h3>
              <div className="mt-4">
                <p className="text-[10px] underline decoration-foreground/20 underline-offset-4">
                  Open analytics to see focus areas
                </p>
              </div>
            </Link>
          </Tile>

          {/* Recent History — quiet footer strip */}
          <div className="col-span-2 mt-2 border-t border-foreground/10 pt-3 sm:col-span-4">
            <div className="flex items-center justify-between opacity-70">
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Recent History / ইতিহাস
              </span>
              <Link to="/history" className="text-[10px] italic underline-offset-2 hover:underline">
                View All →
              </Link>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between text-[11px] opacity-60">
                <span>No attempts yet</span>
                <span className="font-mono">—/—</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer notation */}
        <div className="mt-12 text-center">
          <div className="notation-rule">
            <p className="exam-heading text-[10px] italic opacity-50">
              Examination Practice Interface · Board Standard · বোর্ড মানদণ্ড
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
