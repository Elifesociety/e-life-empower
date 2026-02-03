import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AgentRole = "team_leader" | "coordinator" | "group_leader" | "pro";

export interface PennyekartAgent {
  id: string;
  name: string;
  mobile: string;
  role: AgentRole;
  panchayath_id: string;
  ward: string;
  parent_agent_id: string | null;
  customer_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  panchayath?: {
    name: string;
  };
  parent_agent?: {
    name: string;
    role: AgentRole;
  } | null;
  children?: PennyekartAgent[];
}

export interface AgentFilters {
  panchayath_id?: string;
  ward?: string;
  role?: AgentRole;
  search?: string;
}

export function usePennyekartAgents(filters?: AgentFilters) {
  const [agents, setAgents] = useState<PennyekartAgent[]>([]);
  const [hierarchyTree, setHierarchyTree] = useState<PennyekartAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from("pennyekart_agents")
        .select(`
          *,
          panchayath:panchayaths(name)
        `)
        .order("role", { ascending: true })
        .order("name", { ascending: true });

      if (filters?.panchayath_id) {
        query = query.eq("panchayath_id", filters.panchayath_id);
      }
      if (filters?.ward) {
        query = query.eq("ward", filters.ward);
      }
      if (filters?.role) {
        query = query.eq("role", filters.role);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,mobile.ilike.%${filters.search}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const agentsData = (data || []) as unknown as PennyekartAgent[];
      setAgents(agentsData);
      
      // Build hierarchy tree
      const tree = buildHierarchyTree(agentsData);
      setHierarchyTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setIsLoading(false);
    }
  }, [filters?.panchayath_id, filters?.ward, filters?.role, filters?.search]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, hierarchyTree, isLoading, error, refetch: fetchAgents };
}

function buildHierarchyTree(agents: PennyekartAgent[]): PennyekartAgent[] {
  const agentMap = new Map<string, PennyekartAgent>();
  
  // Create map and initialize children arrays
  agents.forEach(agent => {
    agentMap.set(agent.id, { ...agent, children: [] });
  });
  
  const rootAgents: PennyekartAgent[] = [];
  
  // Build tree structure
  agentMap.forEach(agent => {
    if (agent.parent_agent_id && agentMap.has(agent.parent_agent_id)) {
      const parent = agentMap.get(agent.parent_agent_id)!;
      parent.children = parent.children || [];
      parent.children.push(agent);
    } else if (!agent.parent_agent_id || !agentMap.has(agent.parent_agent_id)) {
      // Root level agents (Team Leaders or orphans due to filtering)
      rootAgents.push(agent);
    }
  });
  
  return rootAgents;
}

export function useAgentMutations() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createAgent = async (agentData: Omit<PennyekartAgent, "id" | "created_at" | "updated_at" | "panchayath" | "parent_agent" | "children">) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("pennyekart_agents")
        .insert(agentData)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "Failed to create agent" };
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAgent = async (id: string, updates: Partial<PennyekartAgent>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("pennyekart_agents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "Failed to update agent" };
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAgent = async (id: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("pennyekart_agents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to delete agent" };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { createAgent, updateAgent, deleteAgent, isSubmitting };
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO"
};

export const ROLE_HIERARCHY: AgentRole[] = ["team_leader", "coordinator", "group_leader", "pro"];

export function getParentRole(role: AgentRole): AgentRole | null {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index > 0 ? ROLE_HIERARCHY[index - 1] : null;
}

export function getChildRole(role: AgentRole): AgentRole | null {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index < ROLE_HIERARCHY.length - 1 ? ROLE_HIERARCHY[index + 1] : null;
}
