import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PanchayathRow {
  id: string;
  name: string;
  name_ml: string | null;
  district: string | null;
  total: number;
  coordinator: number;
  team_leader: number;
  group_leader: number;
  pro: number;
}

export function PanchayathDetailsTicker() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PanchayathRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: pData }, { data: aData }] = await Promise.all([
        supabase.from("panchayaths").select("id, name, name_ml, district").eq("is_active", true).order("name"),
        supabase.from("pennyekart_agents").select("panchayath_id, role").eq("is_active", true),
      ]);
      const map: Record<string, Omit<PanchayathRow, "id" | "name" | "name_ml" | "district">> = {};
      (aData || []).forEach((a: any) => {
        if (!a.panchayath_id) return;
        if (!map[a.panchayath_id]) map[a.panchayath_id] = { total: 0, coordinator: 0, team_leader: 0, group_leader: 0, pro: 0 };
        if (a.role in map[a.panchayath_id]) (map[a.panchayath_id] as any)[a.role]++;
        map[a.panchayath_id].total++;
      });
      const merged: PanchayathRow[] = (pData || [])
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          name_ml: p.name_ml,
          district: p.district,
          total: map[p.id]?.total || 0,
          coordinator: map[p.id]?.coordinator || 0,
          team_leader: map[p.id]?.team_leader || 0,
          group_leader: map[p.id]?.group_leader || 0,
          pro: map[p.id]?.pro || 0,
        }))
        .filter((p) => p.total > 0)
        .sort((a, b) => b.total - a.total);
      setRows(merged);
    })();
  }, []);

  if (rows.length === 0) return null;
  const loop = [...rows, ...rows];

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-b border-amber-200 py-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 px-3 py-1 ml-3 text-[10px] font-bold uppercase tracking-wider bg-kerala-green text-white rounded-full">
          Panchayaths
        </span>
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-2 animate-marquee whitespace-nowrap" style={{ animationDuration: "30s" }}>
            {loop.map((p, i) => {
              const rank = (i % rows.length) + 1;
              const rankColor =
                rank === 1
                  ? "bg-amber-500 text-white"
                  : rank === 2
                  ? "bg-slate-400 text-white"
                  : rank === 3
                  ? "bg-orange-600 text-white"
                  : "bg-kerala-green/10 text-kerala-green";
              return (
                <button
                  key={`${p.id}-${i}`}
                  onClick={() => navigate("/panchayaths")}
                  className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-amber-300 hover:border-kerala-green hover:shadow transition-all"
                  title={`#${rank} ${p.name}${p.district ? " · " + p.district : ""}`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rankColor}`}>#{rank}</span>
                  <MapPin className="w-3.5 h-3.5 text-kerala-green" />
                  <span className="text-xs font-semibold text-foreground">{p.name}</span>
                  {p.name_ml && <span className="text-[11px] text-muted-foreground">({p.name_ml})</span>}
                  <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium border-l border-amber-200 pl-2">
                    <Users className="w-3 h-3" /> {p.total}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    C:{p.coordinator} · TL:{p.team_leader} · GL:{p.group_leader} · PRO:{p.pro}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
