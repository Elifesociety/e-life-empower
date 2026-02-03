import { useState } from "react";
import { ChevronRight, ChevronDown, Users, User, Phone, MapPin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PennyekartAgent, ROLE_LABELS, AgentRole } from "@/hooks/usePennyekartAgents";

interface AgentHierarchyTreeProps {
  agents: PennyekartAgent[];
  onSelectAgent: (agent: PennyekartAgent) => void;
  selectedAgentId?: string;
}

const ROLE_COLORS: Record<AgentRole, string> = {
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

  // Group by panchayath first
  const byPanchayath = agents.reduce((acc, agent) => {
    const panchayathName = agent.panchayath?.name || "Unknown Panchayath";
    if (!acc[panchayathName]) {
      acc[panchayathName] = [];
    }
    acc[panchayathName].push(agent);
    return acc;
  }, {} as Record<string, PennyekartAgent[]>);

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
  
  // Find team leaders (root agents)
  const teamLeaders = agents.filter(a => a.role === "team_leader");
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Building2 className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">{panchayathName}</span>
        <Badge variant="secondary" className="ml-auto">
          {agents.length} agents
        </Badge>
      </button>
      
      {isExpanded && (
        <div className="p-2">
          {teamLeaders.length > 0 ? (
            teamLeaders.map(leader => (
              <AgentNode
                key={leader.id}
                agent={leader}
                allAgents={agents}
                depth={0}
                onSelectAgent={onSelectAgent}
                selectedAgentId={selectedAgentId}
              />
            ))
          ) : (
            // Show orphan agents when no team leaders exist
            agents.map(agent => (
              <AgentNode
                key={agent.id}
                agent={agent}
                allAgents={agents}
                depth={0}
                onSelectAgent={onSelectAgent}
                selectedAgentId={selectedAgentId}
              />
            ))
          )}
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
}

function AgentNode({ agent, allAgents, depth, onSelectAgent, selectedAgentId }: AgentNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Find direct children
  const children = allAgents.filter(a => a.parent_agent_id === agent.id);
  const hasChildren = children.length > 0;
  const isSelected = agent.id === selectedAgentId;
  
  // Calculate total customer count for this subtree
  const totalCustomers = calculateTotalCustomers(agent, allAgents);
  
  return (
    <div className="ml-4">
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors group",
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
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}
        
        <User className="h-4 w-4 text-muted-foreground" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{agent.name}</span>
            <Badge className={cn("text-xs", ROLE_COLORS[agent.role])}>
              {ROLE_LABELS[agent.role]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {agent.mobile}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {agent.ward}
            </span>
          </div>
        </div>
        
        {agent.role === "pro" && (
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {agent.customer_count} customers
          </Badge>
        )}
        
        {agent.role !== "pro" && totalCustomers > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Users className="h-3 w-3 mr-1" />
            {totalCustomers} total
          </Badge>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-muted ml-2.5">
          {children.map(child => (
            <AgentNode
              key={child.id}
              agent={child}
              allAgents={allAgents}
              depth={depth + 1}
              onSelectAgent={onSelectAgent}
              selectedAgentId={selectedAgentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function calculateTotalCustomers(agent: PennyekartAgent, allAgents: PennyekartAgent[]): number {
  if (agent.role === "pro") {
    return agent.customer_count;
  }
  
  const children = allAgents.filter(a => a.parent_agent_id === agent.id);
  return children.reduce((total, child) => total + calculateTotalCustomers(child, allAgents), 0);
}
