# Departments: personal view by default, with a super-admin "view all" permission

## Goal

When a department member logs in on the home page, they see only the work logs, plans and todos **they created**. A super admin can grant a specific member permission to see everything from all members of their department(s).

## Behaviour

Logged-in department member (default):
- Logs tab: only logs created by them
- Planning tab: only plans they created
- Todos/Tasks tab: only todos they created
- The pending slider on the home page follows the same rule

Member with "View all department records" permission granted:
- Sees all logs, plans and todos of every member in their department(s)
- Editing/deleting stays restricted to the creator (unchanged)

Visitors who are not logged in: unchanged — they keep seeing the public (non-private) items.

## Admin panel

On `/super-admin/departments`, each member row gets a toggle: **"Can view all members' records"**. Super admin turns it on/off per member; it is saved immediately and reflected on next login/refresh of that member.

## Technical notes

- Migration: add `can_view_all boolean not null default false` to `public.department_members`.
- Edge function `department-worklog`:
  - `upsert_member` accepts and stores `can_view_all`; add a `set_member_permission` action (super-admin path already used by the management page) to toggle it.
  - `login` response includes `can_view_all` per membership.
- `src/components/home/DepartmentWorkLogSection.tsx`: filtering currently uses `is_public || canEditItem(...)`. Add a session-aware rule:
  - not logged in → public items only
  - logged in without permission → only items whose `created_by_member_id` (or `member_id` for logs) is one of the member's own ids
  - logged in with `can_view_all` → all items in their departments
- `src/components/home/DepartmentPendingSlider.tsx`: apply the same visibility helper.
- `src/pages/admin/DepartmentsManagement.tsx`: add the toggle in the member list and call the edge function action.
