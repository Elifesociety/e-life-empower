import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Phone, Crown, Shield, UserCheck, Briefcase, Users, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgentFormDialog } from "@/components/pennyekart/AgentFormDialog";
import {
  PennyekartAgent,
  AgentRole,
  ROLE_LABELS,
  ROLE_HIERARCHY,
} from "@/hooks/usePennyekartAgents";
import { checkPanchayathAccess, PanchayathAccess } from "@/lib/panchayathAccess";
import { resetMobileGate } from "@/components/MobileGate";

interface Props {
  panchayath: { id: string; name: string; name_ml?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_ORDER: AgentRole[] = ["super_admin_partner", "team_leader", "coordinator", "group_leader", "pro"];

const roleIcon: Record<AgentRole, any> = {
  super_admin_partner: Crown,
  team_leader: Shield,
  coordinator: Users,
  group_leader: UserCheck,
  pro: Briefcase,
};

const roleColor: Record<AgentRole, string> = {
  super_admin_partner: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
  team_leader: "border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20",
  coordinator: "border-l-purple-500 bg-purple-50/60 dark:bg-purple-950/20",
  group_leader: "border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20",
  pro: "border-l-rose-500 bg-rose-50/60 dark:bg-rose-950/20",
};

export function PanchayathAgentsDialog({ panchayath, open, onOpenChange }: Props) {
  const [agents, setAgents] = useState<PennyekartAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [access, setAccess] = useState<PanchayathAccess | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PennyekartAgent | null>(null);

  const fetchAgents = async (panchayathId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("pennyekart_agents")
      .select(`
        *,
        panchayath:panchayaths(name),
        parent_agent:pennyekart_agents!parent_agent_id(name, role)
      `)
      .or(`panchayath_id.eq.${panchayathId},responsible_panchayath_ids.cs.{${panchayathId}}`)
      .eq("is_active", true)
      .order("name");
    setAgents((data as unknown as PennyekartAgent[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open && panchayath) {
      fetchAgents(panchayath.id);
      checkPanchayathAccess(panchayath.id).then(setAccess);
    }
  }, [open, panchayath?.id]);

  const grouped = useMemo(() => {
    const out: Record<AgentRole, PennyekartAgent[]> = {
      super_admin_partner: [],
      team_leader: [],
      coordinator: [],
      group_leader: [],
      pro: [],
    };
    agents.forEach((a) => {
      if (out[a.role]) out[a.role].push(a);
    });
    return out;
  }, [agents]);

  if (!panchayath) return null;

  const canManage = access?.canManage ?? false;
  const callerMobile = canManage ? access?.mobile ?? undefined : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 truncate">
                  <Users className="h-5 w-5 text-kerala-green shrink-0" />
                  {panchayath.name}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {panchayath.name_ml ? `${panchayath.name_ml} · ` : ""}
                  {agents.length} agents
                </DialogDescription>
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Agent
                </Button>
              ) : (
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Lock className="h-3 w-3" /> View only
                </Badge>
              )}
            </div>
            {!canManage && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                {access?.mobile
                  ? "Only Team Leaders and Super Admin / Business Partners of this panchayath can add or edit."
                  : (
                    <>
                      Not signed in.{" "}
                      <button
                        type="button"
                        onClick={resetMobileGate}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Enter your mobile number
                      </button>{" "}
                      to enable editing if you are authorized.
                    </>
                  )}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading agents…
              </div>
            ) : agents.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">
                No agents in this panchayath yet.
              </p>
            ) : (
              ROLE_ORDER.map((role) => {
                const list = grouped[role];
                if (!list || list.length === 0) return null;
                const Icon = roleIcon[role];
                return (
                  <section key={role}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">{ROLE_LABELS[role]}</h3>
                      <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {list.map((a) => (
                        <div
                          key={a.id}
                          className={`rounded-md border-l-4 border bg-card px-3 py-2 ${roleColor[role]}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{a.name}</div>
                              <a
                                href={`tel:${a.mobile}`}
                                className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5"
                              >
                                <Phone className="h-3 w-3" />
                                {a.mobile}
                              </a>
                              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                                {a.ward && (
                                  <Badge variant="outline" className="text-[10px] py-0">
                                    Ward {a.ward}
                                  </Badge>
                                )}
                                {a.parent_agent && (
                                  <Badge variant="outline" className="text-[10px] py-0">
                                    ↑ {a.parent_agent.name}
                                  </Badge>
                                )}
                                {role === "pro" && a.customer_count > 0 && (
                                  <Badge variant="secondary" className="text-[10px] py-0">
                                    {a.customer_count} customers
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {canManage && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => {
                                  setEditing(a);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {canManage && (
        <AgentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          agent={editing}
          callerMobile={callerMobile}
          lockedPanchayathId={panchayath.id}
          onSuccess={() => {
            fetchAgents(panchayath.id);
          }}
        />
      )}
    </>
  );
}
