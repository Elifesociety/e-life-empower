import { useState, useMemo } from "react";
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

export function AgentHierarchyTree({ agents, onSelectAgent, selectedAgentId }: AgentHierarchyTreeProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p>No agents found</p>
        <p className="text-sm">Add agents to see the hierarchy</p>
      </div>
    );
  }

  // Build panchayath id -> name map from agents (so we can place SABPs into
  // every panchayath listed in their responsible_panchayath_ids).
  const panchayathNameById = new Map<string, string>();
  for (const a of agents) {
    if (a.panchayath_id && a.panchayath?.name) {
      panchayathNameById.set(a.panchayath_id, a.panchayath.name);
    }
  }

  // Group by panchayath. Each agent appears under its home panchayath, plus
  // Super Admin / Business Partners additionally appear under every panchayath
  // they are allocated to via responsible_panchayath_ids.
  const byPanchayath: Record<string, PennyekartAgent[]> = {};
  const push = (name: string, agent: PennyekartAgent) => {
    if (!byPanchayath[name]) byPanchayath[name] = [];
    if (!byPanchayath[name].some((x) => x.id === agent.id)) {
      byPanchayath[name].push(agent);
    }
  };

  for (const agent of agents) {
    const homeName = agent.panchayath?.name || "Unknown Panchayath";
    push(homeName, agent);
    if (agent.role === "super_admin_partner" && agent.responsible_panchayath_ids?.length) {
      for (const pid of agent.responsible_panchayath_ids) {
        const name = panchayathNameById.get(pid);
        if (name && name !== homeName) push(name, agent);
      }
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
