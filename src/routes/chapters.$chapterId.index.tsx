import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Sparkles, BookOpenText, Upload, Repeat, FileText, NotebookText, ListChecks, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { toBnDigits } from "@/lib/bn";
import {
  getBoardStats, getChapterMeta, listBoardQuestions, listRepeatedPatterns,
  generateAISimilarQuestion, BOARDS,
} from "@/lib/board-questions.functions";

export const Route = createFileRoute("/chapters/$chapterId/")({
  component: ChapterDetailPage,
});

const QTYPES = ["mcq", "cq", "short", "grammar", "writing"];

const priorityLabel = (s: number) =>
  s >= 70 ? { bn: "অত্যন্ত গুরুত্বপূর্ণ", cls: "bg-red-100 text-red-700 border-red-200" }
  : s >= 40 ? { bn: "গুরুত্বপূর্ণ", cls: "bg-amber-100 text-amber-700 border-amber-200" }
  : { bn: "পরে অনুশীলন", cls: "bg-muted text-muted-foreground" };

function ChapterDetailPage() {
  const { chapterId } = Route.useParams();
  const meta = useServerFn(getChapterMeta);
  const stats = useServerFn(getBoardStats);

  const metaQ = useQuery({ queryKey: ["ch-meta", chapterId], queryFn: () => meta({ data: { chapter_id: chapterId } }) });
  const statsQ = useQuery({ queryKey: ["ch-stats", chapterId], queryFn: () => stats({ data: { chapter_id: chapterId } }) });

  const chapter: any = metaQ.data?.chapter;
  const subject: any = chapter?.subjects;

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">ড্যাশবোর্ড</Link>
          <span className="mx-2">/</span>
          <Link to="/subjects" className="hover:text-foreground">বিষয়</Link>
          {subject && (
            <>
              <span className="mx-2">/</span>
              <Link to="/chapters" search={{ subjectId: subject.id }} className="hover:text-foreground">
                {subject.name}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-foreground">{chapter?.name ?? "অধ্যায়"}</span>
        </nav>

        {/* Header */}
        <div className="mb-5">
          <p className="text-xs font-medium text-primary">
            {subject?.name ?? "Subject"}
            {subject?.paper ? ` · ${subject.paper}` : ""}
          </p>
          <h1 className="exam-heading text-2xl font-bold sm:text-3xl">{chapter?.name ?? "অধ্যায়"}</h1>
          {chapter?.name_bn && <p className="text-sm text-muted-foreground">{chapter.name_bn}</p>}
        </div>

        {/* Quick stats */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="Verified Q" value={statsQ.data?.total ?? 0} />
          <StatCard label="বছর" value={statsQ.data?.years ?? 0} />
          <StatCard label="বোর্ড" value={statsQ.data?.boards ?? 0} />
          <StatCard label="পুনরাবৃত্ত প্যাটার্ন" value={statsQ.data?.repeated ?? 0} />
          <StatCard label="উচ্চ গুরুত্ব" value={statsQ.data?.highPriority ?? 0} accent />
        </div>

        <Tabs defaultValue="board" className="w-full">
          <TabsList className="mb-4 flex flex-wrap gap-1">
            <TabsTrigger value="board"><BookOpenText className="mr-1 h-3.5 w-3.5" /> Board Questions</TabsTrigger>
            <TabsTrigger value="patterns"><Repeat className="mr-1 h-3.5 w-3.5" /> Repeated Patterns</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="mr-1 h-3.5 w-3.5" /> AI Similar</TabsTrigger>
            <TabsTrigger value="test"><ListChecks className="mr-1 h-3.5 w-3.5" /> Chapter Test</TabsTrigger>
            <TabsTrigger value="notes"><NotebookText className="mr-1 h-3.5 w-3.5" /> Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="board"><BoardTab chapterId={chapterId} /></TabsContent>
          <TabsContent value="patterns"><PatternsTab chapterId={chapterId} /></TabsContent>
          <TabsContent value="ai"><AITab chapterId={chapterId} /></TabsContent>
          <TabsContent value="test"><TestTab chapterId={chapterId} /></TabsContent>
          <TabsContent value="notes"><NotesTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={`p-3 text-center ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="exam-heading text-xl font-bold">{toBnDigits(value)}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </Card>
  );
}

// ===== BOARD QUESTIONS TAB =====
function BoardTab({ chapterId }: { chapterId: string }) {
  const list = useServerFn(listBoardQuestions);
  const nav = useNavigate();
  const [board, setBoard] = useState("any");
  const [qType, setQType] = useState("any");
  const [priority, setPriority] = useState("any");
  const [yearFrom, setYearFrom] = useState("2015");
  const [yearTo, setYearTo] = useState("2025");

  const filters = useMemo(() => ({
    chapter_id: chapterId,
    board: board === "any" ? undefined : board,
    question_type: qType === "any" ? undefined : qType,
    priority: priority === "any" ? undefined : (priority as any),
    year_from: parseInt(yearFrom),
    year_to: parseInt(yearTo),
  }), [chapterId, board, qType, priority, yearFrom, yearTo]);

  const q = useQuery({ queryKey: ["ch-bq", filters], queryFn: () => list({ data: filters }) });
  const questions: any[] = q.data?.questions ?? [];

  return (
    <div>
      <Card className="mb-3 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <FilterSelect label="বোর্ড" value={board} onChange={setBoard}
            options={[["any", "সব বোর্ড"], ...BOARDS.map((b) => [b, b] as [string, string])]} />
          <FilterSelect label="ধরন" value={qType} onChange={setQType}
            options={[["any", "সব"], ...QTYPES.map((t) => [t, t.toUpperCase()] as [string, string])]} />
          <FilterSelect label="গুরুত্ব" value={priority} onChange={setPriority}
            options={[["any", "সব"], ["very_important", "অত্যন্ত গুরুত্বপূর্ণ"], ["important", "গুরুত্বপূর্ণ"], ["practice_later", "পরে"]]} />
          <FilterSelect label="বছর হতে" value={yearFrom} onChange={setYearFrom}
            options={Array.from({ length: 11 }, (_, i) => [`${2015 + i}`, `${2015 + i}`] as [string, string])} />
          <FilterSelect label="বছর পর্যন্ত" value={yearTo} onChange={setYearTo}
            options={Array.from({ length: 11 }, (_, i) => [`${2015 + i}`, `${2015 + i}`] as [string, string])} />
        </div>
      </Card>

      {q.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : questions.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpenText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="exam-heading mb-2 font-semibold">এই chapter-এর জন্য এখনো verified board question নেই।</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/chapters/$chapterId" params={{ chapterId }} hash="ai">
                <Sparkles className="mr-1 h-4 w-4" /> AI Similar Practice তৈরি করুন
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/board-questions"><Upload className="mr-1 h-4 w-4" /> Admin question upload</Link>
            </Button>
            <Button asChild variant="ghost"><Link to="/subjects">অন্য chapter দেখুন</Link></Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {questions.map((qq) => {
            const p = priorityLabel(qq.priority_score ?? 0);
            const isAI = qq.source_type === "ai_generated";
            const sourceLabel = isAI ? "AI Similar" : qq.source_type === "teacher_verified" ? "Teacher Verified" : "Official Board";
            return (
              <Card key={qq.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{toBnDigits(qq.year ?? "-")}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{qq.board ?? "—"}</Badge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="exam-heading text-sm font-medium">{qq.question_text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[10px] uppercase">{qq.question_type}</Badge>
                      <Badge variant={isAI ? "outline" : "secondary"} className={isAI ? "border-purple-300 bg-purple-50 text-[10px] text-purple-700" : "text-[10px]"}>
                        {sourceLabel}
                      </Badge>
                      <Badge className={`text-[10px] ${p.cls}`}>{p.bn}</Badge>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => nav({
                    to: "/chapters/$chapterId/board-practice",
                    params: { chapterId },
                    search: { questionId: qq.id },
                  })}>
                    Practice <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== PATTERNS TAB =====
function PatternsTab({ chapterId }: { chapterId: string }) {
  const fn = useServerFn(listRepeatedPatterns);
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["ch-pat", chapterId], queryFn: () => fn({ data: { chapter_id: chapterId } }) });
  const patterns: any[] = q.data?.patterns ?? [];
  if (q.isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (patterns.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Repeated pattern দেখাতে আরও board question data প্রয়োজন।
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {patterns.map((p) => {
        const lbl = priorityLabel(p.priority_score ?? 0);
        return (
          <Card key={p.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="exam-heading font-semibold">{p.name_bn ?? p.name}</p>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  <span className="text-muted-foreground">বছর:</span>
                  {(p.appeared_years ?? []).map((y: number) => <Badge key={y} variant="outline">{toBnDigits(y)}</Badge>)}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  <span className="text-muted-foreground">বোর্ড:</span>
                  {(p.appeared_boards ?? []).map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Badge className={lbl.cls}>{lbl.bn}</Badge>
                  <span className="text-muted-foreground">পুনরাবৃত্তি: {toBnDigits(p.frequency_count)}</span>
                  <span className="text-muted-foreground">Priority: {toBnDigits(p.priority_score)}</span>
                </div>
              </div>
              <Button size="sm" onClick={() => nav({
                to: "/chapters/$chapterId/board-practice",
                params: { chapterId },
                search: { patternId: p.id },
              })}>
                এই pattern practice করুন
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ===== AI SIMILAR TAB =====
function AITab({ chapterId }: { chapterId: string }) {
  const gen = useServerFn(generateAISimilarQuestion);
  const [count, setCount] = useState<5 | 10 | 20>(5);
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("medium");
  const [board, setBoard] = useState("any");
  const [lang, setLang] = useState<"bn" | "en" | "mixed">("bn");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      toast.loading("AI প্রশ্ন তৈরি হচ্ছে…", { id: "ai" });
      await gen({ data: { chapter_id: chapterId, count: Math.min(count, 5) as 1 | 2 | 3 | 4 | 5 } });
      toast.success("AI Similar প্রশ্ন তৈরি হয়েছে — Board Questions tab-এ দেখুন", { id: "ai" });
    } catch (e: any) {
      toast.error(e.message ?? "ব্যর্থ", { id: "ai" });
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      <p className="exam-heading mb-1 font-semibold">AI Similar Practice তৈরি করুন</p>
      <p className="mb-4 text-xs text-muted-foreground">
        Board pattern অনুসারে নতুন practice প্রশ্ন। সব প্রশ্ন স্পষ্টভাবে "AI Generated — Not Official Board Question" হিসেবে চিহ্নিত হবে।
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FilterSelect label="সংখ্যা" value={String(count)} onChange={(v) => setCount(Number(v) as 5 | 10 | 20)}
          options={[["5", "৫"], ["10", "১০"], ["20", "২০"]]} />
        <FilterSelect label="কঠিনতা" value={diff} onChange={(v) => setDiff(v as any)}
          options={[["easy", "সহজ"], ["medium", "মাঝারি"], ["hard", "কঠিন"]]} />
        <FilterSelect label="বোর্ড" value={board} onChange={setBoard}
          options={[["any", "সব বোর্ড"], ...BOARDS.map((b) => [b, b] as [string, string])]} />
        <FilterSelect label="ভাষা" value={lang} onChange={(v) => setLang(v as any)}
          options={[["bn", "বাংলা"], ["en", "English"], ["mixed", "Mixed"]]} />
      </div>
      <Button onClick={run} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
        তৈরি করুন
      </Button>
    </Card>
  );
}

// ===== CHAPTER TEST TAB =====
function TestTab({ chapterId }: { chapterId: string }) {
  const [count, setCount] = useState("10");
  const [source, setSource] = useState("board");
  return (
    <Card className="p-5">
      <p className="exam-heading mb-1 font-semibold">Chapter Test</p>
      <p className="mb-4 text-xs text-muted-foreground">এই অধ্যায়ের প্রশ্ন দিয়ে একটি সংক্ষিপ্ত mock test।</p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FilterSelect label="প্রশ্ন সংখ্যা" value={count} onChange={setCount}
          options={[["10", "১০"], ["20", "২০"], ["30", "৩০"]]} />
        <FilterSelect label="সোর্স" value={source} onChange={setSource}
          options={[["board", "Board Questions"], ["ai", "AI Similar"], ["mixed", "Mixed"]]} />
      </div>
      <Button asChild>
        <Link to="/chapters/$chapterId/board-practice" params={{ chapterId }}>
          <FileText className="mr-1 h-4 w-4" /> Start Chapter Test
        </Link>
      </Button>
    </Card>
  );
}

// ===== NOTES TAB =====
function NotesTab() {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">
      <NotebookText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      এই chapter-এর notes এখনো যোগ করা হয়নি।
    </Card>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
