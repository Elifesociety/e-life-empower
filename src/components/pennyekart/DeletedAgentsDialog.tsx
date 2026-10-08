import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callAgentsFn } from "@/lib/agentBackup";
import { ROLE_LABELS, AgentRole } from "@/hooks/usePennyekartAgents";

interface Row {
  id: string;
  agent_name: string | null;
  agent_mobile: string | null;
  agent_role: string | null;
  deleted_by: string | null;
  deleted_at: string;
  child_agent_ids: string[];
}

const RETENTION_DAYS = 30;

export function DeletedAgentsDialog({ open, onOpenChange, isSuperAdmin, onRestored }: {
  open: boolean; onOpenChange: (o: boolean) => void; isSuperAdmin: boolean; onRestored: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Row | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await callAgentsFn({ action: "list_deleted" });
      setRows(data || []);
    } catch (e) {
      toast({ title: "Could not load", description: (e as Error).message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const restore = async (r: Row) => {
    setBusy(r.id);
    try {
      await callAgentsFn({ action: "restore_deleted", archive_id: r.id });
      toast({ title: `${r.agent_name} restored` });
      onRestored();
      load();
    } catch (e) {
      toast({ title: "Restore failed", description: (e as Error).message, variant: "destructive" });
    }
    setBusy(null);
  };

  const purge = async () => {
    if (!purgeTarget) return;
    const r = purgeTarget;
    setPurgeTarget(null);
    setBusy(r.id);
    try {
      await callAgentsFn({ action: "purge_deleted", archive_id: r.id });
      toast({ title: "Permanently deleted" });
      load();
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
    setBusy(null);
  };

  const daysLeft = (d: string) =>
    Math.max(0, RETENTION_DAYS - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b">
            <DialogTitle>Deleted Agents</DialogTitle>
            <DialogDescription>
              Deleted agents are kept for {RETENTION_DAYS} days, then removed forever.
              {!isSuperAdmin && " Only Super Admin can restore or permanently delete."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No deleted agents.</p>
            ) : rows.map((r) => (
              <div key={r.id} className="border rounded-md p-3 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.agent_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.agent_mobile} · deleted {new Date(r.deleted_at).toLocaleString("en-IN")}
                    {r.deleted_by ? ` by ${r.deleted_by}` : ""}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="secondary">{ROLE_LABELS[r.agent_role as AgentRole] ?? r.agent_role}</Badge>
                    <Badge variant="outline">{daysLeft(r.deleted_at)} days left</Badge>
                    {r.child_agent_ids?.length > 0 && <Badge variant="outline">{r.child_agent_ids.length} reports</Badge>}
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => restore(r)}>
                      {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}Restore
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => setPurgeTarget(r)}>
                      <Trash2 className="h-4 w-4 mr-1" />Delete forever
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {purgeTarget?.agent_name} and their customers, work logs, wallet and complaints will be removed forever. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={(e) => { e.preventDefault(); purge(); }}>
              Yes, delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
