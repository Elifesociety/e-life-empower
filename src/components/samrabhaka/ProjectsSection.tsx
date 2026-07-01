import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Briefcase, User, Users, Users2, Building2, Handshake, PieChart, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

interface AgentProject {
  id: string;
  project_name: string;
  plan_description: string | null;
  model: "individual" | "partnership" | "group";
  entity: "own_company" | "elife_affiliated";
  budget_plan: "own_100" | "80_20" | "50_50" | "20_80" | "samrambhini";
  own_share: number;
  elife_share: number;
  status: string;
  created_at: string;
}

const MODEL_LABELS: Record<string, string> = {
  individual: "Individual",
  partnership: "Partnership",
  group: "Group",
};

const ENTITY_LABELS: Record<string, string> = {
  own_company: "Own Company",
  elife_affiliated: "Affiliated with e-Life",
};

const BUDGET_LABELS: Record<string, string> = {
  own_100: "Own 100% : e-Life 0%",
  "80_20": "Own 80% : e-Life 20%",
  "50_50": "Own 50% : e-Life 50%",
  "20_80": "Own 20% : e-Life 80%",
  samrambhini: "സംരംഭിനി (0 investment)",
};

async function call(token: string, action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/samrabhaka-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "x-samrabhaka-token": token,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function ProjectsSection({ token }: { token: string }) {
  const [projects, setProjects] = useState<AgentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentProject | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    project_name: "",
    plan_description: "",
    model: "individual" as AgentProject["model"],
    entity: "own_company" as AgentProject["entity"],
    budget_plan: "own_100" as AgentProject["budget_plan"],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call(token, "list_projects");
      setProjects(res.projects || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      project_name: "",
      plan_description: "",
      model: "individual",
      entity: "own_company",
      budget_plan: "own_100",
    });
    setDialogOpen(true);
  };

  const openEdit = (p: AgentProject) => {
    setEditing(p);
    setForm({
      project_name: p.project_name,
      plan_description: p.plan_description || "",
      model: p.model,
      entity: p.entity,
      budget_plan: p.budget_plan,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_name.trim()) return toast.error("Project name is required");
    setSaving(true);
    try {
      if (editing) {
        await call(token, "update_project", { id: editing.id, project: form });
        toast.success("Project updated");
      } else {
        await call(token, "create_project", { project: form });
        toast.success("Project created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: AgentProject) => {
    if (!confirm(`Delete project "${p.project_name}"?`)) return;
    try {
      await call(token, "delete_project", { id: p.id });
      toast.success("Project deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-pink-600" />
            My Projects
          </CardTitle>
          <CardDescription>Your entrepreneurship projects</CardDescription>
        </div>
        <Button onClick={openCreate} size="sm" className="bg-pink-600 hover:bg-pink-700 gap-1">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-pink-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No projects yet. Click <span className="font-medium text-pink-600">New Project</span> to add your first entrepreneurship project.
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border p-4 bg-gradient-to-br from-pink-50/50 to-transparent hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base">{p.project_name}</h4>
                    {p.plan_description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{p.plan_description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <Badge variant="secondary">{MODEL_LABELS[p.model]}</Badge>
                      <Badge variant="outline">{ENTITY_LABELS[p.entity]}</Badge>
                      <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-100 border-pink-200">
                        {p.budget_plan === "samrambhini"
                          ? BUDGET_LABELS.samrambhini
                          : `Own ${p.own_share}% : e-Life ${p.elife_share}%`}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>Add details of your new entrepreneurship project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project_name">Project Name *</Label>
              <Input
                id="project_name"
                value={form.project_name}
                onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
                placeholder="e.g. Organic Grocery Store"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_description">Plan Details (Description)</Label>
              <Textarea
                id="plan_description"
                rows={4}
                value={form.plan_description}
                onChange={(e) => setForm((f) => ({ ...f, plan_description: e.target.value }))}
                placeholder="Describe your business plan..."
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "individual", label: "Individual", icon: User },
                  { v: "partnership", label: "Partnership", icon: Handshake },
                  { v: "group", label: "Group", icon: Users2 },
                ].map((o) => (
                  <ChoiceCard
                    key={o.v}
                    active={form.model === o.v}
                    onClick={() => setForm((f) => ({ ...f, model: o.v as typeof form.model }))}
                    icon={<o.icon className="h-5 w-5" />}
                    label={o.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entity</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "own_company", label: "Own Company", icon: Building2 },
                  { v: "elife_affiliated", label: "Affiliated with e-Life", icon: Users },
                ].map((o) => (
                  <ChoiceCard
                    key={o.v}
                    active={form.entity === o.v}
                    onClick={() => setForm((f) => ({ ...f, entity: o.v as typeof form.entity }))}
                    icon={<o.icon className="h-5 w-5" />}
                    label={o.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Budget Plan</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { v: "own_100", label: "Own 100% : e-Life 0%", sub: "Full self-funded" },
                  { v: "80_20", label: "Own 80% : e-Life 20%", sub: "Majority self" },
                  { v: "50_50", label: "Own 50% : e-Life 50%", sub: "Equal partnership" },
                  { v: "20_80", label: "Own 20% : e-Life 80%", sub: "e-Life majority" },
                  { v: "samrambhini", label: "സംരംഭിനി", sub: "Special — 0 investment", special: true },
                ].map((o) => (
                  <ChoiceCard
                    key={o.v}
                    active={form.budget_plan === o.v}
                    onClick={() => setForm((f) => ({ ...f, budget_plan: o.v as typeof form.budget_plan }))}
                    icon={o.special ? <Sparkles className="h-5 w-5" /> : <PieChart className="h-5 w-5" />}
                    label={o.label}
                    sub={o.sub}
                    special={o.special}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-pink-600 hover:bg-pink-700" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  label,
  sub,
  special,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  special?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative text-left rounded-lg border-2 p-3 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400",
        active
          ? "border-pink-600 bg-gradient-to-br from-pink-100 to-pink-50 shadow-sm"
          : "border-border bg-card hover:border-pink-300",
        special && !active && "border-dashed border-pink-300 bg-pink-50/40",
      )}
    >
      {active && (
        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-pink-600 text-white flex items-center justify-center">
          <Check className="h-3 w-3" />
        </span>
      )}
      <div className={cn("flex items-center gap-2", active ? "text-pink-700" : "text-foreground")}>
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </button>
  );
}
