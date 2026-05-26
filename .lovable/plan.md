# Board Question Tracker & Practice System

Turn the chapter practice flow into a board-question-first experience: every chapter shows real SSC/HSC board questions filterable by year, board, and type, with repeated-pattern grouping, priority scoring, and AI-generated similar questions clearly labelled.

---

## Scope

Build (in order):

1. **DB schema** — extend `past_questions`, add `question_patterns` + join, add priority + frequency fields.
2. **Server functions** — list/filter board questions, group repeated patterns, compute stats, generate AI similar questions tagged to a source pattern.
3. **Chapter Board Questions page** — new `/chapter/$chapterId/board-questions` route with breadcrumb, stats, filters, tabs, table.
4. **Practice mode** — single-question view with year/board badge, answer, Bangla explanation, "Try Similar".
5. **Admin upload + verify + merge** — extend admin panel.
6. **Empty state** — Bangla CTA with AI-generate / upload / change chapter actions.

Out of scope this pass: subject-level dashboards, mock test reshuffle, leaderboards.

---

## Database changes (single migration)

Extend `past_questions`:

- `exam_level text` ('SSC' | 'HSC')
- `paper text` (e.g. '1st' / '2nd')
- `topic text`
- `source_type text` default `'official_board'` ('official_board' | 'test_paper' | 'model_test' | 'ai_generated')
- `verification_status text` default `'verified'` ('verified' | 'review_needed')
- `pattern_id uuid` nullable → `question_patterns.id`
- `priority_score int` default 0
- `explanation_bn text`

New `question_patterns`:

- `id, chapter_id, subject_id, name, name_bn, description_bn`
- `appeared_years int[]`, `appeared_boards text[]`
- `frequency_count int`, `priority_score int`, `priority_label text`
- `created_at`, `created_by`

GRANTs: SELECT for authenticated on both; admin manage via existing `has_role` pattern. RLS: read-approved/verified or admin.

Priority score function (`public.compute_priority_score`): weighted sum — frequency 40, recency (latest year within 3y) 25, distinct boards 20, topic importance 15 → clamps 0..100. Label thresholds: ≥70 Very Important, ≥40 Important, else Practice Later.

---

## Server functions (`src/lib/board-questions.functions.ts`)

- `listBoardQuestions({ chapterId, filters })` → questions + patterns
- `getChapterBoardStats(chapterId)` → totals, years covered, boards covered, repeated count, high-priority count
- `listRepeatedPatterns(chapterId)` → grouped patterns
- `generateAISimilarQuestion({ sourceQuestionId })` → calls Lovable AI, inserts into `generated_questions` with `source_context = { pattern_id, board, year }`, returns labelled question
- Admin: `upsertBoardQuestion`, `verifyBoardQuestion`, `mergeQuestionsIntoPattern`

All use `requireSupabaseAuth`. Admin ones gate on `has_role('admin')`.

---

## Routes

- `src/routes/chapters.$chapterId.board-questions.tsx` — main page (breadcrumb, header, stats cards, filters bar, tabs, table)
- `src/routes/chapters.$chapterId.board-practice.tsx` — practice mode (single question, badges, answer reveal, explanation, Try Similar)
- `src/routes/admin.board-questions.tsx` — upload/verify/merge UI

Link from existing chapter cards: replace "Practice" CTA with "Board Questions" as primary, keep "Quick Practice" secondary.

---

## UI structure

```text
Breadcrumb: Dashboard / Subjects / HSC / English 2nd / Narration

[Chapter Header]
Narration · Board Questions
[stat][stat][stat][stat][stat]

[Filters row: Exam | Year range | Board | Type | Frequency | Priority]

[Tabs: All | Repeated | Pattern Practice | High Priority | AI Similar]

[Table: Year | Board | Question | Type | Freq | Priority | Actions]
```

Badges: board (color-coded), year, source_type (`AI Similar` distinct outline), priority label in Bangla.

---

## Empty state

Card with Bangla copy + three buttons (AI generate / Upload / Change chapter). Triggers `generateAISimilarQuestion` in batch (5 questions) using chapter syllabus when no real questions exist.

---

## Technical notes

- All new tables follow public-schema GRANT + RLS pattern.
- AI generation uses existing `LOVABLE_API_KEY` via `src/lib/ai.functions.ts` helper (already present).
- Priority recomputed on insert/verify via DB trigger calling `compute_priority_score`.
- Patterns auto-suggested at admin time (admin merges manually; no auto-clustering this pass).

---

## Deliverables checklist

- [ ] Migration: extend `past_questions`, add `question_patterns`, GRANTs, RLS, trigger, function
- [ ] `board-questions.functions.ts` (6 server fns)
- [ ] `chapters.$chapterId.board-questions.tsx`
- [ ] `chapters.$chapterId.board-practice.tsx`
- [ ] `admin.board-questions.tsx`
- [ ] Link updates in existing chapter list / QuickPractice
- [ ] Empty-state Bangla component
