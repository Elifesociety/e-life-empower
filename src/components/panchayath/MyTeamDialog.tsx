import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AgentHierarchyTree, sabpScope } from "@/components/pennyekart/AgentHierarchyTree";
import { PennyekartAgent, ROLE_LABELS } from "@/hooks/usePennyekartAgents";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function MyTeamDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<PennyekartAgent[]>([]);
  const [me, setMe] = useState<PennyekartAgent[]>([]);
  const [selected, setSelected] = useState<PennyekartAgent | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const mobile = (localStorage.getItem("elife_status_mobile") || "").replace(/\D/g, "");
      const all: PennyekartAgent[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("pennyekart_agents")
          .select("*, panchayath:panchayaths(name)")
          .eq("is_active", true)
          .range(from, from + 999);
        all.push(...((data || []) as unknown as PennyekartAgent[]));
        if (!data || data.length < 1000) break;
      }
      const mine = all.filter((a) => a.mobile.replace(/\D/g, "") === mobile && mobile.length === 10);
      const result = new Map<string, PennyekartAgent>();
      const addDownline = (rootId: string) => {
        const stack = [rootId];
        while (stack.length) {
          const id = stack.pop()!;
          for (const a of all) {
            if (a.parent_agent_id === id && !result.has(a.id)) {
              result.set(a.id, a);
              stack.push(a.id);
            }
          }
        }
      };
      for (const m of mine) {
        result.set(m.id, m);
        if (m.role === "super_admin_partner") {
          // Match the "My Panchayaths" list: every agent working in any of
          // the allocated panchayaths (by home OR allocated panchayaths),
          // plus anyone linked under them.
          const scope = new Set(sabpScope(m));
          const inScope = all.filter(
            (a) => a.role !== "super_admin_partner" && sabpScope(a).some((id) => scope.has(id)),
          );
          inScope.forEach((a) => result.set(a.id, a));
          inScope.forEach((a) => addDownline(a.id));
        }
        addDownline(m.id);
      }
      setMe(mine);
      setTeam(Array.from(result.values()));
      setLoading(false);
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> My Team</DialogTitle>
          <DialogDescription>
            {me.length
              ? `${me[0].name} · ${me.map((m) => ROLE_LABELS[m.role]).join(", ")} · ${Math.max(team.length - me.length, 0)} agents under you`
              : "Agents working under you"}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : me.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Your mobile number is not registered as an agent, so there is no team to show.
          </p>
        ) : (
          <AgentHierarchyTree agents={team} onSelectAgent={setSelected} selectedAgentId={selected?.id} />
        )}
      </DialogContent>
    </Dialog>
  );
}
