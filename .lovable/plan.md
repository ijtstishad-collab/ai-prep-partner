## Plan: Porikkha AI MVP polish + content backbone

### 1. Copy fixes (frontend only)
Sweep all routes for the exact string replacements, plus a grammar/spelling pass:
- `index.tsx`: "Everything you need to crack HSC" → "Everything you need to prepare smarter for HSC"; "Ready to ace HSC?" → "Ready to prepare smarter for HSC?"; "Bangla Explanations" feature card → "Simple Bangla explanations"; "Teacher Reviewed" → "Teacher-reviewed question bank".
- `pricing.tsx`: "3 AI questions / day" → "3 AI-generated questions per day"; "Weak-area analytics" → "Weak area analysis"; "Teacher reviewed Q-bank" → "Teacher-reviewed question bank".
- General sweep across dashboard, onboarding, weakness, subjects, practice, generate, admin, auth for grammar/spelling slips.

### 2. Database — seed + readiness
One migration that:
- Upserts the 3 HSC Science subjects (Physics/Chemistry/Biology 1st Paper) by slug.
- Upserts all listed chapters under each subject with `order_index`.
- Adds `chapters.readiness_status text default 'not_started'` with check constraint (`not_started | content_added | ai_ready | teacher_reviewed`).
- Adds a SQL function `public.compute_chapter_readiness(chapter uuid)` that returns the status based on counts of `syllabus_units`, `textbook_chunks`, `past_questions`, `generation_rules` (by subject), and approved+teacher-reviewed `generated_questions`.
- Adds a `demo_questions` table (chapter_id, question_text, options jsonb, correct_answer, explanation_bn, question_type, difficulty) with RLS: any authenticated user can read; admins manage. Seed 3–4 demo MCQs per subject's first chapter for fallback.

### 3. Server / AI logic
- Update `generateQuestions` server fn: require `syllabus_units > 0 AND textbook_chunks > 0 AND past_questions > 0 AND generation_rules > 0`. If not, throw a tagged error `INSUFFICIENT_CONTENT` so the client can show demo mode.
- Add a new server fn `getChapterReadiness(chapterId)` returning counts + status badge.
- Add `getDemoQuestions(chapterId)` returning seeded sample rows.

### 4. Generate page
- Show readiness badge next to each chapter in the dropdown (AI Ready / Needs Content / Teacher Reviewed).
- On `INSUFFICIENT_CONTENT`, render the friendly demo banner + 3–5 demo questions.

### 5. Admin panel
Existing `admin.tsx` already has tabs for syllabus, textbook chunks, past questions, generation rules, and AI review. Add:
- Tab navigation refresh to mirror the 10 admin pages (Dashboard / Subjects / Chapters / Syllabus / Textbook / Past Q CSV / Rules / AI Review with approve/reject/edit/teacher-review toggle).
- Admin Dashboard tab: counts of subjects, chapters, pending questions, approved questions, reports.
- Subjects + Chapters CRUD (create/toggle active/rename) using `supabaseAdmin`-free direct supabase calls (admin RLS covers).
- Chapter list shows readiness badge.
- AI Review: ensure approve/reject/edit + "Mark Teacher Reviewed" toggle exists.

### 6. Empty states
Add friendly empty-state cards on:
- Dashboard (no attempts yet → "Start your first practice")
- Weakness (no performance data → guidance)
- Recent tests (no attempts → CTA)
- Subjects/chapters list (none → admin message)

### Technical notes
- All UI uses existing semantic tokens from `src/styles.css`.
- Migration uses idempotent upserts (`ON CONFLICT (slug)` / `(subject_id, name)`).
- Will add a unique index on `chapters (subject_id, name)` for upsert safety.
- No new secrets needed; `LOVABLE_API_KEY` already present.

Proceeding with migration first, then code.