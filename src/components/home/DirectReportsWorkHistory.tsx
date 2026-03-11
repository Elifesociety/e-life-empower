import { useState, useEffect, useCallback, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays } from "date-fns";
import { Users, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO",
};

const ROLE_COLORS: Record<string, string> = {
  team_leader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  coordinator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  group_leader: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

// Role hierarchy for determining which subordinates to show
const ROLE_HIERARCHY = ["team_leader", "coordinator", "group_leader", "pro"];

interface SubAgent {
  id: string;
  name: string;
  mobile: string;
  role: string;
  ward: string;
  parent_agent_id: string | null;
  panchayath?: { name: string } | null;
}

interface WorkLogEntry {
  agent_id: string;
  work_date: string;
  work_details: string;
}

interface Props {
  agentId: string;
  agentRole: string;
}

export function DirectReportsWorkHistory({ agentId, agentRole }: Props) {
  const [subordinates, setSubordinates] = useState<SubAgent[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<{ agent: SubAgent; date: string; details: string } | null>(null);

  const roleIndex = ROLE_HIERARCHY.indexOf(agentRole);
  // Only team_leader, coordinator, group_leader can have subordinates
  const canViewReports = roleIndex >= 0 && roleIndex < ROLE_HIERARCHY.length - 1;

  // Recursively fetch all subordinates
  const fetchSubordinates = useCallback(async () => {
    if (!canViewReports) return;
    setIsLoading(true);

    try {
      // Get all agents that are below this agent in hierarchy
      // First get direct children, then their children, etc.
      const allSubs: SubAgent[] = [];
      let parentIds = [agentId];

      while (parentIds.length > 0) {
        const { data } = await supabase
          .from("pennyekart_agents")
          .select("id, name, mobile, role, ward, parent_agent_id, panchayath:panchayaths(name)")
          .in("parent_agent_id", parentIds)
          .eq("is_active", true)
          .order("role")
          .order("name");

        if (!data || data.length === 0) break;
        const agents = data as unknown as SubAgent[];
        allSubs.push(...agents);
        parentIds = agents.map(a => a.id);
      }

      setSubordinates(allSubs);
    } catch (err) {
      console.error("Failed to fetch subordinates:", err);
    }
  }, [agentId, canViewReports]);

  // Fetch work logs for all subordinates for the month
  const fetchWorkLogs = useCallback(async () => {
    if (subordinates.length === 0) {
      setIsLoading(false);
      return;
    }

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    try {
      const { data } = await supabase
        .from("agent_work_logs")
        .select("agent_id, work_date, work_details")
        .in("agent_id", subordinates.map(s => s.id))
        .gte("work_date", start)
        .lte("work_date", end);

      setWorkLogs((data || []) as unknown as WorkLogEntry[]);
    } catch (err) {
      console.error("Failed to fetch work logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [subordinates, currentMonth]);

  useEffect(() => {
    fetchSubordinates();
  }, [fetchSubordinates]);

  useEffect(() => {
    if (subordinates.length > 0) {
      fetchWorkLogs();
    }
  }, [fetchWorkLogs, subordinates]);

  // Build a lookup: agentId -> Set of dates with logs
  const logsLookup = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    workLogs.forEach(log => {
      if (!map.has(log.agent_id)) map.set(log.agent_id, new Map());
      map.get(log.agent_id)!.set(log.work_date, log.work_details);
    });
    return map;
  }, [workLogs]);

  // Get last 7 working days (past days up to today) for summary view
  const today = new Date();
  const last7Days = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(subDays(today, i));
    }
    return days;
  }, []);

  // Stats per agent: total logged days this month
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = today < endOfMonth(currentMonth) ? today : endOfMonth(currentMonth);
    if (start > today) return [];
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  if (!canViewReports) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (subordinates.length === 0) return null;

  // Group subordinates by role
  const groupedByRole = ROLE_HIERARCHY
    .filter(r => ROLE_HIERARCHY.indexOf(r) > roleIndex)
    .map(role => ({
      role,
      agents: subordinates.filter(s => s.role === role),
    }))
    .filter(g => g.agents.length > 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Team Work History
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, "MMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedByRole.map(({ role, agents }) => (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-[10px]", ROLE_COLORS[role])}>
                  {ROLE_LABELS[role] || role}
                </Badge>
                <span className="text-xs text-muted-foreground">({agents.length})</span>
              </div>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap min-w-[120px]">Agent</TableHead>
                      {last7Days.map(day => (
                        <TableHead key={format(day, "yyyy-MM-dd")} className="text-xs text-center px-1 min-w-[40px]">
                          <div>{format(day, "dd")}</div>
                          <div className="text-[9px] text-muted-foreground">{format(day, "EEE")}</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-xs text-center px-2">
                        <div>Month</div>
                        <div className="text-[9px] text-muted-foreground">Score</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map(agent => {
                      const agentLogs = logsLookup.get(agent.id);
                      const monthLogged = agentLogs ? agentLogs.size : 0;
                      const totalDays = monthDays.length;
                      const pct = totalDays > 0 ? Math.round((monthLogged / totalDays) * 100) : 0;

                      return (
                        <TableRow key={agent.id}>
                          <TableCell className="text-xs py-2">
                            <div className="font-medium truncate max-w-[120px]">{agent.name}</div>
                            <div className="text-[10px] text-muted-foreground">{agent.ward !== "N/A" ? `W${agent.ward}` : ""}</div>
                          </TableCell>
                          {last7Days.map(day => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const details = agentLogs?.get(dateStr);
                            const hasLog = !!details;
                            return (
                              <TableCell
                                key={dateStr}
                                className="text-center px-1 py-2 cursor-pointer"
                                onClick={() => {
                                  if (hasLog) {
                                    setSelectedLog({ agent, date: dateStr, details: details! });
                                  }
                                }}
                              >
                                {hasLog ? (
                                  <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 dark:text-green-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 mx-auto text-red-400 dark:text-red-500 opacity-40" />
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center py-2">
                            <span className={cn(
                              "text-xs font-bold",
                              pct >= 80 ? "text-green-600 dark:text-green-400" :
                              pct >= 50 ? "text-yellow-600 dark:text-yellow-400" :
                              "text-red-600 dark:text-red-400"
                            )}>
                              {monthLogged}/{totalDays}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Work log detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Work Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{selectedLog.agent.name}</span>
                <Badge className={cn("text-[10px]", ROLE_COLORS[selectedLog.agent.role])}>
                  {ROLE_LABELS[selectedLog.agent.role]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(selectedLog.date), "EEEE, MMMM d, yyyy")}
              </p>
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="text-sm whitespace-pre-wrap">{selectedLog.details}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
