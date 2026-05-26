import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/bn";
import { useAuth } from "@/lib/auth";
import { allowedGroupsFor, subjectMatchesGroup } from "@/lib/student-group";
import { FileText, Library, Sparkles, Shuffle, Search, BookOpen } from "lucide-react";

type Subject = {
  id: string;
  name: string;
  name_bn: string | null;
  group_type?: string | null;
};

type Chapter = {
  id: string;
  name: string;
  name_bn: string | null;
  order_index: number | null;
};

type Mode = "chapter" | "board" | "ai" | "mixed";

const MODES: { key: Mode; bn: string; en: string; icon: typeof FileText }[] = [
  { key: "chapter", bn: "অধ্যায়ভিত্তিক", en: "Chapter Practice", icon: FileText },
  { key: "board", bn: "বোর্ড প্রশ্ন", en: "Past Board", icon: Library },
  { key: "ai", bn: "এআই প্রশ্ন", en: "AI Generated", icon: Sparkles },
  { key: "mixed", bn: "মিশ্র প্রস্তুতি", en: "Mixed", icon: Shuffle },
];

const fromTable = (n: string) => (supabase.from as unknown as (name: string) => any)(n);

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional pre-selected subject so we skip the subject step */
  initialSubjectId?: string | null;
};

export function QuickPractice({ open, onOpenChange, initialSubjectId }: Props) {
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chapter");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [search, setSearch] = useState("");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setChapterId(null);
      setSearch("");
    } else {
      setSubjectId(initialSubjectId ?? null);
    }
  }, [open, initialSubjectId]);

  // Load subjects once when opened
  useEffect(() => {
    if (!open || subjects.length) return;
    let alive = true;
    setLoadingSubjects(true);
    fromTable("subjects")
      .select("id, name, name_bn")
      .eq("is_active", true)
      .then(({ data }: { data: Subject[] | null }) => {
        if (!alive) return;
        setSubjects(data ?? []);
        setLoadingSubjects(false);
      });
    return () => {
      alive = false;
    };
  }, [open, subjects.length]);

  // Load chapters when subject changes
  useEffect(() => {
    if (!subjectId) {
      setChapters([]);
      return;
    }
    let alive = true;
    setLoadingChapters(true);
    setChapterId(null);
    fromTable("chapters")
      .select("id, name, name_bn, order_index")
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .order("order_index", { ascending: true })
      .then(({ data }: { data: Chapter[] | null }) => {
        if (!alive) return;
        setChapters(data ?? []);
        setLoadingChapters(false);
      });
    return () => {
      alive = false;
    };
  }, [subjectId]);

  const filteredChapters = useMemo(() => {
    if (!search.trim()) return chapters;
    const q = search.toLowerCase();
    return chapters.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.name_bn ?? "").toLowerCase().includes(q),
    );
  }, [chapters, search]);

  const start = () => {
    if (!chapterId) return;
    const subj = subjects.find((s) => s.id === subjectId);
    const chap = chapters.find((c) => c.id === chapterId);
    const subjText = `${subj?.name ?? ""} ${subj?.name_bn ?? ""}`.toLowerCase();
    const chapText = `${chap?.name ?? ""} ${chap?.name_bn ?? ""}`.toLowerCase();
    const isPhysics1 = /physics.*1|১ম.*পদার্থ|পদার্থ.*১ম|physics 1st/i.test(subjText);
    const isGravitation = /gravitation|মহাকর্ষ/i.test(chapText);
    onOpenChange(false);
    if (isPhysics1 && isGravitation) {
      nav({ to: "/demo/gravitation" });
      return;
    }
    nav({ to: "/practice", search: { chapterId, mode } });
  };

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-1/2 top-1/2 flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-[2px] border border-foreground/10 bg-card p-0 text-card-foreground shadow-[2px_2px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)] sm:h-[min(760px,90dvh)] sm:max-h-[90dvh] sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-foreground/10 px-5 py-4">
          <DialogTitle className="exam-heading text-base font-bold">
            দ্রুত অনুশীলন
            <span className="bn-label ml-2 text-[10px] font-normal opacity-60">
              Quick Practice
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {/* Step indicator */}
          <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className={subjectId ? "opacity-50 line-through" : "font-bold text-foreground"}>
              বিষয়
            </span>
            <span>→</span>
            <span className={chapterId ? "opacity-50 line-through" : subjectId ? "font-bold text-foreground" : ""}>
              অধ্যায়
            </span>
            <span>→</span>
            <span className={chapterId ? "font-bold text-foreground" : ""}>মোড</span>
          </div>

          {/* Subject row */}
          {!subjectId ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="exam-heading mb-3 text-sm font-bold">
                বিষয় বেছে নিন · Choose a subject
              </p>
              {loadingSubjects ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-start rounded border border-foreground/10 p-3"
                    >
                      <Skeleton className="mb-2 h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="mt-1 h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSubjectId(s.id)}
                      className="paper-tile flex flex-col items-start p-3 text-left transition hover:border-foreground/40"
                    >
                      <BookOpen className="mb-2 h-4 w-4 opacity-60" />
                      <span className="exam-heading text-sm font-semibold leading-tight">
                        {s.name}
                      </span>
                      {s.name_bn && (
                        <span className="bn-label mt-0.5 text-[10px] opacity-60">{s.name_bn}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Selected subject pill */}
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="opacity-60">বিষয়: </span>
                  <span className="exam-heading font-bold">{selectedSubject?.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setSubjectId(null);
                    setChapterId(null);
                  }}
                >
                  পরিবর্তন · Change
                </Button>
              </div>

              {/* Chapter search + list */}
              <div className="relative mb-3 shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
                <Input
                  placeholder="অধ্যায় খুঁজুন · Search chapter"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 text-sm"
                />
              </div>

              {loadingChapters ? (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 rounded border border-foreground/10 px-3 py-2">
                      <Skeleton className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : filteredChapters.length === 0 ? (
                <p className="rounded border border-dashed border-foreground/20 p-6 text-center text-sm text-muted-foreground">
                  কোনো অধ্যায় পাওয়া যায়নি
                </p>
              ) : (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                  {filteredChapters.map((c, idx) => {
                    const active = c.id === chapterId;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => setChapterId(c.id)}
                          className={`flex w-full items-center gap-3 rounded border px-3 py-2 text-left transition ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-foreground/10 hover:border-foreground/30"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                              active ? "border-background" : "border-foreground/30"
                            }`}
                          >
                            {toBnDigits(c.order_index ?? idx + 1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="exam-heading block text-sm font-semibold leading-tight">
                              {c.name}
                            </span>
                            {c.name_bn && (
                              <span
                                className={`bn-label text-[10px] ${
                                  active ? "opacity-80" : "opacity-60"
                                }`}
                              >
                                {c.name_bn}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Mode chips — shown once chapter chosen */}
              {chapterId && (
                <div className="mt-4 shrink-0 border-t border-foreground/10 pt-3">
                  <p className="exam-heading mb-3 text-xs font-bold uppercase tracking-widest opacity-70">
                    মোড · Practice Mode
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MODES.map(({ key, bn, en, icon: Icon }) => {
                      const active = mode === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setMode(key)}
                          className={`flex flex-col items-start gap-1 rounded border p-3 text-left transition ${
                            active
                              ? "border-foreground bg-foreground/5"
                              : "border-foreground/15 hover:border-foreground/40"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="exam-heading text-[12px] font-bold leading-tight">
                            {bn}
                          </span>
                          <span className="bn-label text-[10px] opacity-60">{en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-foreground/10 px-5 py-3">
          <p className="text-[10px] opacity-60">
            {chapterId ? "শুরু করতে প্রস্তুত · Ready" : "একটি অধ্যায় বেছে নিন"}
          </p>
          <Button onClick={start} disabled={!chapterId} className="exam-heading">
            শুরু করুন · Start Practice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
