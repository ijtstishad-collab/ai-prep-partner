import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  approveQuestionDraft,
  createManualMcqDraft,
  loadQuestionReviewData,
  rejectQuestionDraft,
  type AdminChapter,
  type AdminReviewNote,
  type AdminSubject,
  type DraftOption,
  type QuestionDraft,
} from "@/lib/admin-question.functions";
import { CheckCircle2, Edit3, FileQuestion, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/question-review")({
  component: AdminQuestionReviewPage,
});

type OptionFormRow = DraftOption & { isCorrect: boolean };

const initialOptions: OptionFormRow[] = ["A", "B", "C", "D"].map((key, index) => ({
  key,
  text: "",
  isCorrect: index === 0,
}));

function AdminQuestionReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [reviews, setReviews] = useState<AdminReviewNote[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionText, setQuestionText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<OptionFormRow[]>(initialOptions);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );
  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );
  const latestReviewByDraft = useMemo(() => {
    const map = new Map<string, AdminReviewNote>();
    reviews.forEach((review) => {
      if (review.draft_id && !map.has(review.draft_id)) map.set(review.draft_id, review);
    });
    return map;
  }, [reviews]);

  const filteredChapters = useMemo(
    () => chapters.filter((chapter) => chapter.subject_id === selectedSubjectId),
    [chapters, selectedSubjectId],
  );

  const refresh = async () => {
    setLoadingData(true);
    try {
      const data = await loadQuestionReviewData();
      setSubjects(data.subjects);
      setChapters(data.chapters);
      setDrafts(data.drafts);
      setReviews(data.reviews);

      const firstSubject = data.subjects[0]?.id ?? "";
      const activeSubject = selectedSubjectId || firstSubject;
      const subjectStillExists = data.subjects.some((subject) => subject.id === activeSubject);
      const nextSubjectId = subjectStillExists ? activeSubject : firstSubject;
      const nextChapterId =
        data.chapters.find((chapter) => chapter.subject_id === nextSubjectId)?.id ?? "";

      setSelectedSubjectId(nextSubjectId);
      setSelectedChapterId((current) => {
        const currentStillValid = data.chapters.some(
          (chapter) => chapter.id === current && chapter.subject_id === nextSubjectId,
        );
        return currentStillValid ? current : nextChapterId;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load review data.";
      toast.error(message);
      if (/access|required|unauthorized/i.test(message)) nav({ to: "/dashboard" });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    refresh();
  }, [authLoading, user]);

  useEffect(() => {
    const chapterStillValid = filteredChapters.some((chapter) => chapter.id === selectedChapterId);
    if (!chapterStillValid) setSelectedChapterId(filteredChapters[0]?.id ?? "");
  }, [filteredChapters, selectedChapterId]);

  const setOptionText = (key: string, text: string) => {
    setOptions((current) =>
      current.map((option) => (option.key === key ? { ...option, text } : option)),
    );
  };

  const setCorrectOption = (key: string) => {
    setOptions((current) =>
      current.map((option) => ({ ...option, isCorrect: option.key === key })),
    );
  };

  const resetForm = () => {
    setDifficulty("medium");
    setQuestionText("");
    setExplanation("");
    setOptions(initialOptions);
  };

  const submitDraft = async () => {
    if (!selectedSubjectId || !selectedChapterId) {
      toast.error("Select a subject and chapter first.");
      return;
    }

    setCreating(true);
    try {
      await createManualMcqDraft({
        data: {
          subject_id: selectedSubjectId,
          chapter_id: selectedChapterId,
          difficulty,
          question_text: questionText,
          explanation: explanation || undefined,
          options: options.map((option) => ({
            key: option.key,
            text: option.text,
            isCorrect: option.isCorrect,
          })),
        },
      });
      toast.success("Manual MCQ draft created.");
      resetForm();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create draft.");
    } finally {
      setCreating(false);
    }
  };

  const approveDraft = async (draftId: string) => {
    setReviewingId(draftId);
    try {
      await approveQuestionDraft({
        data: { draft_id: draftId, notes: reviewNotes[draftId] || undefined },
      });
      toast.success("Draft approved and published.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve draft.");
    } finally {
      setReviewingId(null);
    }
  };

  const rejectDraft = async (draftId: string) => {
    const notes = reviewNotes[draftId]?.trim() ?? "";
    if (notes.length < 3) {
      toast.error("Add a review note before rejecting.");
      return;
    }

    setReviewingId(draftId);
    try {
      await rejectQuestionDraft({ data: { draft_id: draftId, notes } });
      toast.success("Draft rejected with review note.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reject draft.");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-medium text-primary">প্রশ্ন পর্যালোচনা · Admin</p>
          <h1 className="mt-1 text-3xl font-bold">প্রশ্ন খসড়া পর্যালোচনা কিউ</h1>
          <p className="mt-2 text-muted-foreground">
            ম্যানুয়াল এইচএসসি এমসিকিউ খসড়া তৈরি করুন, উত্তর কী যাচাই করুন এবং শুধু অনুমোদিত প্রশ্নই শিক্ষার্থীদের জন্য প্রকাশ করুন।
          </p>
        </div>

        {authLoading || loadingData ? (
          <Card className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            অ্যাডমিন ওয়ার্কস্পেস লোড হচ্ছে...
          </Card>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">ম্যানুয়াল এমসিকিউ খসড়া</h2>
                  <p className="text-sm text-muted-foreground">অধ্যায়ভিত্তিক অনুশীলনের জন্য।</p>
                </div>
              </div>

              <div className="space-y-4">
                <Field label="বিষয়">
                  <select
                    value={selectedSubjectId}
                    onChange={(event) => setSelectedSubjectId(event.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="অধ্যায়">
                  <select
                    value={selectedChapterId}
                    onChange={(event) => setSelectedChapterId(event.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {filteredChapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.order_index ? `${chapter.order_index}. ` : ""}
                        {chapter.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="কঠিনতা">
                  <select
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as "easy" | "medium" | "hard")
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="easy">সহজ</option>
                    <option value="medium">মধ্যম</option>
                    <option value="hard">কঠিন</option>
                  </select>
                </Field>

                <Field label="প্রশ্ন">
                  <textarea
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="এমসিকিউ প্রশ্ন লিখুন..."
                  />
                </Field>

                <div className="space-y-3">
                  <div className="text-sm font-medium">অপশন ও সঠিক উত্তর</div>
                  {options.map((option) => (
                    <div key={option.key} className="flex items-center gap-2">
                      <label className="flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold">
                        {option.key}
                      </label>
                      <input
                        value={option.text}
                        onChange={(event) => setOptionText(option.key, event.target.value)}
                        className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                        placeholder={`অপশন ${option.key}`}
                      />
                      <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                        <input
                          type="radio"
                          checked={option.isCorrect}
                          onChange={() => setCorrectOption(option.key)}
                        />
                        সঠিক
                      </label>
                    </div>
                  ))}
                </div>

                <Field label="ব্যাখ্যা / রিভিউ নোট">
                  <textarea
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="ঐচ্ছিক ব্যাখ্যা..."
                  />
                </Field>

                <Button onClick={submitDraft} disabled={creating} className="w-full">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      খসড়া তৈরি হচ্ছে
                    </>
                  ) : (
                    "খসড়া তৈরি করুন"
                  )}
                </Button>
              </div>
            </Card>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Metric
                  label="অপেক্ষমাণ"
                  value={drafts.filter((draft) => draft.status === "pending_review").length}
                  icon={FileQuestion}
                />
                <Metric
                  label="অনুমোদিত"
                  value={drafts.filter((draft) => draft.status === "approved").length}
                  icon={ShieldCheck}
                />
                <Metric
                  label="বাতিল"
                  value={drafts.filter((draft) => draft.status === "rejected").length}
                  icon={XCircle}
                />
              </div>

              {drafts.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileQuestion className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">এখনো কোনো খসড়া নেই</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    রিভিউ ফ্লো শুরু করতে একটি ম্যানুয়াল এমসিকিউ খসড়া তৈরি করুন।
                  </p>
                </Card>
              ) : (
                drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    subjectName={subjectById.get(draft.subject_id)?.name ?? "Subject"}
                    chapterName={chapterById.get(draft.chapter_id)?.name ?? "Chapter"}
                    latestReview={latestReviewByDraft.get(draft.id)}
                    note={reviewNotes[draft.id] ?? ""}
                    reviewing={reviewingId === draft.id}
                    onNoteChange={(value) =>
                      setReviewNotes((current) => ({ ...current, [draft.id]: value }))
                    }
                    onApprove={() => approveDraft(draft.id)}
                    onReject={() => rejectDraft(draft.id)}
                  />
                ))
              )}

              <Button asChild variant="outline">
                <Link to="/admin">← অ্যাডমিন কনসোলে ফিরে যান</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof FileQuestion;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function DraftCard({
  draft,
  subjectName,
  chapterName,
  latestReview,
  note,
  reviewing,
  onNoteChange,
  onApprove,
  onReject,
}: {
  draft: QuestionDraft;
  subjectName: string;
  chapterName: string;
  latestReview?: AdminReviewNote;
  note: string;
  reviewing: boolean;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const canReview = draft.status === "draft" || draft.status === "pending_review";

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge>{subjectName}</Badge>
        <Badge variant="secondary">{chapterName}</Badge>
        <Badge variant="outline">{draft.difficulty}</Badge>
        <StatusBadge status={draft.status} />
      </div>

      <h3 className="font-semibold leading-7">{draft.question_text}</h3>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {draft.options.map((option) => {
          const isCorrect = option.isCorrect || option.text === draft.correct_answer;
          return (
            <div key={`${draft.id}-${option.key}`} className="rounded-lg border px-3 py-2 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold">{option.key}</span>
                {isCorrect ? <Badge variant="secondary">Correct</Badge> : null}
              </div>
              <p className="text-muted-foreground">{option.text}</p>
            </div>
          );
        })}
      </div>

      {draft.explanation ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {draft.explanation}
        </p>
      ) : null}

      {latestReview?.notes ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Latest review note: {latestReview.notes}
        </p>
      ) : null}

      {canReview ? (
        <div className="mt-5 space-y-3">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Review note for approval or rejection..."
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={onApprove} disabled={reviewing}>
              {reviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve and Publish
            </Button>
            <Button onClick={onReject} disabled={reviewing} variant="destructive">
              {reviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function StatusBadge({ status }: { status: QuestionDraft["status"] }) {
  if (status === "approved") return <Badge>Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (status === "pending_review") return <Badge variant="secondary">Pending Review</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
