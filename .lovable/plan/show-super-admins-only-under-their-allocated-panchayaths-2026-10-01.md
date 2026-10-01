# Show Super Admins only under their allocated panchayaths

## What changes
On the Hierarchy tab, a Super Admin / Business Partner (for example Jamsheena) will appear only under the panchayaths she is responsible for. Her home panchayath (Pandikad) will no longer list her unless it is also one of her allocated panchayaths. Her home panchayath stays visible on her details card just for reference.

If a Super Admin has no allocated panchayaths yet, she stays under her home panchayath so she doesn't vanish from the chart.

The same rule applies in the "Super Admin" grouping view and the "My Team" window.

## Technical details
- `AgentHierarchyTree.tsx` `PanchayathGrouping`: for `super_admin_partner` with non-empty `responsible_panchayath_ids`, push only into those panchayaths (skip home); fall back to home when the list is empty. Panchayath names for responsible IDs not present among loaded agents: fetch names from `panchayaths` once so allocated boxes still render.
- Super Admin grouping (line ~102) and `MyTeamDialog.tsx`: scope = `responsible_panchayath_ids` when non-empty, else home panchayath.
- Frontend only.
