import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Search, Users, Crown, Shield, UserCheck, Briefcase, ShoppingCart, FileText } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PanchayathAgentsDialog } from "@/components/panchayath/PanchayathAgentsDialog";

interface Panchayath {
  id: string;
  name: string;
  name_ml: string | null;
  district: string | null;
  state: string | null;
  code: string | null;
}

interface Metrics {
  coordinator: number;
  team_leader: number;
  group_leader: number;
  pro: number;
  total: number;
  customers: number;
  registrations: number;
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

type FilterKey = "pro" | "group_leader" | "coordinator" | "team_leader" | "customers" | "registrations";
type SortKey = "code" | "name" | "pro" | "group_leader" | "coordinator" | "team_leader" | "customers" | "registrations";

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "pro", label: "Has PRO" },
  { key: "group_leader", label: "Has Group Leader" },
  { key: "coordinator", label: "Has Coordinator" },
  { key: "team_leader", label: "Has Team Leader" },
  { key: "customers", label: "Has Customers" },
  { key: "registrations", label: "Has Registrations" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "code", label: "Code (default)" },
  { key: "name", label: "Name (A–Z)" },
  { key: "pro", label: "Most PROs" },
  { key: "group_leader", label: "Most Group Leaders" },
  { key: "coordinator", label: "Most Coordinators" },
  { key: "team_leader", label: "Most Team Leaders" },
  { key: "customers", label: "Most Customers" },
  { key: "registrations", label: "Most Registrations" },
];

const emptyMetrics = (): Metrics => ({
  coordinator: 0,
  team_leader: 0,
  group_leader: 0,
  pro: 0,
  total: 0,
  customers: 0,
  registrations: 0,
});

export default function Panchayaths() {
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [leadersMap, setLeadersMap] = useState<Record<string, AgentLite[]>>({});
  const [partnersMap, setPartnersMap] = useState<Record<string, AgentLite[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>("code");
  const [selected, setSelected] = useState<Panchayath | null>(null);


  useEffect(() => {
    (async () => {
      const [{ data: pData }, { data: aData }, { data: cData }, { data: rData }] = await Promise.all([
        supabase.from("panchayaths").select("id, name, name_ml, district, state, code").eq("is_active", true).order("name"),
        supabase.from("pennyekart_agents").select("id, name, mobile, role, panchayath_id, responsible_panchayath_ids").eq("is_active", true),
        supabase.from("cash_collections").select("panchayath_id"),
        supabase.from("program_registrations").select("answers"),
      ]);
      const map: Record<string, Metrics> = {};
      const ensure = (pid: string) => (map[pid] ||= emptyMetrics());
      const leaders: Record<string, AgentLite[]> = {};
      const partners: Record<string, AgentLite[]> = {};
      (aData || []).forEach((a: any) => {
        if (a.panchayath_id) {
          const m = ensure(a.panchayath_id);
          if (a.role in m) (m as any)[a.role]++;
          m.total++;
        }
        if (a.role === "team_leader" && a.panchayath_id) {
          (leaders[a.panchayath_id] ||= []).push(a);
        }
        if (a.role === "super_admin_partner") {
          const ids = new Set<string>([a.panchayath_id, ...(a.responsible_panchayath_ids || [])].filter(Boolean));
          ids.forEach((pid) => (partners[pid] ||= []).push(a));
        }
      });
      (cData || []).forEach((c: any) => {
        if (c.panchayath_id) ensure(c.panchayath_id).customers++;
      });
      (rData || []).forEach((r: any) => {
        const pid = r?.answers?._fixed?.panchayath_id;
        if (pid) ensure(pid).registrations++;
      });
      const sorted = (pData || []).sort((a: any, b: any) => {
        if (!a.code && !b.code) return 0;
        if (!a.code) return 1;
        if (!b.code) return -1;
        return a.code.localeCompare(b.code);
      });
      setMetricsMap(map);
      setLeadersMap(leaders);
      setPartnersMap(partners);
      setPanchayaths(sorted);
      setLoading(false);
    })();
  }, []);

  const toggleFilter = (k: FilterKey) =>
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const clearAll = () => {
    setActiveFilters(new Set());
    setSortBy("code");
    setSearch("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = panchayaths.filter((p) => {
      if (q) {
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.name_ml?.toLowerCase().includes(q) ||
          p.district?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (activeFilters.size) {
        const m = metricsMap[p.id] || emptyMetrics();
        for (const f of activeFilters) {
          if ((m as any)[f] <= 0) return false;
        }
      }
      return true;
    });
    if (sortBy !== "code") {
      list = [...list].sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        const av = (metricsMap[a.id] as any)?.[sortBy] || 0;
        const bv = (metricsMap[b.id] as any)?.[sortBy] || 0;
        return bv - av;
      });
    }
    return list;
  }, [panchayaths, search, activeFilters, sortBy, metricsMap]);

  const totals = useMemo(() => {
    return Object.values(metricsMap).reduce(
      (acc, c) => {
        acc.coordinator += c.coordinator;
        acc.team_leader += c.team_leader;
        acc.group_leader += c.group_leader;
        acc.pro += c.pro;
        acc.total += c.total;
        acc.customers += c.customers;
        acc.registrations += c.registrations;
        return acc;
      },
      emptyMetrics(),
    );
  }, [metricsMap]);

  const hasActive = activeFilters.size > 0 || sortBy !== "code" || search.trim().length > 0;

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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {[
            { k: "Panchayaths", v: panchayaths.length, c: "bg-emerald-100 text-emerald-800" },
            { k: "Coordinators", v: totals.coordinator, c: "bg-amber-100 text-amber-800" },
            { k: "Team Leaders", v: totals.team_leader, c: "bg-blue-100 text-blue-800" },
            { k: "Group Leaders", v: totals.group_leader, c: "bg-purple-100 text-purple-800" },
            { k: "P.R.Os", v: totals.pro, c: "bg-rose-100 text-rose-800" },
            { k: "Customers", v: totals.customers, c: "bg-cyan-100 text-cyan-800" },
            { k: "Registrations", v: totals.registrations, c: "bg-indigo-100 text-indigo-800" },
          ].map((s) => (
            <div key={s.k} className={`rounded-lg px-3 py-2 ${s.c}`}>
              <div className="text-[10px] uppercase tracking-wide opacity-80">{s.k}</div>
              <div className="text-lg font-bold">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search panchayath, district, code…"
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-4">
          {FILTER_CHIPS.map((c) => {
            const active = activeFilters.has(c.key);
            return (
              <Badge
                key={c.key}
                variant={active ? "default" : "outline"}
                onClick={() => toggleFilter(c.key)}
                className="cursor-pointer select-none"
              >
                {c.label}
              </Badge>
            );
          })}
          {hasActive && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>
              Clear all
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filtered.length} of {panchayaths.length}
          </span>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No panchayaths found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const counts = metricsMap[p.id] || emptyMetrics();
              return (
                <Card
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all border-l-4 border-l-kerala-green"
                >

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
                        const v = counts[r];
                        return (
                          <div key={r} className={`flex items-center justify-between rounded bg-muted/50 px-2 py-1 ${v === 0 ? "opacity-50" : ""}`}>
                            <span className="flex items-center gap-1 capitalize text-muted-foreground">
                              <Icon className="w-3 h-3" /> {label}
                            </span>
                            <span className="font-semibold">{v}</span>
                          </div>
                        );
                      })}
                      <div className={`flex items-center justify-between rounded bg-cyan-50 dark:bg-cyan-950/30 px-2 py-1 ${counts.customers === 0 ? "opacity-50" : ""}`}>
                        <span className="flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                          <ShoppingCart className="w-3 h-3" /> Customers
                        </span>
                        <span className="font-semibold">{counts.customers}</span>
                      </div>
                      <div className={`flex items-center justify-between rounded bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 ${counts.registrations === 0 ? "opacity-50" : ""}`}>
                        <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
                          <FileText className="w-3 h-3" /> Registrations
                        </span>
                        <span className="font-semibold">{counts.registrations}</span>
                      </div>
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
                              <a href={`tel:${a.mobile}`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-mono text-amber-700 dark:text-amber-300 hover:underline">{a.mobile}</a>
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
                              <a href={`tel:${a.mobile}`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-mono text-blue-700 dark:text-blue-300 hover:underline">{a.mobile}</a>
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
      <PanchayathAgentsDialog
        panchayath={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </Layout>

  );
}
