# Mark panchayaths already taken by the same role (Add/Edit Agent)

## What changes
In the Add/Edit Agent form, pick the **Role** first. Then the panchayath lists show which panchayaths already have another agent with that same role.

- Applies to: Super Admin / Business Partner, Team Leader and Coordinator.
- Not applied to Group Leader or PRO. Many of them can share one panchayath, so their lists stay as they are.
- Each taken panchayath gets a small "Already selected – <agent name>" tag and is grouped below the free ones.
- This covers both the main Panchayath picker and the "Allocated / Responsible panchayaths" checklist.
- A taken panchayath is marked as a warning only. You can still select it.
- When editing an agent, their own panchayaths are not marked as taken.
- Changing the role refreshes the marks straight away.

## Technical details
- In `AgentFormDialog.tsx`, when `selectedRole` is `super_admin_partner`, `team_leader` or `coordinator`, fetch active agents of that role: `id, name, panchayath_id, responsible_panchayath_ids`. Exclude the agent being edited.
- Build a map of panchayath id to agent names from the agent's own panchayath plus the panchayaths they are responsible for.
- Show the tag and sort taken panchayaths last in both the `SearchableSelect` options and the responsible-panchayath checklist.
- No database changes.
