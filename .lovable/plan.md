# My Panchayaths: show only allocated panchayaths

## Problem
On /panchayaths, "My Panchayaths" for Jamsheena (9656830104) lists both her own home panchayath and her allocated panchayaths. It should list only the allocated ones.

## Change
- When an agent has allocated (responsible) panchayaths, "My Panchayaths" shows only those, and leaves out her home panchayath. If the home panchayath is also allocated, it still shows.
- If an agent has no allocated panchayaths at all (for example a Coordinator with only a home panchayath), keep showing the home panchayath so their list isn't empty.
- The counter on the "My Panchayaths" button updates to match.

## Technical details
- `src/pages/Panchayaths.tsx` (my-panchayath loader, ~line 263): add `responsible_panchayath_ids` first. Add `panchayath_id` only when that agent row has no responsible ids.
- Edit/manage permissions in `panchayathAccess.ts` stay as they are.
