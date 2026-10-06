# Pennyekart Agents: Full Backup and Restore

## What you get
On /admin/pennyekart-agents, a new **Backup** button with two options:

1. **Download full backup (Excel)**: one file with a sheet for each of these:
   - Agents: every field, including allocated panchayaths, responsible wards, parent agent, status and dates
   - Direct Customers
   - Work Logs
   - Wallet Transactions
   - Complaints
   - Info sheet: the backup date, who made it, and row counts

   Panchayath names are shown next to their IDs so the file is easy to read.

2. **Restore from backup** (Super Admin only):
   - Upload a backup file. A preview shows how many rows will be added, how many updated, and any rows with problems.
   - After you confirm, the data is brought back. Existing records are matched by their ID and updated, and missing records are added back.
   - Nothing is deleted during a restore, so a restore can't wipe current data.
   - Agents are restored top-down (parents before children), so the hierarchy links stay correct.

## Safety
- Only Super Admins can restore. Division admins can download backups but cannot restore.
- Before a restore starts, a fresh backup of the current data downloads automatically.

## Technical details
- New `src/lib/agentBackup.ts`: fetches all rows with pagination (past the 1000-row limit) for `pennyekart_agents`, `agent_direct_customers`, `agent_work_logs`, `agent_wallet_transactions` and `agent_complaints`, then builds the workbook with `xlsx`. Arrays are stored as JSON text so they can be restored exactly.
- New `src/components/pennyekart/BackupRestoreDialog.tsx`: parses the uploaded file, validates the headers and required columns, and shows a diff preview against current IDs.
- `supabase/functions/pennyekart-agents/index.ts`: new `restore_backup` action, Super Admin only through the existing `verifyAdmin`. It upserts by `id` with the service role in this order: agents (sorted by depth), then customers, logs, wallet and complaints. Batches are capped at 500 rows. It returns counts and errors per table.
- No database schema changes.
