import { useCallback, useEffect, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

const TOKEN_KEY = "samrabhaka_token";

export interface SamrabhakaAgent {
  id: string;
  name: string;
  mobile: string;
  role: string;
  ward?: string | null;
  panchayath_id?: string | null;
  panchayaths?: { name: string; district?: string | null } | null;
}

async function call(action: string, payload: Record<string, unknown> = {}, token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
  if (token) headers["x-samrabhaka-token"] = token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/samrabhaka-auth`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useSamrabhakaAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [agent, setAgent] = useState<SamrabhakaAgent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY));

  const loadMe = useCallback(async (t: string) => {
    setIsLoading(true);
    try {
      const res = await call("me", {}, t);
      setAgent(res.agent);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAgent(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadMe(token);
  }, [token, loadMe]);

  const checkMobile = (mobile: string) => call("check_mobile", { mobile });

  const register = async (mobile: string, password: string) => {
    const res = await call("register", { mobile, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    return res;
  };

  const login = async (mobile: string, password: string) => {
    const res = await call("login", { mobile, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    return res;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAgent(null);
  };

  return { token, agent, isLoading, checkMobile, register, login, logout };
}