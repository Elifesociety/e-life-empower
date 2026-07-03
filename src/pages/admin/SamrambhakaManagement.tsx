import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Plus, ArrowLeft, ListChecks, Briefcase, PieChart, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AgentProject {
  id: string;
  agent_id: string;
  project_name: string;
  plan_description: string | null;
  model: string;
  entity: string;
  budget_plan: string;
  own_share: number;
  elife_share: number;
  status: string;
  created_at: string;
  agent: { id: string; name: string; mobile: string; role: string; ward: string | null; panchayaths: { name: string } | null } | null;
}

interface BudgetPlan {
  id: string;
  key: string;
  label: string;
  own_share: number;
  elife_share: number;
  is_active: boolean;
  sort_order: number;
}

interface Task {
  id: string;
  title: string;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
}

async function callAdmin(token: string, action: string, payload: Record<string, unknown> = {}) {
  const headers: Record<string, string> = {};
  if (token) headers["x-admin-token"] = token;
  const { data, error } = await supabase.functions.invoke("admin-samrambhaka", {
    body: { action, ...payload },
    headers,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function SamrambhakaManagement() {
  const { isSuperAdmin, adminToken } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  const token = adminToken || "";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/super-admin"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Samrambhaka Management</h1>
            <p className="text-sm text-muted-foreground">Manage agent projects, tasks, and budget-plan presets</p>
          </div>
        </div>

        <Tabs defaultValue="projects">
          <TabsList>
            <TabsTrigger value="projects"><Briefcase className="w-4 h-4 mr-2" />Projects</TabsTrigger>
            <TabsTrigger value="plans"><PieChart className="w-4 h-4 mr-2" />Budget Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <ProjectsAdmin token={token} />
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <BudgetPlansAdmin token={token} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// -------------------- Projects --------------------
function ProjectsAdmin({ token }: { token: string }) {
  const [projects, setProjects] = useState<AgentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [budgetFilter, setBudgetFilter] = useState<string>("all");
  const [editing, setEditing] = useState<AgentProject | null>(null);
  const [tasksProject, setTasksProject] = useState<AgentProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAdmin(token, "list_projects");
      setProjects(res.projects || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => projects.filter((p) => {
    if (modelFilter !== "all" && p.model !== modelFilter) return false;
    if (entityFilter !== "all" && p.entity !== entityFilter) return false;
    if (budgetFilter !== "all" && p.budget_plan !== budgetFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !p.project_name.toLowerCase().includes(s) &&
        !(p.agent?.name || "").toLowerCase().includes(s) &&
        !(p.agent?.mobile || "").includes(s)
      ) return false;
    }
    return true;
  }), [projects, search, modelFilter, entityFilter, budgetFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? All tasks will be removed too.")) return;
    try {
      await callAdmin(token, "delete_project", { id });
      toast.success("Project deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Agent Projects</CardTitle>
        <CardDescription>{filtered.length} of {projects.length} projects</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search project, agent name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger><SelectValue placeholder="Model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="group">Group</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="own_company">Own Company</SelectItem>
              <SelectItem value="elife_affiliated">e-Life Affiliated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={budgetFilter} onValueChange={setBudgetFilter}>
            <SelectTrigger><SelectValue placeholder="Budget" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All budgets</SelectItem>
              <SelectItem value="own_100">Own 100%</SelectItem>
              <SelectItem value="80_20">80 : 20</SelectItem>
              <SelectItem value="50_50">50 : 50</SelectItem>
              <SelectItem value="20_80">20 : 80</SelectItem>
              <SelectItem value="samrambhini">സംരംഭിനി</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Share</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.project_name}</div>
                      {p.plan_description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{p.plan_description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{p.agent?.name || <span className="text-muted-foreground italic">Unknown</span>}</div>
                      <div className="text-xs text-muted-foreground">{p.agent?.mobile} · {p.agent?.role}</div>
                      {p.agent?.panchayaths?.name && (
                        <div className="text-xs text-muted-foreground">{p.agent.panchayaths.name}{p.agent.ward ? ` · W${p.agent.ward}` : ""}</div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.model}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{p.entity === "own_company" ? "Own" : "e-Life"}</Badge></TableCell>
                    <TableCell><Badge>{p.budget_plan}</Badge></TableCell>
                    <TableCell className="text-xs">{p.own_share}% / {p.elife_share}%</TableCell>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setTasksProject(p)} title="View tasks"><ListChecks className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No projects</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {editing && <EditProjectDialog token={token} project={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {tasksProject && <TasksDialog token={token} project={tasksProject} onClose={() => setTasksProject(null)} />}
    </Card>
  );
}

function EditProjectDialog({ token, project, onClose, onSaved }: { token: string; project: AgentProject; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    project_name: project.project_name,
    plan_description: project.plan_description || "",
    model: project.model,
    entity: project.entity,
    budget_plan: project.budget_plan,
    own_share: project.own_share,
    elife_share: project.elife_share,
    status: project.status,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await callAdmin(token, "update_project", { id: project.id, patch: form });
      toast.success("Project updated");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Project Name</Label><Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.plan_description} onChange={(e) => setForm({ ...form, plan_description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Model</Label>
              <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity</Label>
              <Select value={form.entity} onValueChange={(v) => setForm({ ...form, entity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own_company">Own Company</SelectItem>
                  <SelectItem value="elife_affiliated">e-Life Affiliated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Own Share %</Label><Input type="number" value={form.own_share} onChange={(e) => setForm({ ...form, own_share: Number(e.target.value) })} /></div>
            <div><Label>e-Life Share %</Label><Input type="number" value={form.elife_share} onChange={(e) => setForm({ ...form, elife_share: Number(e.target.value) })} /></div>
            <div><Label>Status</Label><Input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TasksDialog({ token, project, onClose }: { token: string; project: AgentProject; onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await callAdmin(token, "list_tasks", { project_id: project.id });
        setTasks(res.tasks || []);
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [token, project.id]);

  const done = tasks.filter((t) => t.is_done).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{project.project_name} — Tasks</DialogTitle>
          <p className="text-xs text-muted-foreground">{done} done · {tasks.length - done} pending · {tasks.length} total</p>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2 p-2 rounded border">
                {t.is_done ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground mt-0.5" />}
                <div className="flex-1">
                  <div className={t.is_done ? "line-through text-muted-foreground" : ""}>{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.is_done && t.done_at ? `Done ${new Date(t.done_at).toLocaleDateString()}` : `Added ${new Date(t.created_at).toLocaleDateString()}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Budget Plans --------------------
function BudgetPlansAdmin({ token }: { token: string }) {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetPlan | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAdmin(token, "list_budget_plans");
      setPlans(res.plans || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this budget plan?")) return;
    try {
      await callAdmin(token, "delete_budget_plan", { id });
      toast.success("Deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleActive = async (p: BudgetPlan) => {
    try {
      await callAdmin(token, "update_budget_plan", { id: p.id, plan: { is_active: !p.is_active } });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Budget Plan Presets</CardTitle>
          <CardDescription>Presets shown to agents when creating projects</CardDescription>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-2" />New Plan</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Own %</TableHead>
                  <TableHead>e-Life %</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="w-16">{p.sort_order}</TableCell>
                    <TableCell><code className="text-xs">{p.key}</code></TableCell>
                    <TableCell>{p.label}</TableCell>
                    <TableCell>{p.own_share}%</TableCell>
                    <TableCell>{p.elife_share}%</TableCell>
                    <TableCell><Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {(editing || creating) && (
        <BudgetPlanDialog
          token={token}
          plan={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </Card>
  );
}

function BudgetPlanDialog({ token, plan, onClose, onSaved }: { token: string; plan: BudgetPlan | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    key: plan?.key || "",
    label: plan?.label || "",
    own_share: plan?.own_share ?? 0,
    elife_share: plan?.elife_share ?? 0,
    is_active: plan?.is_active ?? true,
    sort_order: plan?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (plan) {
        await callAdmin(token, "update_budget_plan", { id: plan.id, plan: form });
      } else {
        await callAdmin(token, "create_budget_plan", { plan: form });
      }
      toast.success(plan ? "Updated" : "Created");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? "Edit Budget Plan" : "New Budget Plan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Key {plan && <span className="text-xs text-muted-foreground">(cannot change)</span>}</Label>
            <Input value={form.key} disabled={!!plan} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. 60_40" />
          </div>
          <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Own %</Label><Input type="number" value={form.own_share} onChange={(e) => setForm({ ...form, own_share: Number(e.target.value) })} /></div>
            <div><Label>e-Life %</Label><Input type="number" value={form.elife_share} onChange={(e) => setForm({ ...form, elife_share: Number(e.target.value) })} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.key || !form.label}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
