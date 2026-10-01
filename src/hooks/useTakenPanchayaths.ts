import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Roles where one panchayath may belong to only one agent of that role. */
export const EXCLUSIVE_PANCHAYATH_ROLES = ["super_admin_partner", "team_leader"];

/**
 * Returns a map of panchayath id -> names of other active agents of the same role
 * who already hold that panchayath (own panchayath or responsible panchayaths).
 * Empty for Group Leader / PRO.
 */
export function useTakenPanchayaths(
  open: boolean,
  role: string | undefined,
  excludeAgentId?: string | null,
) {
  const [takenMap, setTakenMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open || !role || !EXCLUSIVE_PANCHAYATH_ROLES.includes(role)) {
      setTakenMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pennyekart_agents")
        .select("id, name, panchayath_id, responsible_panchayath_ids")
        .eq("role", role as any)
        .eq("is_active", true);
      if (cancelled) return;
      const map: Record<string, string[]> = {};
      (data || []).forEach((a: any) => {
        if (excludeAgentId && a.id === excludeAgentId) return;
        const ids = new Set<string>(
          [a.panchayath_id, ...(a.responsible_panchayath_ids || [])].filter(Boolean),
        );
        ids.forEach((pid) => {
          (map[pid] ||= []).push(a.name);
        });
      });
      setTakenMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, role, excludeAgentId]);

  return takenMap;
}
