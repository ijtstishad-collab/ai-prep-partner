# Simplify Student Journey

Current flow is 5 clicks: **Dashboard → Group → Subject → Chapter → Mode → Practice**. Each step is a full page reload that mostly just lists items. Goal: reduce to **2 clicks** (Dashboard → Practice) for the common case, while keeping deep browsing available for new users.

## New Flow

```text
DASHBOARD (one-screen launcher)
  ├── Quick Start card        → 1 click to last/recommended chapter
  ├── Continue last attempt   → 1 click resume
  ├── Subject picker (inline) → opens chapter+mode sheet
  └── Browse all subjects     → existing /subjects page (fallback)

CHAPTER+MODE SHEET (single combined screen, replaces /subjects/$slug + /chapters + mode picker)
  → Pick chapter from list, pick mode chips inline, "Start" button
  → 1 screen instead of 3

PRACTICE  (unchanged route, unchanged backend)
RESULT    (unchanged)
```

## Changes by Page

### `dashboard.tsx` — becomes the launcher
- **New "Quick Start" hero tile**: shows last practiced chapter + "Resume" button, or recommended weak chapter if none. Single click → `/practice/$chapterId`.
- **Inline subject row**: horizontal scrollable chips of student's group subjects. Click → opens combined Chapter+Mode bottom sheet (no navigation).
- Keep existing bento tiles for History, Analytics, Mock Test, AI MCQ but compress into a smaller secondary row.
- Remove the 5-step "Journey" progress bar — it advertises the complexity we're removing.

### New combined `ChapterModeSheet` component
- Shown as a Sheet/Dialog over dashboard (no route change).
- Left: chapter list (searchable, grouped by paper if applicable).
- Right (or below on mobile): 4 mode chips — অধ্যায়ভিত্তিক / বোর্ড প্রশ্ন / এআই প্রশ্ন / মিশ্র.
- Single primary "শুরু করুন · Start Practice" button → navigates straight to `/practice/$chapterId?mode=...`.
- Replaces the need to visit `/subjects/$slug` then `/chapters` then click a mode.

### `subjects.tsx` & `chapters.tsx` — kept as fallback
- Still reachable via "সব বিষয় দেখুন · Browse all" link for users who want to explore.
- No structural changes; just ensure they also open the new sheet when a subject is clicked (instead of multi-step navigation).

### `practice.tsx`
- Add a compact top bar: subject · chapter · mode + back-to-dashboard.
- Auto-start (skip the "Start" intro screen if currently present) — user already committed when clicking the chapter.
- Result screen already exists; add a prominent "পরবর্তী দুর্বল অধ্যায় · Next weak chapter" button so the loop continues with 1 click.

## Out of Scope
- No backend, RLS, schema, or server function changes.
- Existing routes stay mounted (deep links keep working).
- Bangla-first copy and Paper & Ink aesthetic preserved.

## Files Touched
- `src/routes/dashboard.tsx` (restructure)
- `src/components/ChapterModeSheet.tsx` (new)
- `src/routes/subjects.tsx`, `src/routes/chapters.tsx` (open sheet on click instead of navigating; keep page accessible)
- `src/routes/practice.tsx` (compact header, auto-start)
- `src/routes/result.$attemptId.tsx` (next-chapter CTA prominence)

Approve and I'll implement.
