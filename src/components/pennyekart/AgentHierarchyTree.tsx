import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Super Admin / Business Partner scope: allocated panchayaths only; home
// panchayath is just an indicator (used only when nothing is allocated).
export function leaderScope(a: { role?: string; panchayath_id: string; responsible_panchayath_ids?: string[] | null }): string[] {
  const r = a.responsible_panchayath_ids || [];
  return r.length ? r : [a.panchayath_id];
}
export const sabpScope = leaderScope;
export const isScopedLeader = (a: { role?: string; responsible_panchayath_ids?: string[] | null }) =>
  (a.role === "super_admin_partner" || a.role === "team_leader") && !!a.responsible_panchayath_ids?.length;
import { ChevronRight, ChevronDown, Users, User, Phone, MapPin, Building2, Star, Trophy, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PennyekartAgent, ROLE_LABELS, AgentRole } from "@/hooks/usePennyekartAgents";
import { calculateAgentRank, AgentRankInfo } from "@/lib/agentRank";

interface AgentHierarchyTreeProps {
  agents: PennyekartAgent[];
  onSelectAgent: (agent: PennyekartAgent) => void;
  selectedAgentId?: string;
}

const ROLE_COLORS: Record<AgentRole, string> = {
  super_admin_partner: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  team_leader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  coordinator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  group_leader: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
};

type GroupBy = "panchayath" | "super_admin" | "agent";

export function AgentHierarchyTree({ agents, onSelectAgent, selectedAgentId }: AgentHierarchyTreeProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("panchayath");

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p>No agents found</p>
        <p className="text-sm">Add agents to see the hierarchy</p>
      </div>
    );
  }

  const options: { value: GroupBy; label: string }[] = [
    { value: "panchayath", label: "Panchayath" },
    { value: "super_admin", label: "Super Admin" },
    { value: "agent", label: "Agent" },
  ];

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => setGroupBy(o.value)}
            className={cn(
              "px-3 py-1 text-xs sm:text-sm rounded transition-colors",
              groupBy === o.value ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {groupBy === "panchayath" && (
        <PanchayathGrouping agents={agents} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
      )}
      {groupBy === "super_admin" && (
        <SuperAdminGrouping agents={agents} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
      )}
      {groupBy === "agent" && (
        <AgentGrouping agents={agents} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
      )}
    </div>
  );
}

function sumCustomers(list: PennyekartAgent[]) {
  return list.reduce((t, a) => t + (a.role === "pro" ? a.customer_count || 0 : 0), 0);
}

function GroupBox({ title, icon, count, customers, children }: { title: string; icon: React.ReactNode; count: number; customers: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2 sm:p-3 bg-primary/5 hover:bg-primary/10 transition-colors">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        {icon}
        <span className="font-semibold text-xs sm:text-sm truncate">{title}</span>
        <Badge variant="outline" className="ml-auto text-[10px] sm:text-xs px-1.5 py-0">
          <Users className="h-3 w-3 mr-1" />{customers}
        </Badge>
        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">{count}</Badge>
      </button>
      {open && <div className="p-1.5 sm:p-2 space-y-2">{children}</div>}
    </div>
  );
}

function SuperAdminGrouping({ agents, onSelectAgent, selectedAgentId }: AgentHierarchyTreeProps) {
  const sabps = agents.filter((a) => a.role === "super_admin_partner");
  const others = agents.filter((a) => a.role !== "super_admin_partner");
  const assigned = new Set<string>();
  const nameById = new Map<string, string>();
  agents.forEach((a) => a.panchayath?.name && nameById.set(a.panchayath_id, a.panchayath.name));

  const groups = sabps.map((s) => {
    const scope = new Set(sabpScope(s));
    const members = others.filter((a) => scope.has(a.panchayath_id));
    members.forEach((m) => assigned.add(m.id));
    const byP: Record<string, PennyekartAgent[]> = {};
    members.forEach((m) => {
      const n = nameById.get(m.panchayath_id) || "Unknown Panchayath";
      (byP[n] ||= []).push(m);
    });
    return { s, members, byP };
  });
  const unassigned = others.filter((a) => !assigned.has(a.id));

  return (
    <div className="space-y-4">
      {groups.map(({ s, members, byP }) => (
        <GroupBox key={s.id} title={`${s.name} · ${s.mobile}`} icon={<Briefcase className="h-4 w-4 text-primary" />} count={members.length} customers={sumCustomers(members)}>
          <div
            className={cn("text-xs px-2 py-1 rounded cursor-pointer hover:bg-muted/50", s.id === selectedAgentId && "bg-primary/10")}
            onClick={() => onSelectAgent(s)}
          >
            View Super Admin details
          </div>
          {Object.keys(byP).length === 0 && <p className="text-xs text-muted-foreground px-2">No agents in allocated panchayaths</p>}
          {Object.entries(byP).map(([pn, list]) => (
            <PanchayathNode key={pn} panchayathName={pn} agents={list} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
          ))}
        </GroupBox>
      ))}
      {unassigned.length > 0 && (
        <GroupBox title="Unassigned (no Super Admin)" icon={<Users className="h-4 w-4 text-muted-foreground" />} count={unassigned.length} customers={sumCustomers(unassigned)}>
          <PanchayathGrouping agents={unassigned} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
        </GroupBox>
      )}
    </div>
  );
}

function AgentGrouping({ agents, onSelectAgent, selectedAgentId }: AgentHierarchyTreeProps) {
  const ids = new Set(agents.map((a) => a.id));
  const nonSabp = agents.filter((a) => a.role !== "super_admin_partner");
  const leaders = nonSabp.filter((a) => a.role === "team_leader");
  const orphans = nonSabp.filter((a) => a.role !== "team_leader" && (!a.parent_agent_id || !ids.has(a.parent_agent_id)));

  const downline = (root: PennyekartAgent) => {
    const out: PennyekartAgent[] = [];
    const seen = new Set([root.id]);
    const stack = [root.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const a of agents) if (a.parent_agent_id === id && !seen.has(a.id)) { seen.add(a.id); out.push(a); stack.push(a.id); }
    }
    return out;
  };

  return (
    <div className="space-y-4">
      {leaders.map((tl) => {
        const d = downline(tl);
        return (
          <GroupBox key={tl.id} title={`${tl.name} · ${tl.panchayath?.name || ""}`} icon={<User className="h-4 w-4 text-primary" />} count={d.length + 1} customers={sumCustomers(d)}>
            <AgentNode agent={tl} allAgents={agents} depth={0} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
          </GroupBox>
        );
      })}
      {orphans.length > 0 && (
        <GroupBox title="Unlinked agents" icon={<Users className="h-4 w-4 text-muted-foreground" />} count={orphans.length} customers={sumCustomers(orphans)}>
          {orphans.map((a) => (
            <AgentNode key={a.id} agent={a} allAgents={agents} depth={0} onSelectAgent={onSelectAgent} selectedAgentId={selectedAgentId} />
          ))}
        </GroupBox>
      )}
    </div>
  );
}

function PanchayathGrouping({ agents, onSelectAgent, selectedAgentId }: AgentHierarchyTreeProps) {
  const [fetchedNames, setFetchedNames] = useState<Record<string, string>>({});
  const panchayathNameById = new Map<string, string>(Object.entries(fetchedNames));
  for (const a of agents) {
    if (a.panchayath_id && a.panchayath?.name) {
      panchayathNameById.set(a.panchayath_id, a.panchayath.name);
    }
  }

  const missingKey = Array.from(
    new Set(
      agents
        .filter(isScopedLeader)
        .flatMap((a) => a.responsible_panchayath_ids || [])
        .filter((id) => !panchayathNameById.has(id)),
    ),
  ).sort().join(",");

  useEffect(() => {
    if (!missingKey) return;
    supabase
      .from("panchayaths")
      .select("id, name")
      .in("id", missingKey.split(","))
      .then(({ data }) => {
        if (!data?.length) return;
        setFetchedNames((prev) => {
          const next = { ...prev };
          data.forEach((p) => (next[p.id] = p.name));
          return next;
        });
      });
  }, [missingKey]);

  const byPanchayath: Record<string, PennyekartAgent[]> = {};
  const push = (name: string, agent: PennyekartAgent) => {
    if (!byPanchayath[name]) byPanchayath[name] = [];
    if (!byPanchayath[name].some((x) => x.id === agent.id)) {
      byPanchayath[name].push(agent);
    }
  };

  for (const agent of agents) {
    const homeName = agent.panchayath?.name || "Unknown Panchayath";
    if (isScopedLeader(agent)) {
      for (const pid of agent.responsible_panchayath_ids) {
        const name = panchayathNameById.get(pid);
        if (name) push(name, agent);
      }
    } else {
      push(homeName, agent);
    }
  }

  return (
    <div className="space-y-4">
      {Object.entries(byPanchayath).map(([panchayathName, panchayathAgents]) => (
        <PanchayathNode
          key={panchayathName}
          panchayathName={panchayathName}
          agents={panchayathAgents}
          onSelectAgent={onSelectAgent}
          selectedAgentId={selectedAgentId}
        />
      ))}
    </div>
  );
}

interface PanchayathNodeProps {
  panchayathName: string;
  agents: PennyekartAgent[];
  onSelectAgent: (agent: PennyekartAgent) => void;
  selectedAgentId?: string;
}

function PanchayathNode({ panchayathName, agents, onSelectAgent, selectedAgentId }: PanchayathNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Find root agents: those whose parent is not in this panchayath's agent list
  const agentIds = new Set(agents.map(a => a.id));
  const ROOT_ORDER: AgentRole[] = ["super_admin_partner", "team_leader", "coordinator", "group_leader", "pro"];
  const rootAgents = agents
    .filter(a => !a.parent_agent_id || !agentIds.has(a.parent_agent_id))
    .sort((a, b) => ROOT_ORDER.indexOf(a.role) - ROOT_ORDER.indexOf(b.role));
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 hover:bg-muted transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
        <span className="font-semibold text-xs sm:text-sm truncate">{panchayathName}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] sm:text-xs px-1.5 py-0 flex-shrink-0">
          {agents.length}
        </Badge>
      </button>
      
      {isExpanded && (
        <div className="p-1.5 sm:p-2 space-y-2">
          {rootAgents.map(agent => (
            <AgentNode
              key={agent.id}
              agent={agent}
              allAgents={agents}
              depth={0}
              onSelectAgent={onSelectAgent}
              selectedAgentId={selectedAgentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}


interface AgentNodeProps {
  agent: PennyekartAgent;
  allAgents: PennyekartAgent[];
  depth: number;
  onSelectAgent: (agent: PennyekartAgent) => void;
  selectedAgentId?: string;
  visitedIds?: Set<string>;
}

function AgentNode({ agent, allAgents, depth, onSelectAgent, selectedAgentId, visitedIds = new Set() }: AgentNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Find direct children, excluding self-references and cycles
  const children = allAgents.filter(a => a.parent_agent_id === agent.id && a.id !== agent.id && !visitedIds.has(a.id));
  const hasChildren = children.length > 0;
  const isSelected = agent.id === selectedAgentId;
  
  // Calculate total customer count for this subtree
  const totalCustomers = calculateTotalCustomers(agent, allAgents);
  
  // Calculate rank
  const rank = useMemo(() => calculateAgentRank(agent, allAgents), [agent, allAgents]);
  
  return (
    <div className="ml-2 sm:ml-4">
      <div
        className={cn(
          "flex items-start sm:items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-md cursor-pointer transition-colors group",
          isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
        )}
        onClick={() => onSelectAgent(agent)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0 mt-0.5 sm:mt-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4 sm:w-5 flex-shrink-0" />
        )}
        
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start sm:items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{agent.name}</span>
            <Badge className={cn("text-[10px] sm:text-xs px-1.5 py-0", ROLE_COLORS[agent.role])}>
              {ROLE_LABELS[agent.role]}
            </Badge>
            <RankBadge rank={rank} />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5 sm:gap-1">
              <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">{agent.mobile}</span>
              <span className="sm:hidden">{agent.mobile.slice(-4)}</span>
            </span>
            {agent.ward !== "N/A" && (
              <span className="flex items-center gap-0.5 sm:gap-1">
                <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                W{agent.ward}
              </span>
            )}
            <span className="text-[10px] opacity-70">{rank.label}</span>
          </div>
        </div>
        
        {agent.role === "pro" && (
          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0 flex-shrink-0">
            <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
            {agent.customer_count}
          </Badge>
        )}
        
        {agent.role !== "pro" && totalCustomers > 0 && (
          <Badge variant="outline" className="text-[10px] sm:text-xs text-muted-foreground px-1.5 py-0 flex-shrink-0 hidden sm:flex">
            <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
            {totalCustomers}
          </Badge>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-muted ml-1.5 sm:ml-2.5">
          {children.map(child => {
            const newVisited = new Set(visitedIds);
            newVisited.add(agent.id);
            return (
              <AgentNode
                key={child.id}
                agent={child}
                allAgents={allAgents}
                depth={depth + 1}
                onSelectAgent={onSelectAgent}
                selectedAgentId={selectedAgentId}
                visitedIds={newVisited}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: AgentRankInfo }) {
  if (rank.isFull) {
    return (
      <Badge className="text-[10px] sm:text-xs px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 gap-0.5">
        <Trophy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        Full
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 gap-0.5 text-muted-foreground">
      <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      {rank.percentage}%
    </Badge>
  );
}

function calculateTotalCustomers(agent: PennyekartAgent, allAgents: PennyekartAgent[], visited: Set<string> = new Set()): number {
  if (visited.has(agent.id)) return 0;
  visited.add(agent.id);
  
  if (agent.role === "pro") {
    return agent.customer_count;
  }
  
  const children = allAgents.filter(a => a.parent_agent_id === agent.id);
  return children.reduce((total, child) => total + calculateTotalCustomers(child, allAgents, visited), 0);
}
