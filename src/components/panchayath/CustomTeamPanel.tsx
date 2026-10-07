import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Trash2, Trophy, Users, Star, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PennyekartAgent, ROLE_LABELS } from "@/hooks/usePennyekartAgents";
import { calculateAgentRank } from "@/lib/agentRank";
import { sabpScope } from "@/components/pennyekart/AgentHierarchyTree";

interface Row {
  member_agent_id: string;
  parent_member_agent_id: string | null;
  sort_order: number;
}

interface Props {
  owner: PennyekartAgent;
  allAgents: PennyekartAgent[];
}

const ROOT = "__me__";

async function callApi(body: object) {
  const mobile = (localStorage.getItem("elife_status_mobile") || "").replace(/\D/g, "");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/my-custom-team`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "x-caller-mobile": mobile,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as { rows: Row[] };
}

function customersOf(agent: PennyekartAgent, all: PennyekartAgent[], seen = new Set<string>()): number {
  if (seen.has(agent.id)) return 0;
  seen.add(agent.id);
  if (agent.role === "pro") return agent.customer_count || 0;
  return all.filter((a) => a.parent_agent_id === agent.id).reduce((t, c) => t + customersOf(c, all, seen), 0);
}

export function CustomTeamPanel({ owner, allAgents }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [placeUnder, setPlaceUnder] = useState<string>(ROOT);

  const byId = useMemo(() => new Map(allAgents.map((a) => [a.id, a])), [allAgents]);

  const perf = useMemo(() => {
    const m = new Map<string, { pct: number; full: boolean; customers: number }>();
    for (const a of allAgents) {
      const r = calculateAgentRank(a, allAgents);
      m.set(a.id, { pct: r.percentage, full: r.isFull, customers: customersOf(a, allAgents) });
    }
    return m;
  }, [allAgents]);

  const score = (id: string) => {
    const p = perf.get(id);
    return p ? (p.full ? 1000 : p.pct) * 100000 + p.customers : 0;
  };

  useEffect(() => {
    callApi({ action: "list" })
      .then((d) => setRows(d.rows))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [owner.id]);

  const run = async (body: object, ok?: string) => {
    setBusy(true);
    try {
      const d = await callApi(body);
      setRows(d.rows);
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const memberIds = new Set(rows.map((r) => r.member_agent_id));
  const scope = new Set(sabpScope(owner));

  const candidates = useMemo(() => {
    const q = search.replace(/\s/g, "").toLowerCase();
    if (q.length < 3) return [];
    return allAgents
      .filter((a) => a.id !== owner.id && !memberIds.has(a.id))
      .filter((a) => sabpScope(a).some((id) => scope.has(id)))
      .filter((a) => a.mobile.includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => score(b.id) - score(a.id))
      .slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allAgents, rows, owner.id]);

  const childrenOf = (parent: string | null) =>
    rows.filter((r) => r.parent_member_agent_id === parent).sort((a, b) => a.sort_order - b.sort_order);

  const reorderSiblings = (parent: string | null, ids: string[]) => {
    const all = rows.slice().sort((a, b) => a.sort_order - b.sort_order).map((r) => r.member_agent_id);
    const others = all.filter((id) => !ids.includes(id));
    run({ action: "reorder", ordered_member_ids: [...ids, ...others] });
  };

  const moveSibling = (parent: string | null, id: string, dir: -1 | 1) => {
    const ids = childrenOf(parent).map((r) => r.member_agent_id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderSiblings(parent, ids);
  };

  const sortAllByPerformance = () => {
    const ordered = rows.map((r) => r.member_agent_id).sort((a, b) => score(b) - score(a));
    run({ action: "reorder", ordered_member_ids: ordered }, "Sorted by performance");
  };

  const PerfBadges = ({ id }: { id: string }) => {
    const p = perf.get(id);
    if (!p) return null;
    return (
      <>
        {p.full ? (
          <Badge className="text-[10px] px-1.5 py-0 gap-0.5"><Trophy className="h-3 w-3" />Full</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5"><Star className="h-3 w-3" />{p.pct}%</Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5"><Users className="h-3 w-3" />{p.customers}</Badge>
      </>
    );
  };

  const renderNode = (row: Row, depth: number, siblings: Row[], idx: number): JSX.Element | null => {
    const a = byId.get(row.member_agent_id);
    if (!a) return null;
    const kids = childrenOf(row.member_agent_id);
    return (
      <div key={row.member_agent_id} className={depth ? "ml-4 border-l-2 border-muted pl-2" : ""}>
        <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-muted/50 flex-wrap">
          <span className="font-medium text-sm">{a.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ROLE_LABELS[a.role]}</Badge>
          <PerfBadges id={a.id} />
          <span className="text-[11px] text-muted-foreground">{a.mobile} · {a.panchayath?.name}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy || idx === 0} onClick={() => moveSibling(row.parent_member_agent_id, a.id, -1)} title="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy || idx === siblings.length - 1} onClick={() => moveSibling(row.parent_member_agent_id, a.id, 1)} title="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" disabled={busy} onClick={() => run({ action: "remove", member_agent_id: a.id }, "Removed")} title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {kids.map((k, i) => renderNode(k, depth + 1, kids, i))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const roots = childrenOf(null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm font-medium">Add agent to my team</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search mobile number or name (min 3 characters)"
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 40))}
            />
          </div>
          <Select value={placeUnder} onValueChange={setPlaceUnder}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>Place under: Me ({owner.name})</SelectItem>
              {rows.map((r) => {
                const a = byId.get(r.member_agent_id);
                return a ? <SelectItem key={a.id} value={a.id}>Place under: {a.name}</SelectItem> : null;
              })}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">Only agents working in your allocated panchayaths are listed, best performers first.</p>
        {search.replace(/\s/g, "").length >= 3 && (
          <div className="max-h-56 overflow-y-auto divide-y rounded-md border">
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No matching agents in your panchayaths.</p>
            ) : (
              candidates.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 p-2 flex-wrap">
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ROLE_LABELS[a.role]}</Badge>
                  <PerfBadges id={a.id} />
                  <span className="text-[11px] text-muted-foreground">{a.mobile} · {a.panchayath?.name}</span>
                  <Button
                    size="sm"
                    className="ml-auto h-7 gap-1"
                    disabled={busy}
                    onClick={() =>
                      run(
                        { action: "add", member_agent_id: a.id, parent_member_agent_id: placeUnder === ROOT ? null : placeUnder },
                        `${a.name} added`,
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Select
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{owner.name} · My Performance Team ({rows.length})</p>
        {rows.length > 1 && (
          <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={sortAllByPerformance}>
            <ArrowUpDown className="h-3.5 w-3.5" /> Sort by performance
          </Button>
        )}
      </div>
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No one added yet. Search a mobile number above to start building your team.</p>
      ) : (
        <div className="rounded-lg border p-1">{roots.map((r, i) => renderNode(r, 0, roots, i))}</div>
      )}
    </div>
  );
}
