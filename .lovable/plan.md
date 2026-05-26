# HSC Board Question Practice System — Rebuild Plan

Lock the product to HSC and make board questions the spine of every flow. Most database scaffolding (past_questions extended, question_patterns, priority scoring, board-questions / board-practice / admin routes) is already in place from earlier iterations — this plan focuses on wiring the **student journey, navigation, content, and missing UX surfaces** on top.

---

## 1. Navigation & shell (`src/components/AppShell.tsx`)

Replace the current 4-tab + More layout with the spec:

Primary: **Dashboard · Subjects · Board Questions · Practice · Mock Test · Progress · Study Plan**
More: **AI Generator · Resources · History · Profile** (+ Admin links when admin)

- Add a new top-level route `/board-questions` (subject → chapter chooser that funnels into existing `chapters.$chapterId.board-questions.tsx`).
- Drop "Board Trends" from primary nav (still reachable via More → Resources or via Dashboard widget).

## 2. Homepage (`src/routes/index.tsx`)

Rewrite hero + sections:
- H1: "HSC Board Question Practice, AI Explanation & Smart Revision"
- Bangla subtitle as specified
- CTA: **Get Started** → `/auth` (new users) or `/onboarding`
- Section blocks (icon + 2-line copy each): Choose Group, Previous Board Questions, Year & Board Tracking, Repeated Pattern Analysis, AI Bangla Explanation, Weak Chapter Detection, Smart Study Plan, Mock Test Simulation
- Keep current minimal editorial black/white style.

## 3. Onboarding (`src/routes/onboarding.tsx`)

Convert single-form into a 5-step wizard (HSC is implicit, no exam-level choice):

1. Group (Science / Business Studies / Humanities)
2. Board (11 boards as radio grid in Bangla + English)
3. Exam Year (HSC 2026 / 2027)
4. Weak Subjects (multi-select, filtered by group)
5. Daily Study Time (slider 30–240 min)

Persist to `profiles` — extend with `board`, `weak_subject_ids[]`, `daily_minutes` columns (migration).

## 4. Dashboard (`src/routes/dashboard.tsx`)

Replace current generic widgets with:
- **Exam countdown** card (days till HSC exam date per year)
- **Today's recommended practice** (server fn: pick top-priority unattempted board question in a weak chapter of selected group)
- **Continue last chapter** (latest `test_attempts` row)
- **Weak chapters** (lowest accuracy in `performance_summary`, gated: needs ≥20 attempts)
- **Board question trend** mini card → /past-paper-analyzer
- **Mock test shortcut**
- **Recent performance** (last 7 days bar)

Empty states show Bangla helper text instead of demo data.

## 5. Subjects (`src/routes/subjects.tsx`)

- Filter subjects strictly by `profile.student_group`.
- Seed-data migration to insert the full subject list per group (Bangla 1st/2nd, English 1st/2nd, ICT common; Science / Business / Humanities papers as specified).
- New card layout: Name · Paper · #chapters · #verified board Qs · last practiced · **Start Practice** + **View Board Questions** buttons.

## 6. Subject detail (`src/routes/subjects.$slug.tsx`)

List chapters with verified board Q count + priority badge; each row → `/chapters/$chapterId/board-questions`.

## 7. Chapter page

Already exists at `chapters.$chapterId.board-questions.tsx`. Refit into a **tabbed** layout:
Tabs: Board Questions · Repeated Patterns · AI Similar Practice · Chapter Test · Notes.
Header summary: total verified Qs, years covered, boards covered, repeated patterns, high-priority count.

## 8. Practice flow (`src/routes/chapters.$chapterId.board-practice.tsx` + `practice.tsx`)

One question at a time. Always show **Board · Year · Source** badge. After answer:
correct/incorrect → correct answer → Bangla explanation → common mistake → formula (optional) → why other options are wrong → **Try Similar** (AI) → **Next**.

Add **Skip** and **Add to Revision** buttons (revision = new table `revision_items`).

## 9. AI labeling

Anywhere a question comes from `generated_questions`, render badge:
- "AI Generated — Not Official Board Question" (generic)
- "AI Similar — Based on {Board} {Year} Pattern" (when `source_context.pattern_id` exists)

## 10. Board Question Trends (`src/routes/past-paper-analyzer.tsx`)

Rename UI title to **Board Question Trends**. Sections:
- Most repeated chapters (group by chapter_id, count)
- Most repeated patterns (from `question_patterns`)
- Board-wise frequency table
- Year-wise trend (sparkline)
- High priority questions table with **Practice** action
- Always-on sample-structure block when DB empty + admin upload CTA.

## 11. Progress (`src/routes/analytics.tsx` → rename "Progress")

Show: overall accuracy · questions attempted · weak chapters · strong chapters · board question completion % · revision queue size · last 7 days activity. <20 attempts → show Bangla gating message.

## 12. Study Plan (`src/routes/study-plan.tsx`)

Inputs: exam date · daily minutes · weak subjects (prefilled from profile) · preferred days (checkbox row).
Output: 7-day plan rows (Topic · Board Q practice · Revision · Mock · Weak chapter focus) generated by existing `study-plan.functions.ts` (extend prompt).

## 13. Mock Test (`src/routes/mock-test.tsx`)

Four mock types as cards: Chapter / Subject / Board Pattern / Final HSC.
Engine rules: timer, fixed Q count, no explanations mid-test, single submit, result + explanations after, save mistakes to revision.

## 14. Admin (`src/routes/admin.board-questions.tsx`)

Already exists. Add: CSV import (paste CSV → parse → preview → bulk insert), explicit Verify toggle, Merge-into-pattern UI confirmation. Source-type selector (official_board / textbook / model_test / ai).

## 15. Database migrations

Single migration adds:
- `profiles.board text`, `profiles.weak_subject_ids uuid[]`, `profiles.daily_minutes int default 60`
- `subjects.paper text`, `subjects.group_type` already exists — backfill via seed
- `revision_items` table (user_id, question_id, source_table, created_at) with RLS
- Seed inserts for full HSC subject list per group (idempotent on slug)

(past_questions extensions, question_patterns, priority scoring already done.)

## Out of scope (defer)
- Realtime leaderboards, payments, push notifications, multi-exam (SSC) support, full CSV parser robustness beyond comma-delimited.

---

**Build order:** migration → AppShell nav → onboarding wizard → homepage → subjects seed/UI → dashboard rewire → chapter tabs → practice answer panel → trends page → progress gating → study plan inputs → mock test types → admin CSV.
