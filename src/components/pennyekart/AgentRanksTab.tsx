import { useMemo, useState } from "react";
import { PennyekartAgent, ROLE_LABELS, AgentRole } from "@/hooks/usePennyekartAgents";
import { calculateAgentRank, getAgentRankBreakdown, AgentRankInfo, AgentRankBreakdown } from "@/lib/agentRank";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { Trophy, AlertTriangle, Search, Phone, ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Panchayath {
  id: string;
  name: string;
}

interface AgentRanksTabProps {
  agents: PennyekartAgent[];
  allAgents: PennyekartAgent[];
  panchayaths: Panchayath[];
  onSelectAgent: (agent: PennyekartAgent) => void;
}

type RankFilter = "all" | "full" | "incomplete";

function RankBreakdownPanel({ breakdown, onSelectAgent }: { breakdown: AgentRankBreakdown; onSelectAgent: (a: PennyekartAgent) => void }) {
  if (breakdown.details.length === 0 && breakdown.rankInfo.required > 0) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground bg-muted/30">
        No {breakdown.requiredRole}s found in this agent's team yet.
      </div>
    );
  }

  if (breakdown.details.length === 0) return null;

  const fullCount = breakdown.details.filter(d => d.rank.isFull).length;
  const pendingCount = breakdown.details.length - fullCount;

  return (
    <div className="px-3 py-2 bg-muted/30 border-t">
      <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
        <span className="font-medium">{breakdown.requiredRole}s Breakdown:</span>
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> {fullCount} full
        </span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <XCircle className="h-3 w-3" /> {pendingCount} pending
          </span>
        )}
        <span>Need {breakdown.rankInfo.required} full</span>
      </div>
      <div className="grid gap-1.5">
        {breakdown.details.map(({ agent, rank }) => (
          <div
            key={agent.id}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background hover:bg-accent/50 cursor-pointer transition-colors text-xs"
            onClick={(e) => { e.stopPropagation(); onSelectAgent(agent); }}
          >
            {rank.isFull ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
            <span className="font-medium truncate min-w-0 flex-1">{agent.name}</span>
            <span className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-2.5 w-2.5" />{agent.mobile}
            </span>
            <span className="text-muted-foreground">{rank.label}</span>
            <Progress
              value={rank.percentage}
              className={cn("h-1.5 w-16", rank.isFull ? "[&>div]:bg-emerald-500" : rank.percentage < 50 ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500")}
            />
            <span className="w-7 text-right text-[10px]">{rank.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentRanksTab({ agents, allAgents, panchayaths, onSelectAgent }: AgentRanksTabProps) {
  const [roleFilter, setRoleFilter] = useState<AgentRole | "all">("all");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [panchayathFilter, setPanchayathFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rankedAgents = useMemo(() => {
    return agents
      .map(agent => ({
        agent,
        rank: calculateAgentRank(agent, allAgents),
      }))
      .sort((a, b) => a.rank.percentage - b.rank.percentage);
  }, [agents, allAgents]);

  const filtered = useMemo(() => {
    return rankedAgents.filter(({ agent, rank }) => {
      if (roleFilter !== "all" && agent.role !== roleFilter) return false;
      if (rankFilter === "full" && !rank.isFull) return false;
      if (rankFilter === "incomplete" && rank.isFull) return false;
      if (panchayathFilter !== "all" && agent.panchayath_id !== panchayathFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!agent.name.toLowerCase().includes(q) && !agent.mobile.includes(q)) return false;
      }
      return true;
    });
  }, [rankedAgents, roleFilter, rankFilter, panchayathFilter, search]);

  const summary = useMemo(() => {
    const roles: AgentRole[] = ["pro", "group_leader", "coordinator", "team_leader"];
    return roles.map(role => {
      const roleAgents = rankedAgents.filter(r => r.agent.role === role);
      const full = roleAgents.filter(r => r.rank.isFull).length;
      return { role, total: roleAgents.length, full, incomplete: roleAgents.length - full };
    });
  }, [rankedAgents]);

  const expandedBreakdown = useMemo(() => {
    if (!expandedId) return null;
    const item = filtered.find(f => f.agent.id === expandedId);
    if (!item) return null;
    return getAgentRankBreakdown(item.agent, allAgents);
  }, [expandedId, filtered, allAgents]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {summary.map(({ role, total, full, incomplete }) => (
          <Card key={role} className="p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">{ROLE_LABELS[role]}s</div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold">{full}/{total}</span>
              <span className="text-[10px] text-muted-foreground">full rank</span>
            </div>
            {total > 0 && (
              <Progress value={(full / total) * 100} className="h-1.5 mt-1.5" />
            )}
            {incomplete > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] text-amber-600 dark:text-amber-400">{incomplete} incomplete</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search agent..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AgentRole | "all")}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {(["pro", "group_leader", "coordinator", "team_leader"] as AgentRole[]).map(r => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchableSelect
          options={[{ value: "all", label: "All Panchayaths" }, ...panchayaths.map(p => ({ value: p.id, label: p.name }))]}
          value={panchayathFilter}
          onValueChange={v => setPanchayathFilter(v || "all")}
          placeholder="Panchayath"
          searchPlaceholder="Search panchayath..."
          triggerClassName="w-[160px] h-9"
        />
        <Select value={rankFilter} onValueChange={(v) => setRankFilter(v as RankFilter)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Rank" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ranks</SelectItem>
            <SelectItem value="full">Full Rank ✅</SelectItem>
            <SelectItem value="incomplete">Incomplete ⚠️</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rankedAgents.length} agents
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[30px]"></TableHead>
                <TableHead className="text-xs w-[30px]">#</TableHead>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Role</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Panchayath</TableHead>
                <TableHead className="text-xs">Rank</TableHead>
                <TableHead className="text-xs w-[100px]">Progress</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(({ agent, rank }, i) => {
                  const isExpanded = expandedId === agent.id;
                  const canExpand = agent.role !== "pro";
                  return (
                    <TableRow key={agent.id} className="group">
                      <TableCell colSpan={8} className="p-0">
                        <div
                          className={cn("flex items-center cursor-pointer hover:bg-muted/50 transition-colors", isExpanded && "bg-muted/30")}
                          onClick={() => {
                            if (canExpand) {
                              setExpandedId(isExpanded ? null : agent.id);
                            } else {
                              onSelectAgent(agent);
                            }
                          }}
                        >
                          {/* Expand icon */}
                          <div className="w-[40px] flex justify-center shrink-0">
                            {canExpand ? (
                              isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : <span className="w-3.5" />}
                          </div>
                          {/* # */}
                          <div className="w-[30px] shrink-0 text-xs text-muted-foreground py-2">{i + 1}</div>
                          {/* Agent */}
                          <div className="flex-1 min-w-0 py-2 pr-2">
                            <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{agent.name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Phone className="h-2.5 w-2.5" />{agent.mobile}
                            </div>
                          </div>
                          {/* Role - hidden on mobile */}
                          <div className="hidden sm:block w-[100px] shrink-0 py-2">
                            <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[agent.role]}</Badge>
                          </div>
                          {/* Panchayath - hidden on mobile */}
                          <div className="hidden sm:block w-[120px] shrink-0 py-2 text-xs text-muted-foreground truncate">
                            {agent.panchayath?.name || "–"}
                          </div>
                          {/* Rank */}
                          <div className="w-[120px] sm:w-[150px] shrink-0 py-2 text-xs">{rank.label}</div>
                          {/* Progress */}
                          <div className="w-[100px] shrink-0 py-2">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={rank.percentage}
                                className={cn("h-2 flex-1", rank.isFull ? "[&>div]:bg-emerald-500" : rank.percentage < 50 ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500")}
                              />
                              <span className="text-[10px] w-8 text-right">{rank.percentage}%</span>
                            </div>
                          </div>
                          {/* Status */}
                          <div className="w-[70px] shrink-0 py-2">
                            {rank.isFull ? (
                              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 gap-0.5">
                                <Trophy className="h-2.5 w-2.5" />Full
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-300 gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                        {/* Expandable breakdown */}
                        {isExpanded && expandedBreakdown && (
                          <RankBreakdownPanel breakdown={expandedBreakdown} onSelectAgent={onSelectAgent} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
