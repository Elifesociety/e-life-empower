import { supabase } from "@/integrations/supabase/client";

export interface PanchayathAccess {
  canManage: boolean;
  mobile: string | null;
  role: "super_admin_partner" | "team_leader" | "admin" | null;
  agentId: string | null;
}

/**
 * Check whether the visitor may add/edit/delete agents in a given panchayath.
 * Allowed for: signed-in admins (admin token or Supabase session), and
 * Team Leaders / Super Admin – Business Partners scoped to that panchayath
 * (identified via the MobileGate session).
 */
export async function checkPanchayathAccess(
  panchayathId: string,
): Promise<PanchayathAccess> {
  let mobile: string | null = null;
  let adminToken: string | null = null;
  try {
    mobile = localStorage.getItem("elife_status_mobile");
    adminToken = localStorage.getItem("elife_admin_token");
  } catch {
    mobile = null;
  }

  const empty: PanchayathAccess = { canManage: false, mobile, role: null, agentId: null };

  // Admin sessions (custom admin token or Supabase auth) can always manage.
  if (adminToken) {
    return { canManage: true, mobile, role: "admin", agentId: null };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { canManage: true, mobile, role: "admin", agentId: null };
  }

  if (!mobile) return empty;

  const normalized = mobile.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("pennyekart_agents")
    .select("id, role, panchayath_id, responsible_panchayath_ids, is_active")
    .eq("mobile", normalized)
    .in("role", ["super_admin_partner", "team_leader"])
    .eq("is_active", true);

  if (error || !data || data.length === 0) return empty;

  const match = data.find((a: any) => {
    if (a.panchayath_id === panchayathId) return true;
    const scope: string[] = a.responsible_panchayath_ids || [];
    return scope.includes(panchayathId);
  });

  if (!match) return empty;

  return {
    canManage: true,
    mobile: normalized,
    role: match.role as "super_admin_partner" | "team_leader",
    agentId: match.id,
  };
}

