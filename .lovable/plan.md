## Goal
Let Coordinators, Group Leaders, and PROs maintain a list of their direct customers (name, mobile, ward, address). Manageable from the admin agent panel and via agent self-service on the home page.

## Database (migration)
New table `public.agent_direct_customers`:
- `id uuid pk`
- `agent_id uuid not null references pennyekart_agents(id) on delete cascade`
- `name text not null`
- `mobile text not null`
- `ward text`
- `address text`
- `notes text` (nullable, future-proof)
- `created_at`, `updated_at` (with trigger)
- Index on `agent_id`, unique on `(agent_id, mobile)` to prevent duplicates

GRANTs:
- `GRANT SELECT ON ... TO anon` (public read so home page can show counts; matches existing pennyekart_agents pattern)
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`
- `GRANT ALL ... TO service_role`

RLS:
- Enable RLS
- SELECT: public (anon + authenticated)
- INSERT/UPDATE/DELETE: deny from client (false). All writes go through the edge function with service role.

Keep existing `pennyekart_agents.customer_count` untouched (manual field stays).

## Edge function — extend `pennyekart-agents`
Add new actions, reusing existing auth (admin token OR `x-caller-mobile` header):
- `list_customers { agent_id }` — anyone
- `add_customer { agent_id, customer }` — admin OR caller mobile matches the agent OR caller is that agent's parent chain (admin override always works). Enforce agent role ∈ {coordinator, group_leader, pro}.
- `update_customer { id, customer }` — same auth as add
- `delete_customer { id }` — same auth

Server-side zod validation: name 1–100, mobile 10 digits, ward ≤ 50, address ≤ 300.

## Admin UI — `src/components/pennyekart/AgentDetailsPanel.tsx`
When selected agent's role is coordinator/group_leader/pro, add a new "Direct Customers" section with:
- Count + list (scrollable)
- "Add Customer" button → opens `DirectCustomerFormDialog`
- Per-row edit/delete

New component: `src/components/pennyekart/DirectCustomerFormDialog.tsx` (name, mobile, ward, address fields with zod).
New hook: `src/hooks/useAgentDirectCustomers.ts` for list/create/update/delete via the edge function.

## Self-service UI — home page
Reuse the existing agent mobile-login pattern from `AgentWorkLog.tsx`:
- New component `src/components/home/AgentDirectCustomersSection.tsx` placed on `Index.tsx` below `CheckStatusSection`.
- Agent enters mobile → if matched agent role ∈ {coordinator, group_leader, pro} show their customers + add/edit/delete. Otherwise show "Not available for your role."
- Uses the same `x-caller-mobile` header path on the edge function.

## Files touched
- New migration (table + grants + RLS)
- `supabase/functions/pennyekart-agents/index.ts` — 4 new actions
- `src/hooks/useAgentDirectCustomers.ts` — new
- `src/components/pennyekart/DirectCustomerFormDialog.tsx` — new
- `src/components/pennyekart/AgentDetailsPanel.tsx` — add section
- `src/components/home/AgentDirectCustomersSection.tsx` — new
- `src/pages/Index.tsx` — mount new section

## Out of scope
- No change to `customer_count` field or any rollup logic.
- No bulk import (can be added later).
