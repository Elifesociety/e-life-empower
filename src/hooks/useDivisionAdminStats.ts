import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProgramInfo {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  registrationCount: number;
}

interface RecentRegistration {
  id: string;
  program_name: string;
  registrant_name: string;
  created_at: string;
  verification_status: string;
}

interface DivisionAdminStats {
  divisionName: string;
  divisionDescription: string | null;
  totalPrograms: number;
  activePrograms: number;
  totalRegistrations: number;
  totalMembers: number;
  programs: ProgramInfo[];
  recentRegistrations: RecentRegistration[];
  isLoading: boolean;
  error: string | null;
}

export function useDivisionAdminStats(divisionId: string | undefined): DivisionAdminStats {
  const [stats, setStats] = useState<DivisionAdminStats>({
    divisionName: "",
    divisionDescription: null,
    totalPrograms: 0,
    activePrograms: 0,
    totalRegistrations: 0,
    totalMembers: 0,
    programs: [],
    recentRegistrations: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!divisionId) {
      setStats(prev => ({ ...prev, isLoading: false, error: "No division ID" }));
      return;
    }

    const fetchStats = async () => {
      try {
        // Fetch all data in parallel
        const [
          { data: division, error: divError },
          { data: programs, error: progError },
          { count: memberCount, error: memError },
        ] = await Promise.all([
          supabase
            .from("divisions")
            .select("id, name, description")
            .eq("id", divisionId)
            .single(),
          supabase
            .from("programs")
            .select("id, name, is_active, created_at")
            .eq("division_id", divisionId)
            .order("created_at", { ascending: false }),
          supabase
            .from("members")
            .select("*", { count: "exact", head: true })
            .eq("division_id", divisionId),
        ]);

        if (divError) throw divError;
        if (progError) throw progError;
        if (memError) throw memError;

        const programIds = programs?.map(p => p.id) || [];

        // Fetch registrations for these programs
        let allRegistrations: any[] = [];
        if (programIds.length > 0) {
          const { data: regs, error: regError } = await supabase
            .from("program_registrations")
            .select("id, program_id, created_at, answers, verification_status")
            .in("program_id", programIds)
            .order("created_at", { ascending: false });

          if (regError) throw regError;
          allRegistrations = regs || [];
        }

        // Count registrations per program
        const regsByProgram = new Map<string, number>();
        for (const reg of allRegistrations) {
          regsByProgram.set(reg.program_id, (regsByProgram.get(reg.program_id) || 0) + 1);
        }

        const programInfos: ProgramInfo[] = (programs || []).map(p => ({
          id: p.id,
          name: p.name,
          is_active: p.is_active,
          created_at: p.created_at,
          registrationCount: regsByProgram.get(p.id) || 0,
        }));

        // Build recent registrations
        const programNameMap = new Map((programs || []).map(p => [p.id, p.name]));
        const recentRegistrations: RecentRegistration[] = allRegistrations
          .slice(0, 10)
          .map(reg => {
            const answers = (reg.answers as Record<string, any>) || {};
            return {
              id: reg.id,
              program_name: programNameMap.get(reg.program_id) || "Unknown",
              registrant_name: answers.full_name || answers.name || "Unknown",
              created_at: reg.created_at,
              verification_status: reg.verification_status,
            };
          });

        setStats({
          divisionName: division?.name || "",
          divisionDescription: division?.description || null,
          totalPrograms: programs?.length || 0,
          activePrograms: programs?.filter(p => p.is_active).length || 0,
          totalRegistrations: allRegistrations.length,
          totalMembers: memberCount || 0,
          programs: programInfos,
          recentRegistrations,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        console.error("Error fetching division admin stats:", err);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    };

    fetchStats();
  }, [divisionId]);

  return stats;
}
