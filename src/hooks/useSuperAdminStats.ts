import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminInfo {
  id: string;
  user_id: string;
  full_name: string | null;
  is_active: boolean;
  phone: string | null;
  created_at: string;
  division: { name: string } | null;
}

interface DivisionInfo {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  programCount: number;
  memberCount: number;
}

interface RecentActivity {
  id: string;
  type: "registration" | "program" | "admin";
  description: string;
  timestamp: string;
}

interface SuperAdminStats {
  totalAdmins: number;
  activeAdmins: number;
  totalDivisions: number;
  activeDivisions: number;
  totalPrograms: number;
  activePrograms: number;
  totalRegistrations: number;
  totalMembers: number;
  admins: AdminInfo[];
  divisions: DivisionInfo[];
  recentActivity: RecentActivity[];
  isLoading: boolean;
  error: string | null;
}

export function useSuperAdminStats(): SuperAdminStats & {
  toggleAdminStatus: (adminId: string, currentStatus: boolean) => Promise<void>;
  refetch: () => void;
} {
  const [stats, setStats] = useState<SuperAdminStats>({
    totalAdmins: 0,
    activeAdmins: 0,
    totalDivisions: 0,
    activeDivisions: 0,
    totalPrograms: 0,
    activePrograms: 0,
    totalRegistrations: 0,
    totalMembers: 0,
    admins: [],
    divisions: [],
    recentActivity: [],
    isLoading: true,
    error: null,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch admins
        const { data: admins, error: adminsError } = await supabase
          .from("admins")
          .select(`
            id,
            user_id,
            full_name,
            is_active,
            phone,
            created_at,
            division:divisions(name)
          `)
          .order("created_at", { ascending: false });
        
        if (adminsError) throw adminsError;

        const adminData: AdminInfo[] = (admins || []).map((admin) => ({
          ...admin,
          division: admin.division as { name: string } | null,
        }));

        // Fetch divisions with counts
        const { data: divisions, error: divisionsError } = await supabase
          .from("divisions")
          .select("id, name, description, is_active")
          .order("name");
        
        if (divisionsError) throw divisionsError;

        const [{ data: progDivs }, { data: memDivs }] = await Promise.all([
          supabase.from("programs").select("division_id").limit(10000),
          supabase.from("members").select("division_id").limit(10000),
        ]);
        const pc = new Map<string, number>();
        const mc = new Map<string, number>();
        (progDivs || []).forEach((r: any) => pc.set(r.division_id, (pc.get(r.division_id) || 0) + 1));
        (memDivs || []).forEach((r: any) => mc.set(r.division_id, (mc.get(r.division_id) || 0) + 1));
        // Row cap safety: fall back to exact per-division counts if lists were truncated
        const capped = (progDivs?.length || 0) >= 1000 || (memDivs?.length || 0) >= 1000;
        const divisionData: DivisionInfo[] = capped
          ? await Promise.all((divisions || []).map(async (div) => {
              const [{ count: p }, { count: m }] = await Promise.all([
                supabase.from("programs").select("id", { count: "exact", head: true }).eq("division_id", div.id),
                supabase.from("members").select("id", { count: "exact", head: true }).eq("division_id", div.id),
              ]);
              return { ...div, programCount: p || 0, memberCount: m || 0 };
            }))
          : (divisions || []).map((div) => ({
              ...div, programCount: pc.get(div.id) || 0, memberCount: mc.get(div.id) || 0,
            }));

        const [
          { data: programs, error: programsError },
          { count: registrationCount, error: regError },
          { count: memberCount, error: membersError },
          { data: recentRegs },
          { data: recentPrograms },
        ] = await Promise.all([
          supabase.from("programs").select("id, is_active, name, created_at").order("created_at", { ascending: false }),
          supabase.from("program_registrations").select("id", { count: "exact", head: true }),
          supabase.from("members").select("id", { count: "exact", head: true }),
          supabase.from("program_registrations").select("id, created_at, program:programs(name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("programs").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
        ]);
        if (programsError) throw programsError;
        if (regError) throw regError;
        if (membersError) throw membersError;

        const recentActivity: RecentActivity[] = [];
        for (const reg of recentRegs || []) {
          recentActivity.push({
            id: reg.id,
            type: "registration",
            description: `New registration for "${(reg.program as any)?.name || 'Unknown Program'}"`,
            timestamp: reg.created_at,
          });
        }

        for (const prog of recentPrograms || []) {
          recentActivity.push({
            id: prog.id,
            type: "program",
            description: `Program "${prog.name}" was created`,
            timestamp: prog.created_at,
          });
        }

        // Sort by timestamp
        recentActivity.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setStats({
          totalAdmins: adminData.length,
          activeAdmins: adminData.filter(a => a.is_active).length,
          totalDivisions: divisionData.length,
          activeDivisions: divisionData.filter(d => d.is_active).length,
          totalPrograms: programs?.length || 0,
          activePrograms: programs?.filter(p => p.is_active).length || 0,
          totalRegistrations: registrationCount || 0,
          totalMembers: memberCount || 0,
          admins: adminData,
          divisions: divisionData,
          recentActivity: recentActivity.slice(0, 10),
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        console.error("Error fetching super admin stats:", err);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    };

    fetchStats();
  }, [refreshKey]);

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("admins")
      .update({ is_active: !currentStatus })
      .eq("id", adminId);
    
    if (error) throw error;
    refetch();
  };

  return { ...stats, toggleAdminStatus, refetch };
}
