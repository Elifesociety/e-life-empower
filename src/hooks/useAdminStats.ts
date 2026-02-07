import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PanchayathStats {
  id: string;
  name: string;
  registrations: number;
  programs: number;
}

interface ClusterStats {
  id: string;
  name: string;
  members: number;
  panchayath_name: string;
}

interface RecentRegistration {
  id: string;
  program_name: string;
  registrant_name: string;
  created_at: string;
}

interface AdminStats {
  totalPrograms: number;
  totalRegistrations: number;
  activePrograms: number;
  totalMembers: number;
  panchayathStats: PanchayathStats[];
  clusterStats: ClusterStats[];
  recentRegistrations: RecentRegistration[];
  isLoading: boolean;
  error: string | null;
}

export function useAdminStats(): AdminStats {
  const { adminData, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalPrograms: 0,
    totalRegistrations: 0,
    activePrograms: 0,
    totalMembers: 0,
    panchayathStats: [],
    clusterStats: [],
    recentRegistrations: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const divisionId = adminData?.division_id;
        const accessAllDivisions = adminData?.access_all_divisions;
        const additionalDivisionIds = adminData?.additional_division_ids || [];
        
        if (!divisionId && !isSuperAdmin) {
          setStats(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Determine all accessible division IDs
        const canAccessAll = isSuperAdmin || accessAllDivisions;
        const accessibleDivisionIds = canAccessAll
          ? [] // empty means no filter (all divisions)
          : [divisionId!, ...additionalDivisionIds];

        // Fetch all data in parallel instead of sequentially
        let programsQuery = supabase
          .from("programs")
          .select("id, is_active, panchayath_id, all_panchayaths, division_id");
        
        if (!canAccessAll && accessibleDivisionIds.length > 0) {
          programsQuery = programsQuery.in("division_id", accessibleDivisionIds);
        }

        let membersQuery = supabase
          .from("members")
          .select("id, cluster_id", { count: "exact" });
        
        if (!canAccessAll && accessibleDivisionIds.length > 0) {
          membersQuery = membersQuery.in("division_id", accessibleDivisionIds);
        }

        const panchayathsQuery = supabase
          .from("panchayaths")
          .select("id, name")
          .eq("is_active", true);

        const clustersQuery = supabase
          .from("clusters")
          .select(`id, name, panchayath:panchayaths(name)`)
          .eq("is_active", true);

        // Execute all queries in parallel
        const [
          { data: programs, error: programsError },
          { data: members, count: membersCount, error: membersError },
          { data: panchayaths, error: panchError },
          { data: clusters, error: clusterError }
        ] = await Promise.all([
          programsQuery,
          membersQuery,
          panchayathsQuery,
          clustersQuery
        ]);

        if (programsError) throw programsError;
        if (membersError) throw membersError;
        if (panchError) throw panchError;
        if (clusterError) throw clusterError;

        const programIds = programs?.map(p => p.id) || [];
        const activePrograms = programs?.filter(p => p.is_active).length || 0;

        // Fetch registrations and recent registrations in parallel
        const registrationsPromise = programIds.length > 0
          ? supabase
              .from("program_registrations")
              .select("id, program_id, created_at, answers")
              .in("program_id", programIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null });

        const { data: allRegistrations, error: regError } = await registrationsPromise;
        if (regError) throw regError;

        const registrationsCount = allRegistrations?.length || 0;

        // Calculate panchayath stats from already fetched data (no additional queries)
        const panchayathStats: PanchayathStats[] = [];
        const programsByPanchayath = new Map<string, string[]>();
        
        // Group programs by panchayath
        for (const program of programs || []) {
          if (program.all_panchayaths) {
            // Add to all panchayaths
            for (const p of panchayaths || []) {
              const existing = programsByPanchayath.get(p.id) || [];
              if (!existing.includes(program.id)) {
                programsByPanchayath.set(p.id, [...existing, program.id]);
              }
            }
          } else if (program.panchayath_id) {
            const existing = programsByPanchayath.get(program.panchayath_id) || [];
            if (!existing.includes(program.id)) {
              programsByPanchayath.set(program.panchayath_id, [...existing, program.id]);
            }
          }
        }

        // Count registrations per panchayath from fetched data
        const registrationsByProgram = new Map<string, number>();
        for (const reg of allRegistrations || []) {
          const count = registrationsByProgram.get(reg.program_id) || 0;
          registrationsByProgram.set(reg.program_id, count + 1);
        }

        for (const panchayath of panchayaths || []) {
          const panchayathProgramIds = programsByPanchayath.get(panchayath.id) || [];
          const panchayathPrograms = panchayathProgramIds.length;
          const panchayathRegs = panchayathProgramIds.reduce(
            (sum, pid) => sum + (registrationsByProgram.get(pid) || 0), 
            0
          );

          if (panchayathPrograms > 0 || panchayathRegs > 0) {
            panchayathStats.push({
              id: panchayath.id,
              name: panchayath.name,
              programs: panchayathPrograms,
              registrations: panchayathRegs,
            });
          }
        }

        // Calculate cluster stats from already fetched members (no additional queries)
        const membersByCluster = new Map<string, number>();
        for (const member of members || []) {
          const count = membersByCluster.get(member.cluster_id) || 0;
          membersByCluster.set(member.cluster_id, count + 1);
        }

        const clusterStats: ClusterStats[] = [];
        for (const cluster of clusters || []) {
          const memberCount = membersByCluster.get(cluster.id) || 0;
          if (memberCount > 0) {
            clusterStats.push({
              id: cluster.id,
              name: cluster.name,
              members: memberCount,
              panchayath_name: (cluster.panchayath as any)?.name || "Unknown",
            });
          }
        }

        // Build recent registrations from fetched data
        const recentRegistrations: RecentRegistration[] = [];
        const programMap = new Map(programs?.map(p => [p.id, p]) || []);
        
        // Get program names for recent registrations
        const recentRegs = (allRegistrations || []).slice(0, 10);
        if (recentRegs.length > 0) {
          const recentProgramIds = [...new Set(recentRegs.map(r => r.program_id))];
          const { data: programNames } = await supabase
            .from("programs")
            .select("id, name")
            .in("id", recentProgramIds);
          
          const programNameMap = new Map(programNames?.map(p => [p.id, p.name]) || []);
          
          for (const reg of recentRegs) {
            const answers = reg.answers as Record<string, any> || {};
            const registrantName = answers.full_name || answers.name || "Unknown";
            recentRegistrations.push({
              id: reg.id,
              program_name: programNameMap.get(reg.program_id) || "Unknown Program",
              registrant_name: registrantName,
              created_at: reg.created_at,
            });
          }
        }

        setStats({
          totalPrograms: programs?.length || 0,
          totalRegistrations: registrationsCount,
          activePrograms,
          totalMembers: membersCount || 0,
          panchayathStats: panchayathStats.sort((a, b) => b.registrations - a.registrations),
          clusterStats: clusterStats.sort((a, b) => b.members - a.members),
          recentRegistrations,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        console.error("Error fetching admin stats:", err);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    };

    fetchStats();
  }, [adminData, isSuperAdmin]);

  return stats;
}
