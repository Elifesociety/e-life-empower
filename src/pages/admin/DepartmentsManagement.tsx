import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Pencil, UserPlus, Loader2, Users, Building2, FileText, Target, ListTodo, Calendar as CalendarIcon } from "lucide-react";

type Department = { id: string; name: string; description: string | null; color: string | null; icon: string | null; is_active: boolean };
type Agent = { id: string; name: string; mobile: string; role: string };
type Member = { id: string; department_id: string; agent_id: string; member_role: string; is_active: boolean };
type Log = { id: string; member_id: string; department_id: string; work_date: string; work_details: string };
type Plan = { id: string; department_id: string; title: string; description: string | null; target_date: string | null; status: string };
type Todo = { id: string; department_id: string; title: string; description: string | null; due_date: string | null; is_completed: boolean };

export default function DepartmentsManagement() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; data?: Partial<Department> }>({ open: false });
  const [memberDialog, setMemberDialog] = useState<{ open: boolean; deptId?: string; memberId?: string; agentId?: string; pin?: string; role?: string }>({ open: false });
  const [filterDept, setFilterDept] = useState<string>("all");

  if (!isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  const load = async () => {
    setLoading(true);
    const [d, m, a, l, p, t] = await Promise.all([
      supabase.from("departments").select("*").order("created_at"),
      supabase.from("department_members").select("id, department_id, agent_id, member_role, is_active, created_at, updated_at"),
      supabase.from("pennyekart_agents").select("id, name, mobile, role").eq("is_active", true).order("name"),
      supabase.from("department_work_logs").select("*").order("work_date", { ascending: false }).limit(500),
      supabase.from("department_plans").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("department_todos").select("*").order("is_completed").order("created_at", { ascending: false }).limit(500),
    ]);
    setDepartments((d.data as Department[]) || []);
    setMembers((m.data as Member[]) || []);
    setAgents((a.data as Agent[]) || []);
    setLogs((l.data as Log[]) || []);
    setPlans((p.data as Plan[]) || []);
    setTodos((t.data as Todo[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveDept = async () => {
    const data = deptDialog.data || {};
    if (!data.name?.trim()) return toast({ title: "Name required", variant: "destructive" });
    const payload = {
      name: data.name.trim(),
      description: data.description || null,
      color: data.color || null,
      icon: data.icon || null,
      is_active: data.is_active ?? true,
    };
    const { error } = data.id
      ? await supabase.from("departments").update(payload).eq("id", data.id)
      : await supabase.from("departments").insert(payload);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: data.id ? "Updated" : "Created" });
    setDeptDialog({ open: false });
    load();
  };

  const deleteDept = async (id: string) => {
    if (!confirm("Delete this department and all its members & logs?")) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    load();
  };

  const saveMember = async () => {
    const { deptId, memberId, agentId, pin, role } = memberDialog;
    if (!deptId || !agentId) return toast({ title: "Select an agent", variant: "destructive" });
    if (!memberId && (!pin || pin.length < 4)) return toast({ title: "PIN must be at least 4 chars", variant: "destructive" });

    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("department-worklog", {
      body: { action: "admin_upsert_member", department_id: deptId, agent_id: agentId, pin: pin || "", member_role: role || "staff" },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || (data as any)?.error) return toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
    toast({ title: "Saved" });
    setMemberDialog({ open: false });
    load();
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remove this member?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("department-worklog", {
      body: { action: "admin_remove_member", id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || (data as any)?.error) return toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
    load();
  };

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-4">
          <Button asChild variant="ghost" size="sm"><Link to="/super-admin"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Building2 className="h-5 w-5" /> Departments</h1>
        </div>

        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="manage"><Building2 className="h-3.5 w-3.5 mr-1" /> Manage</TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-3.5 w-3.5 mr-1" /> Logs</TabsTrigger>
            <TabsTrigger value="plans"><Target className="h-3.5 w-3.5 mr-1" /> Plans</TabsTrigger>
            <TabsTrigger value="todos"><ListTodo className="h-3.5 w-3.5 mr-1" /> Todos</TabsTrigger>
          </TabsList>

          <TabsContent value="manage">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setDeptDialog({ open: true, data: { is_active: true } })}>
                <Plus className="h-4 w-4 mr-1" /> New Department
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : departments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No departments yet</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {departments.map((d) => {
                  const deptMembers = members.filter((m) => m.department_id === d.id);
                  return (
                    <Card key={d.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {d.name}
                              {!d.is_active && <Badge variant="secondary">Inactive</Badge>}
                            </CardTitle>
                            {d.description && <CardDescription className="text-xs">{d.description}</CardDescription>}
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setDeptDialog({ open: true, data: d })}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteDept(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Members ({deptMembers.length})</span>
                          <Button size="sm" variant="outline" onClick={() => setMemberDialog({ open: true, deptId: d.id, role: "staff" })}>
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                          </Button>
                        </div>
                        {deptMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No members</p>
                        ) : (
                          <div className="space-y-1.5">
                            {deptMembers.map((m) => {
                              const a = agentMap.get(m.agent_id);
                              return (
                                <div key={m.id} className="flex items-center justify-between p-2 rounded border text-sm">
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{a?.name || "Unknown"} <span className="text-xs text-muted-foreground">({a?.mobile})</span></p>
                                    <p className="text-xs text-muted-foreground">{a?.role.replace(/_/g, " ")} • {m.member_role}</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMemberDialog({ open: true, deptId: d.id, memberId: m.id, agentId: m.agent_id, role: m.member_role })}><Pencil className="h-3.5 w-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMember(m.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <ActivityList
              type="logs" items={logs} departments={departments} members={members} agentMap={agentMap}
              filterDept={filterDept} setFilterDept={setFilterDept}
              onDelete={async (id) => { if (!confirm("Delete this log?")) return; const { error } = await supabase.from("department_work_logs").delete().eq("id", id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else load(); }}
            />
          </TabsContent>

          <TabsContent value="plans">
            <ActivityList
              type="plans" items={plans} departments={departments} members={members} agentMap={agentMap}
              filterDept={filterDept} setFilterDept={setFilterDept}
              onChangeStatus={async (id, status) => { const { error } = await supabase.from("department_plans").update({ status }).eq("id", id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else { toast({ title: `Status: ${status.replace("_", " ")}` }); load(); } }}
              onDelete={async (id) => { if (!confirm("Delete this plan?")) return; const { error } = await supabase.from("department_plans").delete().eq("id", id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else load(); }}
            />
          </TabsContent>

          <TabsContent value="todos">
            <ActivityList
              type="todos" items={todos} departments={departments} members={members} agentMap={agentMap}
              filterDept={filterDept} setFilterDept={setFilterDept}
              onDelete={async (id) => { if (!confirm("Delete this todo?")) return; const { error } = await supabase.from("department_todos").delete().eq("id", id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else load(); }}
            />
          </TabsContent>
        </Tabs>

        {/* Department Dialog */}
        <Dialog open={deptDialog.open} onOpenChange={(open) => setDeptDialog({ open, data: open ? deptDialog.data : undefined })}>
          <DialogContent>
            <DialogHeader><DialogTitle>{deptDialog.data?.id ? "Edit" : "New"} Department</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={deptDialog.data?.name || ""} onChange={(e) => setDeptDialog({ ...deptDialog, data: { ...deptDialog.data, name: e.target.value } })} /></div>
              <div><Label>Description</Label><Textarea value={deptDialog.data?.description || ""} onChange={(e) => setDeptDialog({ ...deptDialog, data: { ...deptDialog.data, description: e.target.value } })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Color</Label><Input placeholder="#10b981" value={deptDialog.data?.color || ""} onChange={(e) => setDeptDialog({ ...deptDialog, data: { ...deptDialog.data, color: e.target.value } })} /></div>
                <div><Label>Icon</Label><Input placeholder="Building2" value={deptDialog.data?.icon || ""} onChange={(e) => setDeptDialog({ ...deptDialog, data: { ...deptDialog.data, icon: e.target.value } })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="da" checked={deptDialog.data?.is_active ?? true} onChange={(e) => setDeptDialog({ ...deptDialog, data: { ...deptDialog.data, is_active: e.target.checked } })} />
                <Label htmlFor="da">Active</Label>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDeptDialog({ open: false })}>Cancel</Button><Button onClick={saveDept}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Member Dialog */}
        <Dialog open={memberDialog.open} onOpenChange={(open) => setMemberDialog({ open })}>
          <DialogContent>
            <DialogHeader><DialogTitle>{memberDialog.memberId ? "Edit" : "Add"} Member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Agent *</Label>
                <Select value={memberDialog.agentId} onValueChange={(v) => setMemberDialog({ ...memberDialog, agentId: v })} disabled={!!memberDialog.memberId}>
                  <SelectTrigger><SelectValue placeholder="Select agent from hierarchy" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} — {a.mobile} ({a.role.replace(/_/g, " ")})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role in department</Label>
                <Select value={memberDialog.role || "staff"} onValueChange={(v) => setMemberDialog({ ...memberDialog, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{memberDialog.memberId ? "New PIN (leave blank to keep current)" : "PIN *"}</Label>
                <Input type="text" inputMode="numeric" value={memberDialog.pin || ""} onChange={(e) => setMemberDialog({ ...memberDialog, pin: e.target.value })} placeholder="Min 4 characters" />
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setMemberDialog({ open: false })}>Cancel</Button><Button onClick={saveMember}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

const PLAN_STATUSES = ["planning", "in_progress", "completed", "on_hold"] as const;
const STATUS_STYLE: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  on_hold: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
};

function ActivityList({ type, items, departments, members, agentMap, filterDept, setFilterDept, onDelete, onChangeStatus }: {
  type: "logs" | "plans" | "todos";
  items: any[];
  departments: Department[];
  members: Member[];
  agentMap: Map<string, Agent>;
  filterDept: string;
  setFilterDept: (v: string) => void;
  onDelete: (id: string) => void;
  onChangeStatus?: (id: string, status: string) => void;
}) {
  const [filterDate, setFilterDate] = useState<string>("");
  const [showDate, setShowDate] = useState(false);
  const filtered = items.filter((i) => {
    if (filterDept !== "all" && i.department_id !== filterDept) return false;
    if (type === "logs" && filterDate && i.work_date !== filterDate) return false;
    return true;
  });
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const empty = type === "logs" ? "No work logs" : type === "plans" ? "No plans" : "No todos";

  // Fallback palette for departments without a configured color
  const palette = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
  const colorFor = (d?: Department) => d?.color || palette[(deptMap.size && d ? [...deptMap.keys()].indexOf(d.id) : 0) % palette.length];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Label className="text-sm">Department:</Label>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="h-9 flex-1 min-w-[140px] max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {type === "logs" && (
          <>
            <Button size="sm" variant={showDate ? "default" : "outline"} onClick={() => { setShowDate(!showDate); if (showDate) setFilterDate(""); }}>
              <CalendarIcon className="h-3.5 w-3.5 mr-1" /> History
            </Button>
            {showDate && (
              <Input type="date" className="h-9 w-auto" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            )}
            {filterDate && <Button size="sm" variant="ghost" onClick={() => setFilterDate("")}>Clear</Button>}
          </>
        )}
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">{empty}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const d = deptMap.get(item.department_id);
            const color = colorFor(d);
            const member = type === "logs" ? memberMap.get(item.member_id) : null;
            const a = member ? agentMap.get(member.agent_id) : null;
            const cycleStatus = () => {
              if (!onChangeStatus) return;
              const idx = PLAN_STATUSES.indexOf(item.status);
              const next = PLAN_STATUSES[(idx + 1) % PLAN_STATUSES.length];
              onChangeStatus(item.id, next);
            };
            return (
              <Card
                key={item.id}
                className="overflow-hidden border-l-4 shadow-sm transition-colors"
                style={{ borderLeftColor: color, backgroundColor: `${color}10` }}
              >
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className="text-[10px] border" style={{ backgroundColor: `${color}25`, color, borderColor: `${color}55` }}>{d?.name || "—"}</Badge>
                        {type === "logs" && <span className="text-xs text-muted-foreground">{new Date(item.work_date).toLocaleDateString("en-IN")}</span>}
                        {type === "plans" && (
                          <button
                            type="button"
                            onClick={cycleStatus}
                            className={`text-[10px] capitalize rounded border px-2 py-0.5 font-medium hover:opacity-80 transition ${STATUS_STYLE[item.status] || ""}`}
                            title="Click to change status"
                          >
                            {String(item.status).replace("_", " ")}
                          </button>
                        )}
                        {type === "plans" && item.target_date && <span className="text-xs text-muted-foreground">🎯 {new Date(item.target_date).toLocaleDateString("en-IN")}</span>}
                        {type === "todos" && <Badge variant={item.is_completed ? "default" : "secondary"} className="text-[10px]">{item.is_completed ? "Done" : "Pending"}</Badge>}
                        {type === "todos" && item.due_date && <span className="text-xs text-muted-foreground">📅 {new Date(item.due_date).toLocaleDateString("en-IN")}</span>}
                      </div>
                      {type === "logs" ? (
                        <>
                          <p className="text-xs text-muted-foreground mb-1">{a?.name || "Member"}</p>
                          <p className="text-sm whitespace-pre-wrap">{item.work_details}</p>
                        </>
                      ) : (
                        <>
                          <p className={`text-sm font-medium ${type === "todos" && item.is_completed ? "line-through" : ""}`}>{item.title}</p>
                          {item.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">{item.description}</p>}
                        </>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
