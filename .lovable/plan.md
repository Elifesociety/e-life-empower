# Plan: Filters & Counts on /panchayaths

Enhance the public `/panchayaths` page so each panchayath card surfaces useful metrics and visitors can filter/sort by them.

## Data to fetch (per panchayath)
For each panchayath, compute:
- Agent counts by role from `pennyekart_agents`:
  - PRO
  - Group Leader
  - Coordinator
  - Team Leader
- Customers count from `cash_collections` (unique mobile / row count scoped to that panchayath)
- Program registrations count from `program_registrations`

Fetch strategy: a single batched query per metric grouped by `panchayath_id`, merged client-side into the panchayath list (avoids N+1).

## UI changes on each card
Show a compact metric row with badges:
`PRO 12 · GL 4 · Coord 2 · TL 1 · Customers 87 · Registrations 34`

Zero values shown muted.

## Filter bar (above grid)
1. **Filter chips (multi-select, OR within group, AND across groups)** — hide panchayaths whose count is 0 for any selected chip:
   - Has PRO
   - Has Group Leader
   - Has Coordinator
   - Has Team Leader
   - Has Customers
   - Has Registrations
2. **Sort dropdown** — replaces current default code sort when chosen:
   - Code (default, current behavior)
   - Name (A–Z)
   - Most PROs
   - Most Group Leaders
   - Most Coordinators
   - Most Team Leaders
   - Most Customers
   - Most Registrations
3. Existing search box stays.
4. "Clear filters" link when any chip/sort active.

## Technical notes
- File: `src/pages/Panchayaths.tsx` only (UI + data merge).
- Counts loaded in parallel with existing fetch via `Promise.all`, using `.select('panchayath_id, role', { count: 'exact', head: false })` style group queries or RPC-less client-side aggregation by selecting `panchayath_id` columns and tallying.
- Store metrics in a `Record<panchayathId, Metrics>` map; derive filtered+sorted list with `useMemo`.
- No schema/migration changes.
- No changes to other routes.

## Out of scope
- No new admin tooling.
- No edits to agent/registration data models.
