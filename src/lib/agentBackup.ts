import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export const BACKUP_SHEETS: Record<string, string> = {
  pennyekart_agents: "Agents",
  agent_direct_customers: "Direct Customers",
  agent_work_logs: "Work Logs",
  agent_wallet_transactions: "Wallet Transactions",
  agent_complaints: "Complaints",
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co"}/functions/v1/pennyekart-agents`;
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

async function call(body: object) {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: ANON };
  const t = localStorage.getItem("elife_admin_token");
  if (t) headers["x-admin-token"] = t;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(FN_URL, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const ARRAY_COLS = new Set(["responsible_panchayath_ids", "responsible_wards"]);

export async function fetchBackupData(): Promise<Record<string, Record<string, unknown>[]>> {
  const { data } = await call({ action: "export_backup" });
  return data;
}

export async function downloadFullBackup(madeBy: string) {
  const { data, panchayaths } = await call({ action: "export_backup" });
  const pMap = new Map<string, string>((panchayaths || []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const wb = XLSX.utils.book_new();
  const now = new Date();
  const info = [
    { Field: "Backup date", Value: now.toLocaleString("en-IN") },
    { Field: "Made by", Value: madeBy },
    ...Object.entries(BACKUP_SHEETS).map(([t, s]) => ({ Field: `${s} rows`, Value: (data[t] || []).length })),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Info");
  for (const [t, sheet] of Object.entries(BACKUP_SHEETS)) {
    const rows = (data[t] || []).map((r: Record<string, unknown>) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        o[k] = Array.isArray(v) || (v && typeof v === "object") ? JSON.stringify(v) : v;
      }
      if ("panchayath_id" in r) o.panchayath_name = pMap.get(r.panchayath_id as string) || "";
      if (Array.isArray(r.responsible_panchayath_ids))
        o.responsible_panchayath_names = (r.responsible_panchayath_ids as string[]).map((id) => pMap.get(id) || id).join(", ");
      return o;
    });
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["id"]]);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }
  XLSX.writeFile(wb, `Pennyekart_Backup_${now.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.xlsx`);
}

const HELPER_COLS = new Set(["panchayath_name", "responsible_panchayath_names"]);

export async function parseBackupFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer());
  const tables: Record<string, Record<string, unknown>[]> = {};
  const problems: string[] = [];
  for (const [t, sheet] of Object.entries(BACKUP_SHEETS)) {
    const ws = wb.Sheets[sheet];
    if (!ws) { problems.push(`Missing sheet "${sheet}"`); tables[t] = []; continue; }
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const rows: Record<string, unknown>[] = [];
    raw.forEach((r, i) => {
      if (!r.id) { if (Object.values(r).some((v) => v !== null && v !== "")) problems.push(`${sheet} row ${i + 2}: no id`); return; }
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (HELPER_COLS.has(k)) continue;
        if (ARRAY_COLS.has(k) || k === "items") {
          try { o[k] = v === null || v === "" ? (ARRAY_COLS.has(k) ? [] : null) : JSON.parse(String(v)); }
          catch { problems.push(`${sheet} row ${i + 2}: bad ${k}`); o[k] = []; }
        } else o[k] = v === "" ? null : v;
      }
      rows.push(o);
    });
    tables[t] = rows;
  }
  return { tables, problems };
}

export async function restoreBackup(tables: Record<string, Record<string, unknown>[]>) {
  const { result } = await call({ action: "restore_backup", tables });
  return result as Record<string, { restored: number; error?: string }>;
}
