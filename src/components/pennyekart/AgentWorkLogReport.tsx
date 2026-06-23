import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Users, CheckCircle2, XCircle, BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_HIERARCHY, ROLE_LABELS, AgentRole } from "@/hooks/usePennyekartAgents";

interface Panchayath {
  id: string;
  name: string;
}

interface WorkLog {
  id: string;
  agent_id: string;
  work_date: string;
  work_details: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  mobile: string;
  role: AgentRole;
  panchayath_id: string;
  ward: string;
  is_active: boolean;
}

interface Props {
  panchayaths: Panchayath[];
}

export function AgentWorkLogReport({ panchayaths }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [panchayathFilter, setPanchayathFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [lastSubmissions, setLastSubmissions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const dateStr = format(date, "yyyy-MM-dd");

  // Fetch agents and work logs
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Fetch all active agents
      const { data: agentsData } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role, panchayath_id, ward, is_active")
        .eq("is_active", true);

      // Fetch work logs for selected date
      const { data: logsData } = await supabase
        .from("agent_work_logs")
        .select("id, agent_id, work_date, work_details, created_at")
        .eq("work_date", dateStr);

      setAgents((agentsData || []).filter((a: any) => a.role !== "scode") as any);
      setWorkLogs(logsData || []);
      setIsLoading(false);
    };
    fetchData();
  }, [dateStr]);

  // Fetch last submission dates for absent agents
  useEffect(() => {
    const fetchLastSubmissions = async () => {
      if (agents.length === 0) return;

      const submittedIds = new Set(workLogs.map(l => l.agent_id));
      const absentIds = agents
        .filter(a => !submittedIds.has(a.id))
        .map(a => a.id);

      if (absentIds.length === 0) {
        setLastSubmissions({});
        return;
      }

      // Get latest work log for each absent agent
      const { data } = await supabase
        .from("agent_work_logs")
        .select("agent_id, work_date")
        .in("agent_id", absentIds)
        .order("work_date", { ascending: false });

      const lastMap: Record<string, string> = {};
      (data || []).forEach(row => {
        if (!lastMap[row.agent_id]) {
          lastMap[row.agent_id] = row.work_date;
        }
      });
      setLastSubmissions(lastMap);
    };
    fetchLastSubmissions();
  }, [agents, workLogs]);

  // Apply filters
  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      if (panchayathFilter !== "all" && a.panchayath_id !== panchayathFilter) return false;
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      return true;
    });
  }, [agents, panchayathFilter, roleFilter]);

  const submittedAgentIds = useMemo(() => new Set(workLogs.map(l => l.agent_id)), [workLogs]);

  const submitted = useMemo(() => {
    return filteredAgents.filter(a => submittedAgentIds.has(a.id));
  }, [filteredAgents, submittedAgentIds]);

  const absent = useMemo(() => {
    return filteredAgents.filter(a => !submittedAgentIds.has(a.id));
  }, [filteredAgents, submittedAgentIds]);

  const submissionRate = filteredAgents.length > 0
    ? Math.round((submitted.length / filteredAgents.length) * 100)
    : 0;

  const getPanchayathName = (id: string) => panchayaths.find(p => p.id === id)?.name || "—";

  const getWorkDetails = (agentId: string) => {
    const log = workLogs.find(l => l.agent_id === agentId);
    return log?.work_details || "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              disabled={(d) => d > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <SearchableSelect
          options={[{ value: "all", label: "All Panchayaths" }, ...panchayaths.map(p => ({ value: p.id, label: p.name }))]}
          value={panchayathFilter}
          onValueChange={setPanchayathFilter}
          placeholder="Panchayath"
          searchPlaceholder="Search..."
          triggerClassName="h-9 w-[180px]"
        />

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLE_HIERARCHY.map(role => (
              <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold mt-1">{filteredAgents.length}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Submitted</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-green-600">{submitted.length}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Absent</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600">{absent.length}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Rate</span>
          </div>
          <div className="text-2xl font-bold mt-1">{submissionRate}%</div>
        </Card>
      </div>

      {/* Tabs: Submitted / Absent */}
      <Tabs defaultValue="absent" className="space-y-3">
        <TabsList>
          <TabsTrigger value="absent" className="gap-1.5">
            <XCircle className="h-4 w-4" />
            Absent ({absent.length})
          </TabsTrigger>
          <TabsTrigger value="submitted" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Submitted ({submitted.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="absent">
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3">
              <CardTitle className="text-sm">Agents who haven't submitted — {format(date, "PPP")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-3">
              {absent.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">All agents submitted! 🎉</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Role</TableHead>
                        <TableHead className="text-xs">Panchayath</TableHead>
                        <TableHead className="text-xs">Ward</TableHead>
                        <TableHead className="text-xs">Mobile</TableHead>
                        <TableHead className="text-xs">Last Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {absent.map((agent, i) => (
                        <TableRow key={agent.id}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{agent.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[agent.role]}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{getPanchayathName(agent.panchayath_id)}</TableCell>
                          <TableCell className="text-xs">{agent.ward}</TableCell>
                          <TableCell className="text-xs">{agent.mobile}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lastSubmissions[agent.id]
                              ? format(new Date(lastSubmissions[agent.id]), "dd MMM yyyy")
                              : "Never"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submitted">
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3">
              <CardTitle className="text-sm">Work logs submitted — {format(date, "PPP")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-3">
              {submitted.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No submissions for this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Role</TableHead>
                        <TableHead className="text-xs">Panchayath</TableHead>
                        <TableHead className="text-xs">Ward</TableHead>
                        <TableHead className="text-xs min-w-[200px]">Work Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submitted.map((agent, i) => (
                        <TableRow key={agent.id}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{agent.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[agent.role]}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{getPanchayathName(agent.panchayath_id)}</TableCell>
                          <TableCell className="text-xs">{agent.ward}</TableCell>
                          <TableCell className="text-xs whitespace-pre-wrap">{getWorkDetails(agent.id)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
