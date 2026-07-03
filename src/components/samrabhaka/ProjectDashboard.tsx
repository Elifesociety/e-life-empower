import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Plus, Trash2, ArrowLeft, ListChecks, Newspaper, UserPlus, Users2, Crown, X, Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

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

interface Todo { id: string; title: string; is_done: boolean; }
interface Note { id: string; title: string | null; body: string; created_at: string; }
interface Member {
  id: string;
  agent_id: string;
  pennyekart_agents: { id: string; name: string; mobile: string; role: string } | null;
}
interface ProjectFull {
  id: string;
  project_name: string;
  plan_description: string | null;
  model: "individual" | "partnership" | "group";
  entity: string;
  budget_plan: string;
  own_share: number;
  elife_share: number;
}

export function ProjectDashboard({
  token,
  projectId,
  onBack,
}: {
  token: string;
  projectId: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectFull | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const [newTodo, setNewTodo] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ title: "", body: "" });
  const [savingNote, setSavingNote] = useState(false);

  const [memberOpen, setMemberOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call(token, "get_project", { id: projectId });
      setProject(res.project);
      setTodos(res.todos || []);
      setNotes(res.notes || []);
      setMembers(res.members || []);
      setIsOwner(!!res.isOwner);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setAddingTodo(true);
    try {
      const res = await call(token, "add_todo", { project_id: projectId, title: newTodo.trim() });
      setTodos((t) => [...t, res.todo]);
      setNewTodo("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setAddingTodo(false); }
  };

  const toggleTodo = async (todo: Todo) => {
    const prev = todo.is_done;
    setTodos((ts) => ts.map((t) => (t.id === todo.id ? { ...t, is_done: !prev } : t)));
    try {
      await call(token, "toggle_todo", { id: todo.id, is_done: !prev });
    } catch (err) {
      setTodos((ts) => ts.map((t) => (t.id === todo.id ? { ...t, is_done: prev } : t)));
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const deleteTodo = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await call(token, "delete_todo", { id });
      setTodos((ts) => ts.filter((t) => t.id !== id));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.body.trim()) return toast.error("Please write an update");
    setSavingNote(true);
    try {
      const res = await call(token, "add_note", {
        project_id: projectId, title: noteForm.title.trim() || null, body: noteForm.body.trim(),
      });
      setNotes((n) => [res.note, ...n]);
      setNoteOpen(false);
      setNoteForm({ title: "", body: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSavingNote(false); }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this update?")) return;
    try {
      await call(token, "delete_note", { id });
      setNotes((n) => n.filter((x) => x.id !== id));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  if (loading || !project) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  const maxMembers = project.model === "partnership" ? 4 : project.model === "group" ? Infinity : 1;
  const memberCap = project.model === "partnership" ? 3 : Infinity; // additional partners beyond owner
  const canAddMore = isOwner && project.model !== "individual" && members.length < memberCap;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Project header */}
      <div className="rounded-xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 via-white to-pink-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-pink-800">{project.project_name}</h2>
            {project.plan_description && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{project.plan_description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">{project.model}</Badge>
            <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-100 border-pink-200">
              Own {project.own_share}% : e-Life {project.elife_share}%
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="todos"><ListChecks className="h-4 w-4 mr-1" /> Tasks</TabsTrigger>
          <TabsTrigger value="notes"><Newspaper className="h-4 w-4 mr-1" /> Updates</TabsTrigger>
          <TabsTrigger value="members"><Users2 className="h-4 w-4 mr-1" /> Members</TabsTrigger>
        </TabsList>

        {/* Todos */}
        <TabsContent value="todos" className="space-y-3">
          <form onSubmit={addTodo} className="flex gap-2">
            <Input
              placeholder="Add a task..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
            />
            <Button type="submit" disabled={addingTodo} className="bg-pink-600 hover:bg-pink-700 gap-1">
              {addingTodo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </form>
          {todos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks yet.</p>
          ) : (
            <ul className="space-y-2">
              {todos.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Checkbox checked={t.is_done} onCheckedChange={() => toggleTodo(t)} />
                  <span className={cn("flex-1 text-sm", t.is_done && "line-through text-muted-foreground")}>
                    {t.title}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => deleteTodo(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Notes / news */}
        <TabsContent value="notes" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setNoteOpen(true)} size="sm" className="bg-pink-600 hover:bg-pink-700 gap-1">
              <Plus className="h-4 w-4" /> New Update
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No updates yet.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <Card key={n.id} className="border-pink-100">
                  <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
                    <div className="min-w-0">
                      {n.title && <CardTitle className="text-base">{n.title}</CardTitle>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteNote(n.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members */}
        <TabsContent value="members" className="space-y-3">
          {project.model === "individual" ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              This is an <b>Individual</b> project. Partners cannot be added.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  {project.model === "partnership"
                    ? `Partnership · ${members.length + 1} / 4 members`
                    : `Group · ${members.length + 1} members (unlimited)`}
                </div>
                {canAddMore && (
                  <Button onClick={() => setMemberOpen(true)} size="sm" className="bg-pink-600 hover:bg-pink-700 gap-1">
                    <UserPlus className="h-4 w-4" /> Add {project.model === "partnership" ? "Partner" : "Member"}
                  </Button>
                )}
              </div>

              <ul className="space-y-2">
                <li className="flex items-center gap-3 rounded-lg border-2 border-pink-300 bg-pink-50 p-3">
                  <Crown className="h-4 w-4 text-pink-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">You (Owner)</p>
                  </div>
                  <Badge className="bg-pink-600">Owner</Badge>
                </li>
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <div className="h-8 w-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-sm font-semibold">
                      {m.pennyekart_agents?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.pennyekart_agents?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.pennyekart_agents?.mobile} · {formatRole(m.pennyekart_agents?.role || "")}
                      </p>
                    </div>
                    {isOwner && (
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm("Remove this member?")) return;
                        try {
                          await call(token, "remove_member", { id: m.id });
                          setMembers((xs) => xs.filter((x) => x.id !== m.id));
                        } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                      }}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {project.model === "partnership" && members.length >= 3 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Partnership projects are limited to 4 members total.
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* New note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Update</DialogTitle>
            <DialogDescription>Share news or a note about this project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveNote} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="n-title">Title (optional)</Label>
              <Input id="n-title" value={noteForm.title} onChange={(e) => setNoteForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n-body">Update *</Label>
              <Textarea id="n-body" rows={5} value={noteForm.body} onChange={(e) => setNoteForm((f) => ({ ...f, body: e.target.value }))} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-pink-600 hover:bg-pink-700" disabled={savingNote}>
                {savingNote && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Post
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <AddMemberDialog
        open={memberOpen}
        onOpenChange={setMemberOpen}
        token={token}
        projectId={projectId}
        model={project.model}
        existingIds={new Set(members.map((m) => m.agent_id))}
        onAdded={(m) => setMembers((xs) => [...xs, m])}
      />
    </div>
  );
}

function AddMemberDialog({
  open, onOpenChange, token, projectId, model, existingIds, onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: string;
  projectId: string;
  model: "partnership" | "group" | "individual";
  existingIds: Set<string>;
  onAdded: (m: Member) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; mobile: string; role: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setQ(""); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await call(token, "search_registered_agents", { q: q.trim() });
        setResults(res.agents || []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, token]);

  const add = async (agent_id: string) => {
    setAdding(agent_id);
    try {
      const res = await call(token, "add_member", { project_id: projectId, agent_id });
      onAdded(res.member);
      toast.success("Member added");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setAdding(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {model === "partnership" ? "Partner" : "Member"}</DialogTitle>
          <DialogDescription>
            Search registered Samrambhaka users by name or mobile.
            {model === "partnership" && " Partnership is limited to 4 members total."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name or mobile..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {searching && <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {!searching && q.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No registered users found.</p>
            )}
            {results.map((r) => {
              const already = existingIds.has(r.id);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="h-8 w-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-sm font-semibold">
                    {r.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.mobile} · {formatRole(r.role)}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={already || adding === r.id}
                    onClick={() => add(r.id)}
                    className="bg-pink-600 hover:bg-pink-700"
                  >
                    {adding === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : already ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRole(role: string): string {
  return role.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}
