import { supabase } from "@/integrations/supabase/client";

export interface PanchayathAccess {
  canManage: boolean;
  mobile: string | null;
  role: "super_admin_partner" | "team_leader" | null;
  agentId: string | null;
}

/**
 * Check whether the visitor (identified via the MobileGate session) is a
 * Team Leader or Super Admin / Business Partner with scope over a given
 * panchayath, and may therefore add/edit agents in that panchayath.
 */
export async function checkPanchayathAccess(
  panchayathId: string,
): Promise<PanchayathAccess> {
  let mobile: string | null = null;
  try {
    mobile = localStorage.getItem("elife_status_mobile");
  } catch {
    mobile = null;
  }

  const empty: PanchayathAccess = { canManage: false, mobile, role: null, agentId: null };
  if (!mobile) return empty;

  const { data, error } = await supabase
    .from("pennyekart_agents")
    .select("id, role, panchayath_id, responsible_panchayath_ids, is_active")
    .eq("mobile", mobile)
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
    mobile,
    role: match.role as "super_admin_partner" | "team_leader",
    agentId: match.id,
  };
}
