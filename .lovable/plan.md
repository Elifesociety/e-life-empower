# Apply the "allocated panchayaths only" rule to every leader

## Current situation
- The last fix already covers all Super Admin / Business Partners, not only Jamsheena. 4 of the 7 active Super Admins live outside the panchayaths they look after, and all of them now show only under their allocated panchayaths.
- Team Leaders have the same problem. 9 of the 18 active Team Leaders live outside their allocated panchayaths. Right now the chart shows them under their home panchayath. Their team members in the allocated panchayaths then show up without their leader above them.

## What changes
- Any Team Leader with allocated panchayaths will show only under those panchayaths, with their team below them in each one. Their home panchayath becomes just a label on their card.
- Leaders with no allocated panchayaths stay under their home panchayath.
- The same rule applies to the Panchayath view, the Super Admin view, the Agent view, the "My Team" window and the panchayath filter on the Hierarchy tab.

## Technical details
- Generalise `sabpScope` into `leaderScope(agent)` for `super_admin_partner` and `team_leader`: use `responsible_panchayath_ids` when it's not empty, otherwise use the home panchayath.
- `PanchayathGrouping`: place both roles by `leaderScope`. Fetch missing panchayath names for both roles.
- `PanchayathNode`: put a child under its leader whenever that leader is in the same box. This already happens by parent link, so it needs a check only.
- `SuperAdminGrouping`: count a member as covered when their panchayath is in the Super Admin's scope. Same idea as now.
- `MyTeamDialog`: use `leaderScope` for Super Admins. Team Leaders keep the downline logic.
- `usePennyekartAgents` panchayath filter: when filtering by a panchayath, drop leaders whose only match is their home panchayath (when they have allocated ones). Do this on the client after fetching.
- Frontend only.
