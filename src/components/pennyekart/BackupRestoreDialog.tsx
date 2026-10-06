import { useState } from "react";
import { Loader2, Download, Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BACKUP_SHEETS, downloadFullBackup, fetchBackupData, parseBackupFile, restoreBackup } from "@/lib/agentBackup";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isSuperAdmin: boolean;
  madeBy: string;
  onRestored?: () => void;
}

type Preview = { tables: Record<string, Record<string, unknown>[]>; problems: string[]; stats: Record<string, { add: number; update: number }> };

export function BackupRestoreDialog({ open, onOpenChange, isSuperAdmin, madeBy, onRestored }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const download = async () => {
    setBusy("download");
    try { await downloadFullBackup(madeBy); toast.success("Backup downloaded"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Backup failed"); }
    finally { setBusy(null); }
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    setBusy("parse");
    try {
      const { tables, problems } = await parseBackupFile(file);
      const current = await fetchBackupData();
      const stats: Preview["stats"] = {};
      for (const t of Object.keys(BACKUP_SHEETS)) {
        const ids = new Set((current[t] || []).map((r) => r.id as string));
        const rows = tables[t] || [];
        const update = rows.filter((r) => ids.has(r.id as string)).length;
        stats[t] = { add: rows.length - update, update };
      }
      setPreview({ tables, problems, stats });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read file"); }
    finally { setBusy(null); }
  };

  const confirmRestore = async () => {
    if (!preview) return;
    setBusy("restore");
    try {
      await downloadFullBackup(madeBy); // safety copy first
      const res = await restoreBackup(preview.tables);
      const errs = Object.entries(res).filter(([, v]) => v.error);
      if (errs.length) toast.error(errs.map(([t, v]) => `${BACKUP_SHEETS[t]}: ${v.error}`).join("; "));
      else toast.success("Backup restored");
      setPreview(null);
      onRestored?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Restore failed"); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPreview(null); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Backup & Restore</DialogTitle>
          <DialogDescription>Agents, direct customers, work logs, wallet and complaints in one Excel file.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="font-medium">Download full backup</p>
            <Button onClick={download} disabled={!!busy} className="w-full">
              {busy === "download" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download Excel backup
            </Button>
          </div>

          {isSuperAdmin && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-medium">Restore from backup</p>
              <p className="text-xs text-muted-foreground">Existing records are updated and missing ones added back. Nothing is deleted. A fresh backup downloads first.</p>
              {!preview ? (
                <Input type="file" accept=".xlsx" disabled={!!busy} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              ) : (
                <div className="space-y-3">
                  <div className="text-sm space-y-1">
                    {Object.entries(BACKUP_SHEETS).map(([t, s]) => (
                      <div key={t} className="flex justify-between"><span>{s}</span><span className="text-muted-foreground">{preview.stats[t].add} new · {preview.stats[t].update} update</span></div>
                    ))}
                  </div>
                  {preview.problems.length > 0 && (
                    <div className="text-xs text-destructive max-h-28 overflow-y-auto">
                      {preview.problems.slice(0, 30).map((p, i) => <div key={i}>{p}</div>)}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" disabled={!!busy} onClick={() => setPreview(null)}>Cancel</Button>
                    <Button className="flex-1" disabled={!!busy} onClick={confirmRestore}>
                      {busy === "restore" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Restore
                    </Button>
                  </div>
                </div>
              )}
              {busy === "parse" && <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
