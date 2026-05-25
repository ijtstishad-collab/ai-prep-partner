import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toBnDigits, toBnOptionLabel } from "@/lib/bn";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/demo/gravitation")({
  component: DemoGravitationPage,
  head: () => ({
    meta: [
      { title: "ডেমো অনুশীলন · মহাকর্ষ — Physics 1st Paper" },
      {
        name: "description",
        content:
          "এইচএসসি পদার্থবিজ্ঞান ১ম পত্রের মহাকর্ষ অধ্যায়ের ১০টি নমুনা এমসিকিউ অনুশীলন।",
      },
    ],
  }),
});

type Topic =
  | "newtonian_gravity"
  | "kepler_orbits"
  | "gravitational_field"
  | "potential_energy"
  | "escape_velocity"
  | "satellites";

const TOPIC_LABEL: Record<Topic, string> = {
  newtonian_gravity: "নিউটনের মহাকর্ষ সূত্র",
  kepler_orbits: "কেপলারের সূত্র ও কক্ষপথ",
  gravitational_field: "মহাকর্ষীয় ক্ষেত্র ও ত্বরণ (g)",
  potential_energy: "মহাকর্ষীয় বিভব ও বিভব শক্তি",
  escape_velocity: "মুক্তিবেগ",
  satellites: "কৃত্রিম উপগ্রহ ও কক্ষীয় বেগ",
};

type DemoQuestion = {
  id: string;
  topic: Topic;
  question_text: string;
  options: { key: "A" | "B" | "C" | "D"; text: string }[];
  correct: "A" | "B" | "C" | "D";
  explanation_bn: string;
  difficulty: "সহজ" | "মাঝারি" | "কঠিন";
};

const QUESTIONS: DemoQuestion[] = [
  {
    id: "q1",
    topic: "newtonian_gravity",
    difficulty: "সহজ",
    question_text:
      "দুটি বস্তুর মধ্যবর্তী দূরত্ব দ্বিগুণ করা হলে তাদের মধ্যকার মহাকর্ষ বল কতগুণ হবে?",
    options: [
      { key: "A", text: "দ্বিগুণ" },
      { key: "B", text: "অর্ধেক" },
      { key: "C", text: "এক-চতুর্থাংশ" },
      { key: "D", text: "চারগুণ" },
    ],
    correct: "C",
    explanation_bn:
      "নিউটনের মহাকর্ষ সূত্র অনুসারে F ∝ 1/r²। দূরত্ব দ্বিগুণ হলে বল (1/2)² = 1/4 গুণ, অর্থাৎ এক-চতুর্থাংশ হবে।",
  },
  {
    id: "q2",
    topic: "newtonian_gravity",
    difficulty: "সহজ",
    question_text:
      "মহাকর্ষ ধ্রুবক G-এর SI একক কোনটি?",
    options: [
      { key: "A", text: "N·m²·kg⁻²" },
      { key: "B", text: "N·kg⁻¹" },
      { key: "C", text: "m·s⁻²" },
      { key: "D", text: "N·m·kg⁻¹" },
    ],
    correct: "A",
    explanation_bn:
      "F = G·m₁m₂/r² থেকে G = F·r²/(m₁m₂)। একক বিশ্লেষণে G-এর SI একক N·m²·kg⁻²।",
  },
  {
    id: "q3",
    topic: "gravitational_field",
    difficulty: "মাঝারি",
    question_text:
      "পৃথিবীর পৃষ্ঠ থেকে R উচ্চতায় (R = পৃথিবীর ব্যাসার্ধ) উঠলে অভিকর্ষজ ত্বরণ g'-এর মান হবে—",
    options: [
      { key: "A", text: "g" },
      { key: "B", text: "g/2" },
      { key: "C", text: "g/4" },
      { key: "D", text: "g/9" },
    ],
    correct: "C",
    explanation_bn:
      "g' = g · R²/(R+h)²। h = R বসিয়ে g' = g · R²/(2R)² = g/4।",
  },
  {
    id: "q4",
    topic: "gravitational_field",
    difficulty: "মাঝারি",
    question_text:
      "পৃথিবীর কেন্দ্র থেকে গভীরতা d-এ অভিকর্ষজ ত্বরণের মান g_d কত?",
    options: [
      { key: "A", text: "g(1 − d/R)" },
      { key: "B", text: "g(1 + d/R)" },
      { key: "C", text: "g · R/(R−d)" },
      { key: "D", text: "g · (R−d)²/R²" },
    ],
    correct: "A",
    explanation_bn:
      "সমসত্ত্ব পৃথিবী ধরে নিলে গভীরতা d-এ g_d = g(1 − d/R)। পৃথিবীর কেন্দ্রে (d = R) g_d = 0 হয়।",
  },
  {
    id: "q5",
    topic: "kepler_orbits",
    difficulty: "মাঝারি",
    question_text:
      "কেপলারের তৃতীয় সূত্র অনুসারে কোন সম্পর্কটি সঠিক? (T = পর্যায়কাল, r = কক্ষপথের গড় ব্যাসার্ধ)",
    options: [
      { key: "A", text: "T ∝ r" },
      { key: "B", text: "T² ∝ r³" },
      { key: "C", text: "T³ ∝ r²" },
      { key: "D", text: "T² ∝ 1/r³" },
    ],
    correct: "B",
    explanation_bn:
      "কেপলারের তৃতীয় সূত্র (Harmonic Law): T² ∝ r³। অর্থাৎ গ্রহের পর্যায়কালের বর্গ তার গড় কক্ষপথ-ব্যাসার্ধের ঘনের সমানুপাতিক।",
  },
  {
    id: "q6",
    topic: "kepler_orbits",
    difficulty: "কঠিন",
    question_text:
      "একটি গ্রহের কক্ষীয় ব্যাসার্ধ পৃথিবীর কক্ষীয় ব্যাসার্ধের ৪ গুণ হলে এর পর্যায়কাল পৃথিবীর পর্যায়কালের কতগুণ হবে?",
    options: [
      { key: "A", text: "৪ গুণ" },
      { key: "B", text: "৮ গুণ" },
      { key: "C", text: "১৬ গুণ" },
      { key: "D", text: "২ গুণ" },
    ],
    correct: "B",
    explanation_bn:
      "T² ∝ r³ ⇒ T ∝ r^(3/2)। r' = 4r হলে T' = T · 4^(3/2) = T · 8। অর্থাৎ ৮ গুণ।",
  },
  {
    id: "q7",
    topic: "escape_velocity",
    difficulty: "মাঝারি",
    question_text:
      "পৃথিবীর পৃষ্ঠ থেকে মুক্তিবেগের সঠিক রাশিমালা কোনটি?",
    options: [
      { key: "A", text: "v_e = √(gR)" },
      { key: "B", text: "v_e = √(2gR)" },
      { key: "C", text: "v_e = 2√(gR)" },
      { key: "D", text: "v_e = √(gR/2)" },
    ],
    correct: "B",
    explanation_bn:
      "শক্তি সংরক্ষণ থেকে ½mv_e² = GMm/R ⇒ v_e = √(2GM/R) = √(2gR)। পৃথিবীর ক্ষেত্রে এর মান প্রায় ১১.২ km/s।",
  },
  {
    id: "q8",
    topic: "potential_energy",
    difficulty: "কঠিন",
    question_text:
      "পৃথিবীর কেন্দ্র থেকে r দূরত্বে (r ≥ R) m ভরের কণার মহাকর্ষীয় বিভব শক্তি U হলো—",
    options: [
      { key: "A", text: "U = +GMm/r" },
      { key: "B", text: "U = −GMm/r" },
      { key: "C", text: "U = −GMm/r²" },
      { key: "D", text: "U = mgh" },
    ],
    correct: "B",
    explanation_bn:
      "অসীমকে শূন্য বিভব ধরে U = −GMm/r। ঋণাত্মক চিহ্ন বুঝায় যে বস্তুটি মহাকর্ষীয় বন্ধনে আছে। mgh কেবল ক্ষুদ্র h-এর জন্য আনুমানিক রূপ।",
  },
  {
    id: "q9",
    topic: "satellites",
    difficulty: "মাঝারি",
    question_text:
      "পৃথিবীর পৃষ্ঠের কাছে আবর্তনশীল কৃত্রিম উপগ্রহের কক্ষীয় বেগ প্রায়—",
    options: [
      { key: "A", text: "৭.৯ km/s" },
      { key: "B", text: "১১.২ km/s" },
      { key: "C", text: "৩.১ km/s" },
      { key: "D", text: "১.৬ km/s" },
    ],
    correct: "A",
    explanation_bn:
      "নিম্ন কক্ষপথে v_o = √(gR) ≈ √(9.8 × 6.4 × 10⁶) ≈ ৭.৯ km/s। মুক্তিবেগ v_e = √2 · v_o ≈ ১১.২ km/s।",
  },
  {
    id: "q10",
    topic: "satellites",
    difficulty: "কঠিন",
    question_text:
      "ভূ-স্থির (geostationary) উপগ্রহ সম্পর্কে কোন তথ্যটি সঠিক নয়?",
    options: [
      { key: "A", text: "এর পর্যায়কাল ২৪ ঘণ্টা" },
      { key: "B", text: "এটি বিষুবরেখার সমতলে অবস্থান করে" },
      { key: "C", text: "এর কক্ষপথের ব্যাসার্ধ প্রায় ৪২,০০০ km" },
      { key: "D", text: "এর কক্ষীয় বেগ পৃথিবীপৃষ্ঠের কাছের উপগ্রহের চেয়ে বেশি" },
    ],
    correct: "D",
    explanation_bn:
      "ভূ-স্থির উপগ্রহের কক্ষীয় বেগ v_o = √(GM/r) সূত্রানুসারে r বেশি হওয়ায় কম হয় (প্রায় ৩.১ km/s), নিম্ন কক্ষপথের ৭.৯ km/s-এর চেয়ে কম। বাকি তথ্যগুলো সঠিক।",
  },
];

const NEXT_CHAPTERS: { name_bn: string; reason_bn: string }[] = [
  {
    name_bn: "নিউটনীয় বলবিদ্যা (Newtonian Mechanics)",
    reason_bn: "মহাকর্ষের ভিত্তি — বল, ত্বরণ ও সংরক্ষণ সূত্র মজবুত করুন।",
  },
  {
    name_bn: "কাজ, শক্তি ও ক্ষমতা",
    reason_bn: "মহাকর্ষীয় বিভব শক্তি ও মুক্তিবেগ বুঝতে শক্তি সংরক্ষণ জরুরি।",
  },
  {
    name_bn: "পর্যায়বৃত্ত গতি (Periodic Motion)",
    reason_bn: "কেপলারের সূত্র ও কক্ষীয় গতির সাথে পর্যায়কালের গভীর সম্পর্ক।",
  },
];

type Phase = "intro" | "quiz" | "results";

function DemoGravitationPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});

  const total = QUESTIONS.length;
  const currentQuestion = QUESTIONS[currentIndex];
  const selected = answers[currentQuestion?.id ?? ""] ?? null;
  const progress = Math.round(((currentIndex + 1) / total) * 100);

  const correctCount = useMemo(
    () => QUESTIONS.filter((q) => answers[q.id] === q.correct).length,
    [answers],
  );
  const wrongCount = useMemo(
    () => QUESTIONS.filter((q) => answers[q.id] && answers[q.id] !== q.correct).length,
    [answers],
  );

  const topicBreakdown = useMemo(() => {
    const map = new Map<Topic, { total: number; correct: number }>();
    for (const q of QUESTIONS) {
      const entry = map.get(q.topic) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (answers[q.id] === q.correct) entry.correct += 1;
      map.set(q.topic, entry);
    }
    return Array.from(map.entries())
      .map(([topic, v]) => ({
        topic,
        ...v,
        pct: Math.round((v.correct / v.total) * 100),
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [answers]);

  const weakTopics = topicBreakdown.filter((t) => t.pct < 60);

  const reset = () => {
    setPhase("intro");
    setCurrentIndex(0);
    setAnswers({});
  };

  const startQuiz = () => {
    setAnswers({});
    setCurrentIndex(0);
    setPhase("quiz");
  };

  const submitAndAdvance = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase("results");
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">ড্যাশবোর্ড</Link>
          <span className="mx-2">/</span>
          <Link to="/subjects" className="hover:text-foreground">বিষয়সমূহ</Link>
          <span className="mx-2">/</span>
          <span>Physics 1st Paper</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">মহাকর্ষ · ডেমো</span>
        </nav>

        {phase === "intro" ? (
          <IntroCard onStart={startQuiz} />
        ) : phase === "quiz" ? (
          <QuizCard
            question={currentQuestion}
            index={currentIndex}
            total={total}
            progress={progress}
            selected={selected}
            onSelect={(key) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }))
            }
            onSubmit={submitAndAdvance}
          />
        ) : (
          <ResultsView
            correctCount={correctCount}
            wrongCount={wrongCount}
            total={total}
            answers={answers}
            topicBreakdown={topicBreakdown}
            weakTopics={weakTopics}
            onRetake={reset}
          />
        )}
      </div>
    </AppShell>
  );
}

function IntroCard({ onStart }: { onStart: () => void }) {
  return (
    <Card className="paper-sheet p-8 text-center">
      <GraduationCap className="mx-auto mb-3 h-12 w-12 text-primary" />
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        এআই প্রেপ পার্টনার · এইচএসসি ডেমো
      </p>
      <h1 className="exam-heading mt-2 text-3xl font-bold">মহাকর্ষ</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Physics 1st Paper · Gravitation (Demo Practice)
      </p>

      <div className="mx-auto mt-6 grid max-w-2xl gap-2 text-left text-sm sm:grid-cols-3">
        <InfoTile label="প্রশ্ন" value="১০টি এমসিকিউ" />
        <InfoTile label="ধরন" value="বোর্ড-স্টাইল" />
        <InfoTile label="নম্বর" value="১০" />
      </div>

      <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
        নিজে বেছে নিন উত্তর, জমা দেওয়ার পর প্রতিটি প্রশ্নের ব্যাখ্যা, দুর্বল
        টপিক বিশ্লেষণ ও পরবর্তী অধ্যায়ের পরামর্শ পাবেন।
      </p>

      <Button size="lg" onClick={onStart} className="mt-6">
        <Sparkles className="mr-1 h-4 w-4" />
        শুরু করুন · Start Demo
      </Button>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-white/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function QuizCard({
  question,
  index,
  total,
  progress,
  selected,
  onSelect,
  onSubmit,
}: {
  question: DemoQuestion;
  index: number;
  total: number;
  progress: number;
  selected: "A" | "B" | "C" | "D" | null;
  onSelect: (key: "A" | "B" | "C" | "D") => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="paper-sheet overflow-hidden">
      <div className="paper-divider border-b-2 px-6 pt-6 pb-4 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          এইচএসসি ডেমো অনুশীলন
        </p>
        <h1 className="exam-heading mt-1 text-2xl font-bold sm:text-3xl">
          Physics 1st Paper · মহাকর্ষ
        </h1>
      </div>

      <div className="border-b bg-muted/30 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            প্রশ্ন {toBnDigits(index + 1)} / {toBnDigits(total)}
          </span>
          <Badge variant="outline" className="text-xs">
            {question.difficulty}
          </Badge>
        </div>
        <Progress value={progress} className="mt-2 h-1.5" />
      </div>

      <div className="px-6 py-6">
        <div className="flex items-baseline gap-3">
          <span className="exam-heading text-lg font-bold">
            {toBnDigits(index + 1)}.
          </span>
          <h2 className="exam-heading text-lg font-semibold leading-7">
            {question.question_text}
          </h2>
        </div>

        <div className="mt-5 space-y-2">
          {question.options.map((option, idx) => {
            const isSel = selected === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelect(option.key)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-lg border bg-white px-4 py-3 text-left transition",
                  isSel
                    ? "border-foreground shadow-sm"
                    : "border-input hover:border-foreground/40 hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "omr-bubble",
                    isSel && "omr-bubble--selected",
                  )}
                >
                  {toBnOptionLabel(option.key, idx)}
                </span>
                <span className="flex-1 text-sm sm:text-base">{option.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="paper-divider flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
        <div className="text-xs text-muted-foreground">
          সকল প্রশ্ন শেষে ফলাফল ও ব্যাখ্যা দেখানো হবে।
        </div>
        <Button onClick={onSubmit} disabled={!selected}>
          {index < total - 1 ? (
            <>পরবর্তী প্রশ্ন <ChevronRight className="h-4 w-4" /></>
          ) : (
            <>ফলাফল দেখুন <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
      </div>
    </Card>
  );
}

function ResultsView({
  correctCount,
  wrongCount,
  total,
  answers,
  topicBreakdown,
  weakTopics,
  onRetake,
}: {
  correctCount: number;
  wrongCount: number;
  total: number;
  answers: Record<string, "A" | "B" | "C" | "D">;
  topicBreakdown: { topic: Topic; total: number; correct: number; pct: number }[];
  weakTopics: { topic: Topic; total: number; correct: number; pct: number }[];
  onRetake: () => void;
}) {
  const scorePct = Math.round((correctCount / total) * 100);
  return (
    <div className="space-y-4">
      {/* Score summary */}
      <Card className="paper-sheet p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              ফলাফল · Score Summary
            </p>
            <h2 className="exam-heading mt-1 text-3xl font-bold">
              {toBnDigits(correctCount)} / {toBnDigits(total)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              সঠিক উত্তরের হার {toBnDigits(scorePct)}%
            </p>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-success/15 text-success hover:bg-success/15">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              সঠিক {toBnDigits(correctCount)}
            </Badge>
            <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">
              <XCircle className="mr-1 h-3.5 w-3.5" />
              ভুল {toBnDigits(wrongCount)}
            </Badge>
          </div>
        </div>
        <Progress value={scorePct} className="mt-4 h-2" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onRetake} variant="outline" size="sm">
            <RefreshCw className="mr-1 h-4 w-4" /> আবার চেষ্টা করুন
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/subjects">অন্য অধ্যায়</Link>
          </Button>
        </div>
      </Card>

      {/* Weak topic analysis */}
      <Card className="paper-sheet p-6">
        <h3 className="exam-heading flex items-center gap-2 text-lg font-semibold">
          <Target className="h-5 w-5 text-primary" />
          দুর্বল টপিক বিশ্লেষণ
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          প্রতিটি টপিকে আপনার সঠিকতার হার। ৬০% এর নিচে থাকলে আরও অনুশীলন দরকার।
        </p>
        <div className="mt-4 space-y-3">
          {topicBreakdown.map((t) => (
            <div key={t.topic}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{TOPIC_LABEL[t.topic]}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    t.pct < 60 ? "text-destructive" : "text-success",
                  )}
                >
                  {toBnDigits(t.correct)} / {toBnDigits(t.total)} ·{" "}
                  {toBnDigits(t.pct)}%
                </span>
              </div>
              <Progress value={t.pct} className="mt-1 h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      {/* Per-question review */}
      <Card className="paper-sheet p-6">
        <h3 className="exam-heading text-lg font-semibold">প্রশ্নভিত্তিক ব্যাখ্যা</h3>
        <div className="mt-4 space-y-4">
          {QUESTIONS.map((q, i) => {
            const userAns = answers[q.id];
            const isCorrect = userAns === q.correct;
            const userText =
              q.options.find((o) => o.key === userAns)?.text ?? "—";
            const correctText =
              q.options.find((o) => o.key === q.correct)?.text ?? "";
            return (
              <div
                key={q.id}
                className={cn(
                  "rounded-lg border p-4",
                  isCorrect
                    ? "border-success/40 bg-success/5"
                    : "border-destructive/40 bg-destructive/5",
                )}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="exam-heading text-sm font-semibold">
                      {toBnDigits(i + 1)}. {q.question_text}
                    </p>
                    <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          আপনার উত্তর
                        </span>
                        <p
                          className={cn(
                            "font-medium",
                            isCorrect ? "text-success" : "text-destructive",
                          )}
                        >
                          {userText}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          সঠিক উত্তর
                        </span>
                        <p className="font-medium text-success">{correctText}</p>
                      </div>
                    </div>
                    <p className="mt-3 rounded bg-white/70 px-3 py-2 text-sm leading-6">
                      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        ব্যাখ্যা:
                      </span>
                      {q.explanation_bn}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      টপিক: {TOPIC_LABEL[q.topic]}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Suggested next chapters */}
      <Card className="paper-sheet p-6">
        <h3 className="exam-heading flex items-center gap-2 text-lg font-semibold">
          <BookOpenText className="h-5 w-5 text-primary" />
          পরবর্তী অনুশীলনের পরামর্শ
        </h3>
        {weakTopics.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            দুর্বল টপিক:{" "}
            <span className="font-medium text-foreground">
              {weakTopics.map((t) => TOPIC_LABEL[t.topic]).join(", ")}
            </span>
            । নিচের অধ্যায়গুলো এই দুর্বলতা কাটাতে সাহায্য করবে।
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            চমৎকার পারফরম্যান্স! সংশ্লিষ্ট অধ্যায়ে এগিয়ে যান।
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {NEXT_CHAPTERS.map((c) => (
            <div
              key={c.name_bn}
              className="rounded-lg border bg-white p-4 transition hover:border-foreground/40"
            >
              <p className="exam-heading font-semibold">{c.name_bn}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.reason_bn}</p>
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link to="/subjects">অনুশীলন শুরু করুন</Link>
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
