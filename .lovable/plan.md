## Goal
Enhance the "Add Customer" flow on `/admin/pennyekart-agents` so each direct customer is tagged with a Panchayath + Ward, defaulting to the agent's own location, with an optional "Outside Location" mode that lets the user pick any panchayath/ward and marks the record as a separate head.

## Database (migration)
Add columns to `agent_direct_customers`:
- `panchayath_id uuid null` (FK → `panchayaths.id`)
- `ward text null` — replaces/repurposes existing `ward` (already exists as text; keep)
- `is_outside boolean not null default false` — flag for "Outside Location" customers

Index: `(agent_id, is_outside)` for quick grouping.
No RLS change needed (existing policy via edge function stays).

## Edge function (`pennyekart-agents`)
- `add_customer` / `update_customer`: accept `panchayath_id`, `ward`, `is_outside` in the `customer` payload and persist them.
- `list_customers`: return the new fields plus a joined `panchayath_name` (simple select via view or a second query keyed by panchayath_id).

## Frontend

### `useAgentDirectCustomers.ts`
Extend `AgentDirectCustomer` and `DirectCustomerInput` with `panchayath_id`, `is_outside`, and derived `panchayath_name`.

### `DirectCustomerFormDialog.tsx`
New props: `defaultPanchayathId`, `defaultPanchayathName`, `defaultWard` (passed from the parent, sourced from the agent).

UI additions:
- Toggle/checkbox: **"Outside Location"** (default off).
- When OFF: show read-only Panchayath (agent's) and a Ward input pre-filled with the agent's ward but editable.
- When ON: show a searchable Panchayath select (fetch from `panchayaths` table) and a Ward input. Submitted record gets `is_outside = true` and uses the chosen panchayath/ward.

Validation: panchayath_id required in both modes; ward required.

### `AgentDirectCustomersDialog.tsx`
- Pass agent's `panchayath_id`, `panchayath.name`, and `ward` as defaults to the form dialog.
- Group the customer list into two sections: **"Local (Agent's Panchayath)"** and **"Outside Location"**, each with its own count badge. Search still filters across both.
- Each list item shows the panchayath + ward chip so outside entries are visually distinct (badge with different color).

### Optional (small)
- Add an `Outside` filter/badge on `AgentRanksTab` / rank calc? **No** — outside customers are a "separate head" and should NOT contribute to the agent's PRO rank fulfillment. Update `src/lib/agentRank.ts` PRO counting to filter `is_outside = false` when counting direct customers so ranks stay honest.

## Out of scope
- No changes to bulk import, sales report, or payouts.
- No new page — everything stays inside the existing Direct Customers dialog.