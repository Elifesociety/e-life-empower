import { useState, useEffect, useCallback } from "react";

export interface AgentDirectCustomer {
  id: string;
  agent_id: string;
  name: string;
  mobile: string;
  ward: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirectCustomerInput {
  name: string;
  mobile: string;
  ward?: string;
  address?: string;
  notes?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

async function callFn(method: string, body: object, callerMobile?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  const adminToken = localStorage.getItem("elife_admin_token");
  if (adminToken) headers["x-admin-token"] = adminToken;
  if (callerMobile) headers["x-caller-mobile"] = callerMobile;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/pennyekart-agents`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useAgentDirectCustomers(agentId: string | null, callerMobile?: string) {
  const [customers, setCustomers] = useState<AgentDirectCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!agentId) {
      setCustomers([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await callFn("POST", { action: "list_customers", agent_id: agentId }, callerMobile);
      setCustomers(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setIsLoading(false);
    }
  }, [agentId, callerMobile]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const create = async (customer: DirectCustomerInput) => {
    if (!agentId) return { error: "No agent selected" };
    try {
      await callFn("POST", { action: "add_customer", agent_id: agentId, customer }, callerMobile);
      await refetch();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to add" };
    }
  };

  const update = async (id: string, customer: DirectCustomerInput) => {
    try {
      await callFn("POST", { action: "update_customer", id, customer }, callerMobile);
      await refetch();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to update" };
    }
  };

  const remove = async (id: string) => {
    try {
      await callFn("POST", { action: "delete_customer", id }, callerMobile);
      await refetch();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to delete" };
    }
  };

  return { customers, isLoading, error, refetch, create, update, remove };
}