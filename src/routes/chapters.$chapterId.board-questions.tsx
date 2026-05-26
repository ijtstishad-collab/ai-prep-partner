import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, ChevronRight, Filter, BookOpenText, Upload } from "lucide-react";
import { toBnDigits } from "@/lib/bn";
import {
  getBoardStats,
  listBoardQuestions,
  listRepeatedPatterns,
  getChapterMeta,
  generateAISimilarQuestion,
  BOARDS,
} from "@/lib/board-questions.functions";
import { toast } from "sonner";

type Tab = "all" | "repeated" | "pattern" | "high_priority" | "ai_similar";

const QUESTION_TYPES = ["mcq", "cq", "short", "grammar", "writing"];

export const Route = createFileRoute("/chapters/$chapterId/board-questions")({
  component: BoardQuestionsPage,
});

const priorityLabel = (s: number) =>
  s >= 70 ? { bn: "অত্যন্ত গুরুত্বপূর্ণ", cls: "bg-red-100 text-red-700 border-red-200" }
  : s >= 40 ? { bn: "গুরুত্বপূর্ণ", cls: "bg-amber-100 text-amber-700 border-amber-200" }
  : { bn: "পরে অনুশীলন", cls: "bg-muted text-muted-foreground" };

function BoardQuestionsPage() {
  const { chapterId } = Route.useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [exam, setExam] = useState<string>("any");
  const [board, setBoard] = useState<string>("any");
  const [qType, setQType] = useState<string>("any");
  const [priority, setPriority] = useState<string>("any");
  const [yearFrom, setYearFrom] = useState<string>("2015");
  const [yearTo, setYearTo] = useState<string>("2025");

  const meta = useServerFn(getChapterMeta);
  const stats = useServerFn(getBoardStats);
  const list = useServerFn(listBoardQuestions);
  const patterns = useServerFn(listRepeatedPatterns);
  const genAI = useServerFn(generateAISimilarQuestion);

  const metaQ = useQuery({ queryKey: ["bq-meta", chapterId], queryFn: () => meta({ data: { chapter_id: chapterId } }) });
  const statsQ = useQuery({ queryKey: ["bq-stats", chapterId], queryFn: () => stats({ data: { chapter_id: chapterId } }) });

  const filters = useMemo(() => ({
    chapter_id: chapterId,
    tab,
    exam_level: exam === "any" ? undefined : (exam as "SSC" | "HSC"),
    board: board === "any" ? undefined : board,
    question_type: qType === "any" ? undefined : qType,
    priority: priority === "any" ? undefined : (priority as any),
    year_from: yearFrom ? parseInt(yearFrom) : undefined,
    year_to: yearTo ? parseInt(yearTo) : undefined,
  }), [chapterId, tab, exam, board, qType, priority, yearFrom, yearTo]);

  const listQ = useQuery({
    queryKey: ["bq-list", filters],
    queryFn: () => list({ data: filters }),
    enabled: tab !== "repeated" && tab !== "pattern",
  });

  const patternsQ = useQuery({
    queryKey: ["bq-patterns", chapterId],
    queryFn: () => patterns({ data: { chapter_id: chapterId } }),
    enabled: tab === "repeated" || tab === "pattern",
  });

  const chapter: any = metaQ.data?.chapter;
  const subject: any = chapter?.subjects;
  const examLevel = subject?.group_type === "hsc" ? "HSC" : "SSC";

  const handleGenerateAI = async (sourceId?: string) => {
    try {
      toast.loading("এআই দিয়ে প্রশ্ন তৈরি হচ্ছে...", { id: "ai-gen" });
      await genAI({ data: { chapter_id: chapterId, source_question_id: sourceId, count: 3 } });
      toast.success("AI Similar প্রশ্ন তৈরি হয়েছে", { id: "ai-gen" });
      listQ.refetch();
    } catch (e: any) {
      toast.error(e.message ?? "ব্যর্থ হয়েছে", { id: "ai-gen" });
    }
  };

  const questions: any[] = listQ.data?.questions ?? [];
  const patternList: any[] = patternsQ.data?.patterns ?? [];

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">ড্যাশবোর্ড</Link>
          <span className="mx-2">/</span>
          <Link to="/subjects" className="hover:text-foreground">বিষয়</Link>
          {subject ? (
            <>
              <span className="mx-2">/</span>
              <span>{examLevel}</span>
              <span className="mx-2">/</span>
              <Link to="/chapters" search={{ subjectId: subject.id }} className="hover:text-foreground">
                {subject.name}
              </Link>
            </>
          ) : null}
          <span className="mx-2">/</span>
          <span className="text-foreground">{chapter?.name ?? "অধ্যায়"}</span>
        </nav>

        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">Board Questions</p>
            <h1 className="exam-heading text-2xl font-bold sm:text-3xl">
              {chapter?.name ?? "অধ্যায়"} — বোর্ড প্রশ্ন
            </h1>
            {chapter?.name_bn && <p className="text-sm text-muted-foreground">{chapter.name_bn}</p>}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/practice" search={{ chapterId, mode: "board" }}>
              Quick Practice <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="মোট প্রশ্ন" value={statsQ.data?.total ?? 0} />
          <StatCard label="বছর" value={statsQ.data?.years ?? 0} />
          <StatCard label="বোর্ড" value={statsQ.data?.boards ?? 0} />
          <StatCard label="পুনরাবৃত্ত প্যাটার্ন" value={statsQ.data?.repeated ?? 0} />
          <StatCard label="উচ্চ গুরুত্ব" value={statsQ.data?.highPriority ?? 0} accent />
        </div>

        {/* Filters */}
        <Card className="mb-4 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> ফিল্টার
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <FilterSelect label="পরীক্ষা" value={exam} onChange={setExam} options={[["any", "সব"], ["SSC", "SSC"], ["HSC", "HSC"]]} />
            <FilterSelect label="বোর্ড" value={board} onChange={setBoard} options={[["any", "সব"], ...BOARDS.map((b) => [b, b] as [string, string])]} />
            <FilterSelect label="ধরন" value={qType} onChange={setQType} options={[["any", "সব"], ...QUESTION_TYPES.map((t) => [t, t.toUpperCase()] as [string, string])]} />
            <FilterSelect label="গুরুত্ব" value={priority} onChange={setPriority} options={[
              ["any", "সব"], ["very_important", "অত্যন্ত গুরুত্বপূর্ণ"], ["important", "গুরুত্বপূর্ণ"], ["practice_later", "পরে"],
            ]} />
            <FilterSelect label="বছর হতে" value={yearFrom} onChange={setYearFrom} options={Array.from({ length: 11 }, (_, i) => [`${2015 + i}`, `${2015 + i}`] as [string, string])} />
            <FilterSelect label="বছর পর্যন্ত" value={yearTo} onChange={setYearTo} options={Array.from({ length: 11 }, (_, i) => [`${2015 + i}`, `${2015 + i}`] as [string, string])} />
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-3 flex flex-wrap">
            <TabsTrigger value="all">সব প্রশ্ন</TabsTrigger>
            <TabsTrigger value="repeated">পুনরাবৃত্ত</TabsTrigger>
            <TabsTrigger value="high_priority">উচ্চ গুরুত্ব</TabsTrigger>
            <TabsTrigger value="ai_similar">AI Similar</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {tab === "repeated" || tab === "pattern" ? (
          <PatternList patterns={patternList} loading={patternsQ.isLoading} chapterId={chapterId} />
        ) : (
          <QuestionList
            questions={questions}
            loading={listQ.isLoading}
            onPractice={(q) => nav({ to: "/chapters/$chapterId/board-practice", params: { chapterId }, search: { questionId: q.id } })}
            onGenAI={handleGenerateAI}
            onEmptyGenAI={() => handleGenerateAI()}
          />
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={`p-3 text-center ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="exam-heading text-2xl font-bold">{toBnDigits(value)}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
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

function QuestionList({
  questions, loading, onPractice, onGenAI, onEmptyGenAI,
}: {
  questions: any[]; loading: boolean;
  onPractice: (q: any) => void;
  onGenAI: (id: string) => void;
  onEmptyGenAI: () => void;
}) {
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (questions.length === 0) return <EmptyState onGenerate={onEmptyGenAI} />;

  return (
    <div className="space-y-2">
      {questions.map((q) => {
        const p = priorityLabel(q.priority_score ?? 0);
        const isAI = q.source_type === "ai_generated";
        return (
          <Card key={q.id} className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex shrink-0 flex-col items-center gap-1">
                <Badge variant="outline" className="text-[10px]">{toBnDigits(q.year ?? "-")}</Badge>
                <Badge variant="secondary" className="text-[10px]">{q.board ?? "—"}</Badge>
              </div>
              <div className="min-w-0 flex-1">
                <p className="exam-heading text-sm font-medium leading-snug">{q.question_text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-[10px] uppercase">{q.question_type}</Badge>
                  {isAI && <Badge className="border-purple-300 bg-purple-50 text-[10px] text-purple-700">AI Similar</Badge>}
                  {q.verification_status === "review_needed" && (
                    <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">Review Needed</Badge>
                  )}
                  <Badge className={`text-[10px] ${p.cls}`}>{p.bn}</Badge>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button size="sm" variant="default" onClick={() => onPractice(q)}>অনুশীলন</Button>
                {!isAI && (
                  <Button size="sm" variant="outline" onClick={() => onGenAI(q.id)}>
                    <Sparkles className="mr-1 h-3 w-3" /> Similar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PatternList({ patterns, loading, chapterId }: { patterns: any[]; loading: boolean; chapterId: string }) {
  const nav = useNavigate();
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (patterns.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        এখনো কোনো পুনরাবৃত্ত প্যাটার্ন চিহ্নিত হয়নি।
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
                {p.name_bn && <p className="text-xs text-muted-foreground">{p.name}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="text-muted-foreground">বছর:</span>
                  {(p.appeared_years ?? []).map((y: number) => <Badge key={y} variant="outline">{toBnDigits(y)}</Badge>)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="text-muted-foreground">বোর্ড:</span>
                  {(p.appeared_boards ?? []).map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Badge className={lbl.cls}>{lbl.bn}</Badge>
                  <span className="text-muted-foreground">পুনরাবৃত্তি: {toBnDigits(p.frequency_count)} বার</span>
                </div>
              </div>
              <Button size="sm" onClick={() => nav({ to: "/chapters/$chapterId/board-practice", params: { chapterId }, search: { patternId: p.id } })}>
                এই প্যাটার্ন অনুশীলন
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <Card className="p-8 text-center">
      <BookOpenText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="exam-heading mb-2 font-semibold">কোনো যাচাইকৃত Board Question নেই</p>
      <p className="mx-auto mb-5 max-w-lg text-sm text-muted-foreground">
        এই অধ্যায়ের জন্য এখনো কোনো যাচাইকৃত Board Question নেই। আপনি চাইলে AI দিয়ে board pattern অনুযায়ী practice set তৈরি করতে পারেন।
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onGenerate}>
          <Sparkles className="mr-1 h-4 w-4" /> AI দিয়ে Board Pattern Practice তৈরি করুন
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/board-questions">
            <Upload className="mr-1 h-4 w-4" /> Board Question Upload
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/subjects">অন্য অধ্যায়ে যান</Link>
        </Button>
      </div>
    </Card>
  );
}
