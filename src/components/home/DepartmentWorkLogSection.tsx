import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, LogIn, LogOut, Loader2, FileText } from "lucide-react";

type Dept = { id: string; name: string; description: string | null; color: string | null };
type Member = { id: string; agent_id: string; department_id: string; member_role: string };
type Agent = { id: string; name: string; mobile: string };
type Log = { id: string; member_id: string; department_id: string; work_date: string; work_details: string; created_at: string };

interface Membership { member_id: string; department_id: string; member_role: string; department: Dept }
interface Session { token: string; agent: Agent; memberships: Membership[] }

const SESSION_KEY = "elife_dept_session";

export function DepartmentWorkLogSection() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map());
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string>("all");

  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMobile, setLoginMobile] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [logging, setLogging] = useState(false);

  const [logDialog, setLogDialog] = useState<{ open: boolean; id?: string; memberId?: string; details?: string; date?: string }>({ open: false });

  const loadAll = async () => {
    setLoading(true);
    const [d, m, l] = await Promise.all([
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
      supabase.from("department_members").select("id, agent_id, department_id, member_role").eq("is_active", true),
      supabase.from("department_work_logs").select("*").order("work_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
    ]);
    const depts = (d.data as Dept[]) || [];
    const mem = (m.data as Member[]) || [];
    setDepartments(depts);
    setMembers(mem);
    setLogs((l.data as Log[]) || []);
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

  const saveLog = async () => {
    if (!session) return;
    const details = (logDialog.details || "").trim();
    if (!details) return toast({ title: "Enter work details", variant: "destructive" });
    const action = logDialog.id ? "update_log" : "create_log";
    const { data, error } = await supabase.functions.invoke("department-worklog", {
      body: {
        action,
        token: session.token,
        id: logDialog.id,
        member_id: logDialog.memberId,
        work_details: details,
        work_date: logDialog.date,
      },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    setLogDialog({ open: false });
    loadAll();
  };

  const deleteLog = async (id: string) => {
    if (!session || !confirm("Delete this log?")) return;
    const { data, error } = await supabase.functions.invoke("department-worklog", {
      body: { action: "delete_log", token: session.token, id },
    });
    if (error || (data as any)?.error) return toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
    loadAll();
  };

  const visibleLogs = logs.filter((l) => filterDept === "all" || l.department_id === filterDept);
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="py-12 lg:py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Department Work Logs
          </h2>
          <p className="text-muted-foreground text-sm">
            Daily updates from each department's staff
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {session ? (
              <>
                <Badge variant="secondary" className="text-xs">
                  Logged in: {session.agent.name}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1.5" /> Logout
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
                <LogIn className="h-4 w-4 mr-1.5" /> Member Login
              </Button>
            )}
          </div>
        </div>

        {/* My departments — post log */}
        {session && session.memberships.length > 0 && (
          <Card className="mb-4 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Post a work log</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {session.memberships.map((m) => (
                <Button key={m.member_id} size="sm" onClick={() => setLogDialog({ open: true, memberId: m.member_id, date: today, details: "" })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {m.department.name}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 mb-3">
          <Label className="text-sm">Department:</Label>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="h-9 flex-1 max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : visibleLogs.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No work logs yet
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {visibleLogs.map((log) => {
              const m = memberMap.get(log.member_id);
              const a = m ? agents.get(m.agent_id) : null;
              const d = deptMap.get(log.department_id);
              const canEdit = session && myDeptIds.has(log.department_id);
              return (
                <Card key={log.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]" style={d?.color ? { borderColor: d.color, color: d.color } : undefined}>
                            {d?.name || "Department"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{new Date(log.work_date).toLocaleDateString("en-IN")}</span>
                        </div>
                        <p className="text-sm font-medium mt-1">{a?.name || "Member"}</p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLogDialog({ open: true, id: log.id, memberId: log.member_id, details: log.work_details, date: log.work_date })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLog(log.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{log.work_details}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
            <div>
              <Label>Date</Label>
              <Input type="date" value={logDialog.date || today} onChange={(e) => setLogDialog({ ...logDialog, date: e.target.value })} disabled={!!logDialog.id} />
            </div>
            <div>
              <Label>Work details</Label>
              <Textarea rows={5} value={logDialog.details || ""} onChange={(e) => setLogDialog({ ...logDialog, details: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDialog({ open: false })}>Cancel</Button>
            <Button onClick={saveLog}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
