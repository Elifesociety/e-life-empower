# Hierarchy view: group by Panchayath, Super Admin, or Agent

## What you'll get
On the Hierarchy tab of /admin/pennyekart-agents, a small switch with three options above the tree:

- **Panchayath** (current view, stays the default)
- **Super Admin** – one box per Super Admin / Business Partner showing their panchayaths and, inside each, the full Team Leader -> Coordinator -> Group Leader -> PRO tree. Agents not under any Super Admin go into an "Unassigned" box.
- **Agent** – one box per Team Leader showing their whole downline across all panchayaths, without splitting it by panchayath. Agents whose leader is missing show up in an "Unlinked agents" box.

Each box header shows the agent count and total customers. You can still click any agent to open their details. The existing filters (panchayath, ward, role, search) work in every view.

## Technical details
- `PennyekartAgentHierarchy.tsx`: add a `groupBy` state ("panchayath" | "super_admin" | "agent") with a segmented toggle; pass it to `AgentHierarchyTree`.
- `AgentHierarchyTree.tsx`: keep the current panchayath grouping; add two groupers:
  - super_admin: for each `super_admin_partner`, collect agents whose `panchayath_id` is in their `responsible_panchayath_ids` (or their home panchayath); render panchayath sub-nodes reusing `PanchayathNode` (without repeating the SABP inside).
  - agent: roots are team leaders (plus orphans whose parent isn't loaded); render with the existing recursive `AgentNode` over the full agent list.
- Frontend only, no database changes.
