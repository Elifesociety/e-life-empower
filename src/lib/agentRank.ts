import { PennyekartAgent, AgentRole, ROLE_LABELS } from "@/hooks/usePennyekartAgents";

export interface AgentRankInfo {
  isFull: boolean;
  current: number;
  required: number;
  label: string; // e.g. "3/5 PROs"
  percentage: number; // 0-100
}

export interface AgentRankDetail {
  agent: PennyekartAgent;
  rank: AgentRankInfo;
}

export interface AgentRankBreakdown {
  rankInfo: AgentRankInfo;
  requiredRole: string; // human label of the role needed
  details: AgentRankDetail[]; // each downstream agent with their rank status
}

/**
 * Find all descendants of an agent recursively.
 */
function getAllDescendants(
  agent: PennyekartAgent,
  allAgents: PennyekartAgent[],
  visited: Set<string> = new Set()
): PennyekartAgent[] {
  if (visited.has(agent.id)) return [];
  visited.add(agent.id);

  const directChildren = allAgents.filter(
    (a) => a.parent_agent_id === agent.id && a.id !== agent.id && !visited.has(a.id)
  );

  const result: PennyekartAgent[] = [...directChildren];
  for (const child of directChildren) {
    result.push(...getAllDescendants(child, allAgents, visited));
  }
  return result;
}

/**
 * Calculate rank fulfillment for an agent based on their downstream team.
 *
 * Rules:
 * - PRO: full rank if customer_count >= 5
 * - Group Leader: full rank if has >= 5 PROs (in descendants) each with >= 5 customers
 * - Coordinator: full rank if has >= 5 full-rank Group Leaders (in descendants)
 * - Team Leader: full rank if has >= 4 full-rank Coordinators (in descendants)
 */
export function calculateAgentRank(
  agent: PennyekartAgent,
  allAgents: PennyekartAgent[],
  visited: Set<string> = new Set()
): AgentRankInfo {
  if (visited.has(agent.id)) {
    return { isFull: false, current: 0, required: 1, label: "–", percentage: 0 };
  }
  visited.add(agent.id);

  // Get all descendants for non-PRO roles
  // Use a fresh visited set for getAllDescendants (don't include the agent itself,
  // since getAllDescendants checks visited and would return [] immediately)
  const descendants = agent.role !== "pro"
    ? getAllDescendants(agent, allAgents, new Set())
    : [];

  switch (agent.role) {
    case "pro": {
      const req = 5;
      const cur = agent.customer_count;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Customers`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "group_leader": {
      const req = 5;
      const pros = descendants.filter((c) => c.role === "pro");
      const fullPros = pros.filter((c) => {
        const rank = calculateAgentRank(c, allAgents, new Set(visited));
        return rank.isFull;
      });
      const cur = fullPros.length;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Full PROs${pros.length > cur ? ` (${pros.length} total)` : ""}`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "coordinator": {
      const req = 5;
      const gls = descendants.filter((c) => c.role === "group_leader");
      const fullGLs = gls.filter((c) => {
        const rank = calculateAgentRank(c, allAgents, new Set(visited));
        return rank.isFull;
      });
      const cur = fullGLs.length;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Full GLs${gls.length > cur ? ` (${gls.length} total)` : ""}`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "team_leader": {
      const req = 4;
      const coords = descendants.filter((c) => c.role === "coordinator");
      const fullCoords = coords.filter((c) => {
        const rank = calculateAgentRank(c, allAgents, new Set(visited));
        return rank.isFull;
      });
      const cur = fullCoords.length;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Full Coords${coords.length > cur ? ` (${coords.length} total)` : ""}`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    default:
      return { isFull: true, current: 0, required: 0, label: "", percentage: 100 };
  }
}

/**
 * Get a detailed breakdown of an agent's rank fulfillment,
 * showing each downstream agent and their individual status.
 */
export function getAgentRankBreakdown(
  agent: PennyekartAgent,
  allAgents: PennyekartAgent[]
): AgentRankBreakdown {
  const rankInfo = calculateAgentRank(agent, allAgents);
  const descendants = getAllDescendants(agent, allAgents, new Set());

  switch (agent.role) {
    case "pro": {
      return {
        rankInfo,
        requiredRole: "Customers",
        details: [], // PROs don't have sub-agents to show
      };
    }
    case "group_leader": {
      const pros = descendants.filter(a => a.role === "pro");
      return {
        rankInfo,
        requiredRole: ROLE_LABELS.pro,
        details: pros.map(a => ({
          agent: a,
          rank: calculateAgentRank(a, allAgents),
        })).sort((a, b) => (a.rank.isFull === b.rank.isFull ? 0 : a.rank.isFull ? 1 : -1)),
      };
    }
    case "coordinator": {
      const gls = descendants.filter(a => a.role === "group_leader");
      return {
        rankInfo,
        requiredRole: ROLE_LABELS.group_leader,
        details: gls.map(a => ({
          agent: a,
          rank: calculateAgentRank(a, allAgents),
        })).sort((a, b) => (a.rank.isFull === b.rank.isFull ? 0 : a.rank.isFull ? 1 : -1)),
      };
    }
    case "team_leader": {
      const coords = descendants.filter(a => a.role === "coordinator");
      return {
        rankInfo,
        requiredRole: ROLE_LABELS.coordinator,
        details: coords.map(a => ({
          agent: a,
          rank: calculateAgentRank(a, allAgents),
        })).sort((a, b) => (a.rank.isFull === b.rank.isFull ? 0 : a.rank.isFull ? 1 : -1)),
      };
    }
    default:
      return { rankInfo, requiredRole: "", details: [] };
  }
}
