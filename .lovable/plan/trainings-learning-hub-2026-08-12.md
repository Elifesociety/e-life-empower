# Trainings — Learning Hub

A new "Trainings" section in the top navigation where members learn from slide decks, image presentations, YouTube videos and written notes — all inside one training.

## What the visitor sees

**Nav bar** gets a new "Trainings" link (desktop + mobile), between Divisions and Programs.

**/trainings** — a training library:
- Hero strip with search box and category chips (e.g. Pennyekart, Samrambhaka, General, or admin-created categories)
- Colorful cards in a bento-style grid: cover image, category badge, lesson count, duration, and a progress ring for logged-in members
- Private trainings show a lock badge; opening one asks for the department/agent login already used on the home page
- Filters: category, newest, most lessons

**/trainings/:id** — the player page:
- Left/top: the active lesson viewer, switching by lesson type
  - Slide deck (PDF): in-browser page-by-page viewer with prev/next, page counter, fullscreen and download
  - Slide deck (PPT/PPTX): download + "open in viewer" (browsers cannot render .pptx natively — uploading a PDF export gives the inline experience)
  - Image presentation: swipeable carousel with captions, thumbnails strip, fullscreen
  - YouTube: responsive embedded player
  - Notes: rich text block, also usable as a description under any other lesson
- Right/bottom: lesson playlist with type icons, completed ticks, and an overall progress bar
- "Mark complete" button and auto-advance to the next lesson
- Keyboard arrows for next/prev, mobile-first stacked layout

Progress is stored per learner (department member / agent identity, same login the site already uses) so the progress ring and "Continue" state survive reloads.

## What the admin sees

**/admin/trainings** (Super Admin + Division Admins; division admins see and manage only their own division's trainings):
- Trainings table with status (draft/published), visibility (public/private), category, division, lesson count
- Create/edit training: title, Malayalam title, description, cover image upload, category, division, public/private toggle, publish toggle
- Lesson builder: add lessons of any type in one training, drag to reorder
  - PDF/PPT upload, multi-image upload with captions, YouTube URL, rich notes
- Delete training/lesson with confirmation

## Technical notes

Database (new tables, with GRANTs + RLS in the same migration):
- `trainings` — title, title_ml, description, cover_url, category, division_id, is_public, is_published, created_by, sort_order, timestamps
- `training_lessons` — training_id, type (`pdf` | `ppt` | `images` | `youtube` | `notes`), title, sort_order, content jsonb (file_url, youtube_id, images array with captions, html notes), duration_minutes
- `training_progress` — training_id, lesson_id, learner_key (agent/member id), completed_at

Access: public + published trainings readable by `anon`; private ones only served through the existing edge-function login path. Writes go through a new `admin-trainings` edge function that accepts the existing admin token and Supabase session, and enforces division scope for division admins.

Storage: new public `training-media` bucket for covers, PDFs, PPT files, and presentation images.

Frontend: `src/pages/Trainings.tsx`, `src/pages/TrainingDetail.tsx`, `src/pages/admin/TrainingsManagement.tsx`, plus `src/components/trainings/` (TrainingCard, LessonPlayer, PdfViewer, ImagePresentation, YouTubeLesson, LessonPlaylist, TrainingFormDialog, LessonBuilder). Routes added in `App.tsx`, nav item in `Header.tsx`. PDF rendering via `react-pdf`/pdf.js, image carousel via the Embla carousel already used by the department slider. All styling uses the existing green/gold semantic tokens.
