## Overview

Add a new agent-only portal at route `/samrambhaka` (branded "സംരംഭക.കോം"). Any active agent in `pennyekart_agents` (all roles) can register by verifying their mobile number and setting a password; they then log in with mobile + password to see a simple welcome + profile page. Entry point is a bright pink vertical card placed to the right of the hero on the home page.

## 1. Database — new `agent_auth` table

Migration creating a separate credentials table:

- `agent_auth`
  - `agent_id` → FK to `pennyekart_agents.id` (unique, on delete cascade)
  - `mobile` (unique, indexed) — snapshot for fast login lookup
  - `password_hash` (bcrypt)
  - `last_login_at`
  - standard `id`, `created_at`, `updated_at`

GRANTs: `service_role` full access; no `anon`/`authenticated` grants (all access goes through the edge function). RLS enabled with service-role-only policy. Password hash never leaves the edge function.

## 2. Edge function — `samrabhaka-auth`

New Deno function with actions:

- `check_mobile` → given mobile, returns `{ exists: true, has_password: bool, name, role }` if the mobile matches an active agent; `{ exists: false }` otherwise. Drives the register-vs-login flow.
- `register` → mobile + new password. Validates agent exists & active, no existing row in `agent_auth`, hashes with bcrypt, inserts row, returns session token.
- `login` → mobile + password. Verifies hash, updates `last_login_at`, returns session token.
- `me` → validates token, returns agent profile (name, mobile, role, panchayath name, ward).
- `change_password` → old + new password (for logged-in users; optional but small).

Session token: signed JWT-style string (same pattern as existing `admin-auth`), stored in `localStorage` under `samrabhaka_token`. Uses existing `LOVABLE_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env; no new secrets required.

Validation with Zod, CORS headers, rate-limit-friendly error messages.

## 3. Frontend

### Hero entry card
Update `src/components/home/HeroSection.tsx`: change layout so the existing hero content sits in a 2-column grid on `lg:`, with a right-side vertical pink card matching the uploaded reference:

- Hot pink gradient panel, rounded, full-height of hero
- Malayalam heading "സംരംഭക.കോം" top, white text
- "Login / Register" button bottom
- Links to `/samrambhaka`
- On mobile it stacks below the hero content

### New page `src/pages/Samrabhaka.tsx` + route in `App.tsx`

Single page with three states driven by local component state:

1. **Mobile step** — input mobile, calls `check_mobile`.
2. **Register step** (if `has_password === false`) — shows agent name/role for confirmation, password + confirm password inputs, calls `register`.
3. **Login step** (if `has_password === true`) — password input, calls `login`.
4. **Dashboard** (after token) — welcome card with name, mobile, role, panchayath, ward, and Logout button. Uses existing `Layout` and design tokens (no hardcoded colors in the dashboard portion; the pink card is intentional per user's screenshot).

### Auth hook
Small `useSamrabhakaAuth` hook wrapping token in `localStorage` and `me` fetch on mount.

## Technical notes

- Password rules: min 6 chars, confirm-match, client + server Zod validation.
- Mobile normalized to digits only server-side; unique index on `agent_auth.mobile` prevents duplicates.
- Bcrypt via `npm:bcryptjs` inside the edge function.
- Token signed with `LOVABLE_API_KEY` (already available) — same approach as `admin-auth`; 30-day expiry.
- No changes to existing auth (`useAuth`) — this is a separate lightweight session for the public agent portal.
- `pennyekart_agents.is_active = true` is required to register or login.

## Files touched

- `supabase/migrations/*` (new — via migration tool): `agent_auth` table + grants + RLS + updated_at trigger
- `supabase/functions/samrabhaka-auth/index.ts` (new)
- `src/components/home/HeroSection.tsx` (add right-side pink card, 2-col layout)
- `src/pages/Samrabhaka.tsx` (new)
- `src/hooks/useSamrabhakaAuth.ts` (new)
- `src/App.tsx` (register `/samrambhaka` route)
