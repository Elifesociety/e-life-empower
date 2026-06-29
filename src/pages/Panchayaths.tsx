import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Search, Users, Crown, Shield, UserCheck, Briefcase } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Panchayath {
  id: string;
  name: string;
  name_ml: string | null;
  district: string | null;
  state: string | null;
  code: string | null;
}

interface RoleCounts {
  coordinator: number;
  team_leader: number;
  group_leader: number;
  pro: number;
  total: number;
}

interface AgentLite {
  id: string;
  name: string;
  mobile: string;
  role: string;
  panchayath_id: string;
  responsible_panchayath_ids: string[] | null;
}

const roleIcon = {
  coordinator: Crown,
  team_leader: Shield,
  group_leader: UserCheck,
  pro: Briefcase,
};

export default function Panchayaths() {
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, RoleCounts>>({});
  const [leadersMap, setLeadersMap] = useState<Record<string, AgentLite[]>>({});
  const [partnersMap, setPartnersMap] = useState<Record<string, AgentLite[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: pData }, { data: aData }] = await Promise.all([
        supabase.from("panchayaths").select("id, name, name_ml, district, state, code").eq("is_active", true).order("name"),
        supabase.from("pennyekart_agents").select("id, name, mobile, role, panchayath_id, responsible_panchayath_ids").eq("is_active", true),
      ]);
      const map: Record<string, RoleCounts> = {};
      const leaders: Record<string, AgentLite[]> = {};
      const partners: Record<string, AgentLite[]> = {};
      (aData || []).forEach((a: any) => {
        if (a.panchayath_id) {
          if (!map[a.panchayath_id]) map[a.panchayath_id] = { coordinator: 0, team_leader: 0, group_leader: 0, pro: 0, total: 0 };
          if (a.role in map[a.panchayath_id]) (map[a.panchayath_id] as any)[a.role]++;
          map[a.panchayath_id].total++;
        }
        if (a.role === "team_leader" && a.panchayath_id) {
          (leaders[a.panchayath_id] ||= []).push(a);
        }
        if (a.role === "super_admin_partner") {
          const ids = new Set<string>([a.panchayath_id, ...(a.responsible_panchayath_ids || [])].filter(Boolean));
          ids.forEach((pid) => (partners[pid] ||= []).push(a));
        }
      });
      const sorted = (pData || []).sort((a: any, b: any) => {
        if (!a.code && !b.code) return 0;
        if (!a.code) return 1;
        if (!b.code) return -1;
        return a.code.localeCompare(b.code);
      });
      setAgentMap(map);
      setLeadersMap(leaders);
      setPartnersMap(partners);
      setPanchayaths(sorted);
      setLoading(false);
    })();
  }, []);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return panchayaths;
    return panchayaths.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.name_ml?.toLowerCase().includes(q) ||
        p.district?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q),
    );
  }, [panchayaths, search]);

  const totals = useMemo(() => {
    return Object.values(agentMap).reduce(
      (acc, c) => {
        acc.coordinator += c.coordinator;
        acc.team_leader += c.team_leader;
        acc.group_leader += c.group_leader;
        acc.pro += c.pro;
        acc.total += c.total;
        return acc;
      },
      { coordinator: 0, team_leader: 0, group_leader: 0, pro: 0, total: 0 },
    );
  }, [agentMap]);

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-3">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Home</Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-kerala-green flex items-center gap-2">
            <MapPin className="w-7 h-7" /> Panchayath Details
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {panchayaths.length} panchayaths · {totals.total} total agents across the hierarchy
          </p>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
          {[
            { k: "Panchayaths", v: panchayaths.length, c: "bg-emerald-100 text-emerald-800" },
            { k: "Coordinators", v: totals.coordinator, c: "bg-amber-100 text-amber-800" },
            { k: "Team Leaders", v: totals.team_leader, c: "bg-blue-100 text-blue-800" },
            { k: "Group Leaders", v: totals.group_leader, c: "bg-purple-100 text-purple-800" },
            { k: "P.R.Os", v: totals.pro, c: "bg-rose-100 text-rose-800" },
          ].map((s) => (
            <div key={s.k} className={`rounded-lg px-3 py-2 ${s.c}`}>
              <div className="text-[10px] uppercase tracking-wide opacity-80">{s.k}</div>
              <div className="text-lg font-bold">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search panchayath, district, code…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No panchayaths found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const counts = agentMap[p.id] || { coordinator: 0, team_leader: 0, group_leader: 0, pro: 0, total: 0 };
              return (
                <Card key={p.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-kerala-green">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start justify-between gap-2">
                      <div>
                    <div className="font-semibold">{p.name}</div>
                        {p.name_ml && <div className="text-xs text-muted-foreground font-normal">{p.name_ml}</div>}
                        {p.code && (
                          <Badge variant="outline" className="mt-1 text-[10px] font-mono">
                            Code: {p.code}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <Users className="w-3 h-3 mr-1" /> {counts.total}
                      </Badge>
                    </CardTitle>
                    {(p.district || p.state) && (
                      <p className="text-xs text-muted-foreground">
                        {[p.district, p.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(["coordinator", "team_leader", "group_leader", "pro"] as const).map((r) => {
                        const Icon = roleIcon[r];
                        const label = r === "pro" ? "P.R.O" : r.replace("_", " ");
                        return (
                          <div key={r} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                            <span className="flex items-center gap-1 capitalize text-muted-foreground">
                              <Icon className="w-3 h-3" /> {label}
                            </span>
                            <span className="font-semibold">{counts[r]}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Super Admin / Business Partners */}
                    <div className="rounded-md border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-1">
                        <Crown className="w-3 h-3" /> Super Admin / Business Partner
                      </div>
                      {(partnersMap[p.id] || []).length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">Not allocated</p>
                      ) : (
                        <ul className="space-y-1">
                          {partnersMap[p.id].map((a) => (
                            <li key={a.id} className="flex items-center justify-between text-xs">
                              <span className="font-medium text-amber-900 dark:text-amber-200">{a.name}</span>
                              <a href={`tel:${a.mobile}`} className="text-[11px] font-mono text-amber-700 dark:text-amber-300 hover:underline">{a.mobile}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Team Leaders */}
                    <div className="rounded-md border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300 mb-1">
                        <Shield className="w-3 h-3" /> Team Leaders
                      </div>
                      {(leadersMap[p.id] || []).length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">Not allocated</p>
                      ) : (
                        <ul className="space-y-1">
                          {leadersMap[p.id].map((a) => (
                            <li key={a.id} className="flex items-center justify-between text-xs">
                              <span className="font-medium text-blue-900 dark:text-blue-200">{a.name}</span>
                              <a href={`tel:${a.mobile}`} className="text-[11px] font-mono text-blue-700 dark:text-blue-300 hover:underline">{a.mobile}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>

                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
