## Goal
Let Coordinators, Group Leaders, and PROs maintain a list of their direct customers (name, mobile, ward, address). Manageable from the admin agent panel and via agent self-service on the home page.

## Database
New table `public.agent_direct_customers`:
- `agent_id` (FK → pennyekart_agents, cascade delete)
- `name`, `mobile`, `ward`, `address`, `notes`
- Unique on `(agent_id, mobile)` to prevent duplicates
- Index on `agent_id`

RLS + grants:
- Public SELECT (anon + authenticated) — same pattern as pennyekart_agents
- INSERT/UPDATE/DELETE denied from client; all writes go through edge function with service role

`pennyekart_agents.customer_count` stays untouched (existing manual field).

## Edge function — extend `pennyekart-agents`
Reuse existing auth (admin token OR `x-caller-mobile` header). New actions:
- `list_customers { agent_id }` — anyone
- `add_customer { agent_id, customer }` — admin OR caller mobile matches agent. Role must be coordinator/group_leader/pro.
- `update_customer { id, customer }` — same auth
- `delete_customer { id }` — same auth

Zod validation: name 1–100, mobile 10 digits, ward ≤ 50, address ≤ 300.

## Admin UI
In `AgentDetailsPanel.tsx`, when selected agent's role is coordinator/group_leader/pro, add a "Direct Customers" section:
- Count + scrollable list
- "Add Customer" button → opens `DirectCustomerFormDialog`
- Per-row edit/delete

New files:
- `src/components/pennyekart/DirectCustomerFormDialog.tsx` (form with zod)
- `src/hooks/useAgentDirectCustomers.ts` (list/create/update/delete via edge function)

## Self-service UI — home page
New component `src/components/home/AgentDirectCustomersSection.tsx`, mounted in `Index.tsx` below `CheckStatusSection`. Reuses the agent mobile-login pattern from `AgentWorkLog.tsx`:
- Agent enters mobile → if matched agent role ∈ {coordinator, group_leader, pro} show their customers + add/edit/delete
- Otherwise show "Not available for your role"
- Uses `x-caller-mobile` header on the edge function

## Files touched
- New migration (table + grants + RLS)
- `supabase/functions/pennyekart-agents/index.ts` — 4 new actions
- `src/hooks/useAgentDirectCustomers.ts` — new
- `src/components/pennyekart/DirectCustomerFormDialog.tsx` — new
- `src/components/pennyekart/AgentDetailsPanel.tsx` — add section
- `src/components/home/AgentDirectCustomersSection.tsx` — new
- `src/pages/Index.tsx` — mount new section

## Out of scope
- No change to `customer_count` field or any rollup logic
- No bulk import (can be added later)
