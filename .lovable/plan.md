
## Goal

Add a new standalone section on the home page (`/`) below `BentoHome`, above `CheckStatusSection`, that auto-slides through pending department **plans** and pending department **todos** in two separate horizontal carousels (4s interval). Visibility is scoped to the logged-in department member's departments using the existing member PIN session.

## Placement

`src/pages/Index.tsx` order:
1. `<BentoHome />`
2. **`<DepartmentPendingSlider />`** (new)
3. `<CheckStatusSection />`
4. `<DepartmentWorkLogSection />`

## Behavior

- Reuse the existing session stored under `localStorage["elife_dept_session"]` (same key used by `DepartmentWorkLogSection`). No new login UI in this section.
- **Logged out** → render a compact card with a single "Member Login" CTA. The CTA opens the existing `DepartmentWorkLogSection` login dialog by scrolling to it (anchor `#department-login`) — no duplicate login flow.
- **Logged in** → fetch only:
  - `department_plans` where `department_id IN (session.memberships[].department_id)` AND `status != 'completed'`
  - `department_todos` where `department_id IN (...)` AND `is_completed = false`
  - Ordered by `due_date`/`target_date` asc nulls last, then `created_at` desc, limit 50 each.
- Two stacked horizontal carousels (Embla, already installed via `@/components/ui/carousel`):
  - **Pending Planning** — slide shows title, department badge (colored), target date, status pill, short description.
  - **Pending Todos** — slide shows title, department badge, due date, short description, "Mark done" button if `created_by_member_id` is the current member.
- Auto-advance every **4000ms** using `embla-carousel-autoplay` plugin (already a transitive dep of embla — add via `bun add embla-carousel-autoplay` if missing). Pause on hover/focus. One slide visible on mobile, 2 on md, 3 on lg.
- Empty state per slider: "No pending plans" / "No pending todos — great work!".
- Light realtime: re-fetch when user returns to tab (`visibilitychange`) and after a "Mark done" click.

## Files

**New:** `src/components/home/DepartmentPendingSlider.tsx`
- Reads session from `localStorage["elife_dept_session"]`.
- Queries Supabase directly with the anon client (no edge function needed — RLS already allows members to read their own department rows; for the slider we filter client-side to memberships and `is_public OR own`).
- "Mark done" calls existing `department-worklog` edge function with `action: "update_todo", id, is_completed: true, token`.
- Uses shadcn `Carousel`, `CarouselContent`, `CarouselItem` + `Autoplay` plugin. Two `<Carousel>` instances.

**Edited:** `src/pages/Index.tsx` — insert the new component between `BentoHome` and `CheckStatusSection`.

**Edited:** `src/components/home/DepartmentWorkLogSection.tsx` — add `id="department-login"` anchor on the section wrapper so the CTA can scroll to it.

## Technical notes

- No DB schema changes, no new edge function, no new RLS.
- Reuses `department_plans` / `department_todos` tables and the existing `elife_dept_session` localStorage key — staying signed in across the page applies automatically.
- Styling uses existing semantic tokens (`bg-card`, `text-foreground`, `border-primary/20`) and the per-department color already stored on `departments.color`.
- Autoplay plugin: `import Autoplay from "embla-carousel-autoplay"`, pass via `plugins={[Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })]}`.

## Out of scope

- Editing plans/todos inline (kept in `DepartmentWorkLogSection`).
- Showing other departments' items to a logged-in member (strictly own-department scope as requested).
- Public view for logged-out visitors (shows login CTA only).
