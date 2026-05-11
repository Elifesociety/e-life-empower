import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, LogIn, LogOut, Loader2, FileText, Target, ListTodo, Calendar as CalendarIcon } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  on_hold: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
};
const PALETTE = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type Dept = { id: string; name: string; description: string | null; color: string | null };
type Member = { id: string; agent_id: string; department_id: string; member_role: string };
type Agent = { id: string; name: string; mobile: string };
type Log = { id: string; member_id: string; department_id: string; work_date: string; work_details: string; created_at: string };
type Plan = { id: string; department_id: string; title: string; description: string | null; target_date: string | null; status: string; created_at: string };
type Todo = { id: string; department_id: string; title: string; description: string | null; due_date: string | null; is_completed: boolean; completed_at: string | null; created_at: string };

interface Membership { member_id: string; department_id: string; member_role: string; department: Dept }
interface Session { token: string; agent: Agent; memberships: Membership[] }

const SESSION_KEY = "elife_dept_session";
const PLAN_STATUSES = ["planning", "in_progress", "completed", "on_hold"] as const;

export function DepartmentWorkLogSection() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map());
  const [logs, setLogs] = useState<Log[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [showDate, setShowDate] = useState(false);

  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMobile, setLoginMobile] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [logging, setLogging] = useState(false);

  const [logDialog, setLogDialog] = useState<{ open: boolean; id?: string; memberId?: string; details?: string; date?: string }>({ open: false });
  const [planDialog, setPlanDialog] = useState<{ open: boolean; id?: string; deptId?: string; title?: string; description?: string; target_date?: string; status?: string }>({ open: false });
  const [todoDialog, setTodoDialog] = useState<{ open: boolean; id?: string; deptId?: string; title?: string; description?: string; due_date?: string }>({ open: false });

  const loadAll = async () => {
    setLoading(true);
    const [d, m, l, p, t] = await Promise.all([
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
      supabase.from("department_members").select("id, agent_id, department_id, member_role").eq("is_active", true),
      supabase.from("department_work_logs").select("*").order("work_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      supabase.from("department_plans").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("department_todos").select("*").order("is_completed").order("created_at", { ascending: false }).limit(200),
    ]);
    const depts = (d.data as Dept[]) || [];
    const mem = (m.data as Member[]) || [];
    setDepartments(depts);
    setMembers(mem);
    setLogs((l.data as Log[]) || []);
    setPlans((p.data as Plan[]) || []);
    setTodos((t.data as Todo[]) || []);
    if (mem.length > 0) {
      const ids = [...new Set(mem.map((x) => x.agent_id))];
      const { data: ag } = await supabase.from("pennyekart_agents").select("id, name, mobile").in("id", ids);
      setAgents(new Map((ag || []).map((a: any) => [a.id, a as Agent])));
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleLogin = async () => {
    setLogging(true);
    try {
      const { data, error } = await supabase.functions.invoke("department-worklog", {
        body: { action: "login", mobile: loginMobile.replace(/\D/g, ""), pin: loginPin },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Login failed", description: error?.message || (data as any)?.error, variant: "destructive" });
        return;
      }
      const s = data as Session;
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      setLoginOpen(false);
      setLoginMobile(""); setLoginPin("");
      toast({ title: "Logged in", description: `Welcome ${s.agent.name}` });
    } finally {
      setLogging(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const myDeptIds = new Set(session?.memberships.map((m) => m.department_id) || []);
  const canEditDept = (deptId: string) => !!session && myDeptIds.has(deptId);

  const callFn = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("department-worklog", { body: { ...body, token: session?.token } });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
      return false;
    }
    return true;
  };

  const saveLog = async () => {
    const details = (logDialog.details || "").trim();
    if (!details) return toast({ title: "Enter work details", variant: "destructive" });
    const ok = await callFn({
      action: logDialog.id ? "update_log" : "create_log",
      id: logDialog.id, member_id: logDialog.memberId, work_details: details, work_date: logDialog.date,
    });
    if (ok) { toast({ title: "Saved" }); setLogDialog({ open: false }); loadAll(); }
  };
  const deleteLog = async (id: string) => {
    if (!confirm("Delete this log?")) return;
    if (await callFn({ action: "delete_log", id })) loadAll();
  };

  const savePlan = async () => {
    const title = (planDialog.title || "").trim();
    if (!title) return toast({ title: "Enter title", variant: "destructive" });
    const ok = await callFn({
      action: planDialog.id ? "update_plan" : "create_plan",
      id: planDialog.id, department_id: planDialog.deptId,
      title, description: planDialog.description || null,
      target_date: planDialog.target_date || null, status: planDialog.status || "planning",
    });
    if (ok) { toast({ title: "Saved" }); setPlanDialog({ open: false }); loadAll(); }
  };
  const cyclePlanStatus = async (plan: Plan) => {
    if (!canEditDept(plan.department_id)) return;
    const idx = PLAN_STATUSES.indexOf(plan.status as any);
    const next = PLAN_STATUSES[(idx + 1) % PLAN_STATUSES.length];
    if (await callFn({ action: "update_plan", id: plan.id, status: next })) loadAll();
  };
  const deletePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    if (await callFn({ action: "delete_plan", id })) loadAll();
  };

  const saveTodo = async () => {
    const title = (todoDialog.title || "").trim();
    if (!title) return toast({ title: "Enter title", variant: "destructive" });
    const ok = await callFn({
      action: todoDialog.id ? "update_todo" : "create_todo",
      id: todoDialog.id, department_id: todoDialog.deptId,
      title, description: todoDialog.description || null, due_date: todoDialog.due_date || null,
    });
    if (ok) { toast({ title: "Saved" }); setTodoDialog({ open: false }); loadAll(); }
  };
  const toggleTodo = async (todo: Todo) => {
    if (!canEditDept(todo.department_id)) return;
    if (await callFn({ action: "update_todo", id: todo.id, is_completed: !todo.is_completed })) loadAll();
  };
  const deleteTodo = async (id: string) => {
    if (!confirm("Delete this todo?")) return;
    if (await callFn({ action: "delete_todo", id })) loadAll();
  };

  const filterMatch = (deptId: string) => filterDept === "all" || deptId === filterDept;
  const visibleLogs = logs.filter((l) => filterMatch(l.department_id) && (!filterDate || l.work_date === filterDate));
  const visiblePlans = plans.filter((p) => filterMatch(p.department_id));
  const visibleTodos = todos.filter((t) => filterMatch(t.department_id));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const deptIds = [...deptMap.keys()];
  const today = new Date().toISOString().slice(0, 10);
  const colorFor = (deptId: string) => deptMap.get(deptId)?.color || PALETTE[Math.max(0, deptIds.indexOf(deptId)) % PALETTE.length];

  const DeptBadge = ({ deptId }: { deptId: string }) => {
    const d = deptMap.get(deptId);
    const c = colorFor(deptId);
    return (
      <Badge className="text-[10px] border" style={{ backgroundColor: `${c}25`, color: c, borderColor: `${c}55` }}>
        {d?.name || "Department"}
      </Badge>
    );
  };
  const cardStyle = (deptId: string) => ({ borderLeftColor: colorFor(deptId), backgroundColor: `${colorFor(deptId)}10` });

  return (
    <section className="py-12 lg:py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Departments
          </h2>
          <p className="text-muted-foreground text-sm">Work logs, planning and todos from each department</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {session ? (
              <>
                <Badge variant="secondary" className="text-xs">Logged in: {session.agent.name}</Badge>
                <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-1.5" /> Logout</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}><LogIn className="h-4 w-4 mr-1.5" /> Member Login</Button>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Label className="text-sm">Department:</Label>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="h-9 flex-1 min-w-[140px] max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button size="sm" variant={showDate ? "default" : "outline"} onClick={() => { setShowDate(!showDate); if (showDate) setFilterDate(""); }}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1" /> History
          </Button>
          {showDate && (
            <Input type="date" className="h-9 w-auto" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          )}
          {filterDate && <Button size="sm" variant="ghost" onClick={() => setFilterDate("")}>Clear</Button>}
        </div>

        <Tabs defaultValue="logs">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="logs"><FileText className="h-3.5 w-3.5 mr-1" /> Logs</TabsTrigger>
            <TabsTrigger value="plans"><Target className="h-3.5 w-3.5 mr-1" /> Planning</TabsTrigger>
            <TabsTrigger value="todos"><ListTodo className="h-3.5 w-3.5 mr-1" /> Todos</TabsTrigger>
          </TabsList>

          {/* LOGS */}
          <TabsContent value="logs" className="space-y-3">
            {session && session.memberships.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3"><CardTitle className="text-base">Post a work log</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {session.memberships.map((m) => (
                    <Button key={m.member_id} size="sm" onClick={() => setLogDialog({ open: true, memberId: m.member_id, date: today, details: "" })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {m.department.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : visibleLogs.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />No work logs yet</CardContent></Card>
              ) : visibleLogs.map((log) => {
                const m = memberMap.get(log.member_id);
                const a = m ? agents.get(m.agent_id) : null;
                const canEdit = canEditDept(log.department_id);
                return (
                  <Card key={log.id} className="border-l-4 overflow-hidden" style={cardStyle(log.department_id)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <DeptBadge deptId={log.department_id} />
                            <span className="text-xs text-muted-foreground">{new Date(log.work_date).toLocaleDateString("en-IN")}</span>
                          </div>
                          <p className="text-sm font-medium mt-1">{a?.name || "Member"}</p>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLogDialog({ open: true, id: log.id, memberId: log.member_id, details: log.work_details, date: log.work_date })}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLog(log.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{log.work_details}</p>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* PLANS */}
          <TabsContent value="plans" className="space-y-3">
            {session && session.memberships.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3"><CardTitle className="text-base">Add a plan</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {session.memberships.map((m) => (
                    <Button key={m.member_id} size="sm" onClick={() => setPlanDialog({ open: true, deptId: m.department_id, status: "planning" })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {m.department.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : visiblePlans.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground"><Target className="h-10 w-10 mx-auto mb-2 opacity-40" />No plans yet</CardContent></Card>
              ) : visiblePlans.map((plan) => {
                const canEdit = canEditDept(plan.department_id);
                return (
                  <Card key={plan.id} className="border-l-4 overflow-hidden" style={cardStyle(plan.department_id)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <DeptBadge deptId={plan.department_id} />
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => cyclePlanStatus(plan)}
                              className={`text-[10px] capitalize rounded border px-2 py-0.5 font-medium transition ${canEdit ? "hover:opacity-80 cursor-pointer" : "cursor-default"} ${STATUS_STYLE[plan.status] || ""}`}
                              title={canEdit ? "Click to change status" : ""}
                            >
                              {plan.status.replace("_", " ")}
                            </button>
                            {plan.target_date && <span className="text-xs text-muted-foreground">🎯 {new Date(plan.target_date).toLocaleDateString("en-IN")}</span>}
                          </div>
                          <p className="font-semibold text-sm">{plan.title}</p>
                          {plan.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{plan.description}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPlanDialog({ open: true, id: plan.id, deptId: plan.department_id, title: plan.title, description: plan.description || "", target_date: plan.target_date || "", status: plan.status })}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deletePlan(plan.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* TODOS */}
          <TabsContent value="todos" className="space-y-3">
            {session && session.memberships.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3"><CardTitle className="text-base">Add a todo</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {session.memberships.map((m) => (
                    <Button key={m.member_id} size="sm" onClick={() => setTodoDialog({ open: true, deptId: m.department_id })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {m.department.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : visibleTodos.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground"><ListTodo className="h-10 w-10 mx-auto mb-2 opacity-40" />No todos yet</CardContent></Card>
              ) : visibleTodos.map((todo) => {
                const canEdit = canEditDept(todo.department_id);
                return (
                  <Card key={todo.id} className={`border-l-4 overflow-hidden ${todo.is_completed ? "opacity-60" : ""}`} style={cardStyle(todo.department_id)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox checked={todo.is_completed} disabled={!canEdit} onCheckedChange={() => toggleTodo(todo)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <DeptBadge deptId={todo.department_id} />
                            {todo.due_date && <span className="text-xs text-muted-foreground">📅 {new Date(todo.due_date).toLocaleDateString("en-IN")}</span>}
                          </div>
                          <p className={`text-sm font-medium ${todo.is_completed ? "line-through" : ""}`}>{todo.title}</p>
                          {todo.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{todo.description}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTodoDialog({ open: true, id: todo.id, deptId: todo.department_id, title: todo.title, description: todo.description || "", due_date: todo.due_date || "" })}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTodo(todo.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Login dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Department Member Login</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Mobile number</Label><Input value={loginMobile} onChange={(e) => setLoginMobile(e.target.value)} maxLength={15} /></div>
            <div><Label>PIN</Label><Input type="password" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginOpen(false)}>Cancel</Button>
            <Button onClick={handleLogin} disabled={logging}>{logging && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log dialog */}
      <Dialog open={logDialog.open} onOpenChange={(open) => setLogDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{logDialog.id ? "Edit" : "Add"} Work Log</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={logDialog.date || today} onChange={(e) => setLogDialog({ ...logDialog, date: e.target.value })} disabled={!!logDialog.id} /></div>
            <div><Label>Work details</Label><Textarea rows={5} value={logDialog.details || ""} onChange={(e) => setLogDialog({ ...logDialog, details: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLogDialog({ open: false })}>Cancel</Button><Button onClick={saveLog}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan dialog */}
      <Dialog open={planDialog.open} onOpenChange={(open) => setPlanDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{planDialog.id ? "Edit" : "Add"} Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={planDialog.title || ""} onChange={(e) => setPlanDialog({ ...planDialog, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={planDialog.description || ""} onChange={(e) => setPlanDialog({ ...planDialog, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Target date</Label><Input type="date" value={planDialog.target_date || ""} onChange={(e) => setPlanDialog({ ...planDialog, target_date: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={planDialog.status || "planning"} onValueChange={(v) => setPlanDialog({ ...planDialog, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPlanDialog({ open: false })}>Cancel</Button><Button onClick={savePlan}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Todo dialog */}
      <Dialog open={todoDialog.open} onOpenChange={(open) => setTodoDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{todoDialog.id ? "Edit" : "Add"} Todo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={todoDialog.title || ""} onChange={(e) => setTodoDialog({ ...todoDialog, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={todoDialog.description || ""} onChange={(e) => setTodoDialog({ ...todoDialog, description: e.target.value })} /></div>
            <div><Label>Due date</Label><Input type="date" value={todoDialog.due_date || ""} onChange={(e) => setTodoDialog({ ...todoDialog, due_date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTodoDialog({ open: false })}>Cancel</Button><Button onClick={saveTodo}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
