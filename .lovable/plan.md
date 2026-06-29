## Plan: Show Panchayath Code & Sort by Code on /panchayaths

### Changes
1. **Data fetching**: Update the Supabase select in `src/pages/Panchayaths.tsx` to include the `code` column.
2. **Type update**: Add `code: string | null` to the `Panchayath` interface.
3. **Sorting**: Sort the panchayath list by `code` in ascending order (handling nulls last) before rendering.
4. **UI display**: Show the panchayath code (e.g., as a badge or label) on each panchayath card.

### Files to edit
- `src/pages/Panchayaths.tsx`