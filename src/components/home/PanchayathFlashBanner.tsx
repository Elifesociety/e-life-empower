import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Users, Crown, UserCheck, Shield, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  panchayaths: number;
  coordinator: number;
  team_leader: number;
  group_leader: number;
  pro: number;
  total: number;
}

const roleMeta: Record<string, { label: string; icon: any; color: string }> = {
  panchayaths: { label: "Panchayaths", icon: MapPin, color: "from-emerald-500 to-green-600" },
  coordinator: { label: "Coordinators", icon: Crown, color: "from-amber-500 to-yellow-600" },
  team_leader: { label: "Team Leaders", icon: Shield, color: "from-blue-500 to-indigo-600" },
  group_leader: { label: "Group Leaders", icon: UserCheck, color: "from-purple-500 to-fuchsia-600" },
  pro: { label: "P.R.Os", icon: Briefcase, color: "from-rose-500 to-pink-600" },
  total: { label: "Total Agents", icon: Users, color: "from-teal-500 to-cyan-600" },
};

export function PanchayathFlashBanner() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [{ count: pCount }, { data: agents }] = await Promise.all([
        supabase.from("panchayaths").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("pennyekart_agents").select("role").eq("is_active", true),
      ]);
      const counts = { coordinator: 0, team_leader: 0, group_leader: 0, pro: 0 };
      (agents || []).forEach((a: any) => {
        if (a.role in counts) (counts as any)[a.role]++;
      });
      setStats({
        panchayaths: pCount || 0,
        ...counts,
        total: (agents || []).length,
      });
    })();
  }, []);

  const items = stats
    ? (Object.keys(roleMeta) as Array<keyof Stats>).map((k) => ({ key: k, value: stats[k], ...roleMeta[k] }))
    : [];

  // duplicate for seamless marquee
  const loop = [...items, ...items];

  return (
    <button
      onClick={() => navigate("/panchayaths")}
      aria-label="View all panchayath details"
      className="group block w-full overflow-hidden bg-gradient-to-r from-green-900 via-emerald-800 to-green-900 border-y border-amber-500/30 py-2 cursor-pointer hover:from-green-800 hover:to-green-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 px-3 py-1 ml-3 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-green-900 rounded-full animate-pulse">
          Live
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-3 animate-marquee whitespace-nowrap">
            {loop.map((it, i) => {
              const Icon = it.icon;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r ${it.color} text-white shadow-md shrink-0`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold">{it.label}:</span>
                  <span className="text-sm font-bold">{stats ? it.value : "…"}</span>
                </div>
              );
            })}
          </div>
        </div>
        <span className="shrink-0 mr-3 text-[11px] text-amber-300 font-medium group-hover:underline hidden sm:inline">
          View all →
        </span>
      </div>
    </button>
  );
}
