import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Plus,
  Loader2,
  ClipboardList,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  Phone,
  MapPin,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PennyekartAgent, ROLE_LABELS, AgentRole } from "@/hooks/usePennyekartAgents";

const PENNYEKART_DIVISION_ID = "e108eb84-b8a2-452d-b0d4-350d0c90303b";

const ROLE_COLORS: Record<AgentRole, string> = {
  super_admin_partner: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  team_leader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  coordinator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  group_leader: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

interface Panchayath {
  id: string;
  name: string;
}

interface AgentTask {
  id: string;
  title: string;
  description: string | null;
  panchayath_id: string;
  is_active: boolean;
  created_at: string;
  panchayath?: { name: string };
}

interface TaskFeedback {
  id: string;
  task_id: string;
  agent_id: string;
  status: "pending" | "completed" | "not_completed";
  remarks: string | null;
}

export default function AgentTasks() {
  const { isAdmin, isSuperAdmin, adminData, adminToken, isLoading: authLoading } = useAuth();
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedPanchayath, setSelectedPanchayath] = useState<string>("");
  const [agents, setAgents] = useState<PennyekartAgent[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, TaskFeedback>>({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPanchayathIds, setNewPanchayathIds] = useState<string[]>([]);
  const [panchayathSearchOpen, setPanchayathSearchOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<AgentTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [deleteTask, setDeleteTask] = useState<AgentTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load panchayaths
  useEffect(() => {
    supabase
      .from("panchayaths")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setPanchayaths(data || []));
  }, []);

  // Load tasks
  const fetchTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    const { data } = await supabase
      .from("pennyekart_agent_tasks")
      .select("*, panchayath:panchayaths(name)")
      .order("created_at", { ascending: false });
    setTasks((data as any) || []);
    setIsLoadingTasks(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Load agents + feedback when task is selected
  useEffect(() => {
    if (!selectedTask) {
      setAgents([]);
      setFeedbackMap({});
      return;
    }

    const loadData = async () => {
      setIsLoadingAgents(true);

      // Load agents for this panchayath
      const { data: agentData } = await supabase
        .from("pennyekart_agents")
        .select("*, panchayath:panchayaths(name)")
        .or(
          `panchayath_id.eq.${selectedTask.panchayath_id},responsible_panchayath_ids.cs.{${selectedTask.panchayath_id}}`
        )
        .order("role", { ascending: true })
        .order("name", { ascending: true });

      setAgents((agentData as unknown as PennyekartAgent[]) || []);

      // Load feedback for this task
      const { data: fbData } = await supabase
        .from("pennyekart_agent_task_feedback")
        .select("*")
        .eq("task_id", selectedTask.id);

      const map: Record<string, TaskFeedback> = {};
      (fbData || []).forEach((f: any) => {
        map[f.agent_id] = f;
      });
      setFeedbackMap(map);
      setIsLoadingAgents(false);
    };

    loadData();
  }, [selectedTask]);

  // Permission check
  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isPennyekartAdmin =
    adminData?.division_id === PENNYEKART_DIVISION_ID ||
    adminData?.access_all_divisions ||
    adminData?.additional_division_ids?.includes(PENNYEKART_DIVISION_ID);

  if (!isSuperAdmin && !isPennyekartAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  const handleCreateTask = async () => {
    if (!newTitle.trim() || newPanchayathIds.length === 0) {
      toast.error("Title and at least one Panchayath are required");
      return;
    }
    setIsCreating(true);
    const rows = newPanchayathIds.map((pid) => ({
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      panchayath_id: pid,
    }));
    const { data, error } = await supabase.functions.invoke("pennyekart-agents", {
      body: { action: "create_task", tasks: rows },
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    setIsCreating(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to create task");
      return;
    }
    toast.success(`Task created for ${newPanchayathIds.length} panchayath(s)`);
    setCreateDialogOpen(false);
    setNewTitle("");
    setNewDescription("");
    setNewPanchayathIds([]);
    fetchTasks();
  };

  const handleEditTask = async () => {
    if (!editTask || !editTitle.trim()) return;
    setIsEditing(true);
    const { data, error } = await supabase.functions.invoke("pennyekart-agents", {
      body: { action: "update_task", id: editTask.id, title: editTitle.trim(), description: editDescription.trim() || null },
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    setIsEditing(false);
    if (error || data?.error) {
      toast.error("Failed to update task");
      return;
    }
    toast.success("Task updated");
    setEditDialogOpen(false);
    setEditTask(null);
    if (selectedTask?.id === editTask.id) {
      setSelectedTask({ ...selectedTask, title: editTitle.trim(), description: editDescription.trim() || null });
    }
    fetchTasks();
  };

  const handleDeleteTask = async () => {
    if (!deleteTask) return;
    setIsDeleting(true);
    const { data, error } = await supabase.functions.invoke("pennyekart-agents", {
      body: { action: "delete_task", id: deleteTask.id },
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    setIsDeleting(false);
    if (error || data?.error) {
      toast.error("Failed to delete task");
      return;
    }
    toast.success("Task deleted");
    if (selectedTask?.id === deleteTask.id) setSelectedTask(null);
    setDeleteTask(null);
    fetchTasks();
  };

  const handleFeedback = async (
    agentId: string,
    status: "completed" | "not_completed",
    remarks?: string
  ) => {
    if (!selectedTask) return;

    const existing = feedbackMap[agentId];
    const { data, error } = await supabase.functions.invoke("pennyekart-agents", {
      body: {
        action: "save_feedback",
        task_id: selectedTask.id,
        agent_id: agentId,
        status,
        remarks: remarks || null,
        existing_id: existing?.id || null,
      },
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    if (error || data?.error) {
      toast.error("Failed to save feedback");
      return;
    }

    // Refresh feedback
    const { data: fbData } = await supabase
      .from("pennyekart_agent_task_feedback")
      .select("*")
      .eq("task_id", selectedTask.id);
    const map: Record<string, TaskFeedback> = {};
    (fbData || []).forEach((f: any) => {
      map[f.agent_id] = f;
    });
    setFeedbackMap(map);
    toast.success("Feedback saved");
  };

  // Stats for selected task
  const totalAgentsCount = agents.length;
  const completedCount = Object.values(feedbackMap).filter(
    (f) => f.status === "completed"
  ).length;
  const notCompletedCount = Object.values(feedbackMap).filter(
    (f) => f.status === "not_completed"
  ).length;
  const pendingCount = totalAgentsCount - completedCount - notCompletedCount;

  // Build hierarchy
  const agentIds = new Set(agents.map((a) => a.id));
  const rootAgents = agents.filter(
    (a) => !a.parent_agent_id || !agentIds.has(a.parent_agent_id)
  );

  const filteredRootAgents = showPendingOnly
    ? filterPendingTree(rootAgents, agents, feedbackMap)
    : rootAgents;

  return (
    <Layout>
      <div className="container py-4 sm:py-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link to="/admin/pennyekart-agents">
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold truncate">Agent Tasks</h1>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm ml-9 sm:ml-11">
              Assign tasks & track completion
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Task List */}
          <Card className="lg:col-span-1">
            <CardHeader className="px-3 sm:px-6 py-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {isLoadingTasks ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tasks yet. Create one!
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // Group tasks by title+description
                    const groups: { key: string; title: string; description: string | null; tasks: AgentTask[] }[] = [];
                    const groupMap = new Map<string, number>();
                    tasks.forEach((task) => {
                      const gKey = `${task.title}|||${task.description || ""}`;
                      if (groupMap.has(gKey)) {
                        groups[groupMap.get(gKey)!].tasks.push(task);
                      } else {
                        groupMap.set(gKey, groups.length);
                        groups.push({ key: gKey, title: task.title, description: task.description, tasks: [task] });
                      }
                    });

                    return groups.map((group) => {
                      const isExpanded = expandedGroup === group.key;
                      const isMulti = group.tasks.length > 1;
                      const hasSelectedInGroup = group.tasks.some((t) => selectedTask?.id === t.id);

                      return (
                        <div key={group.key} className="border rounded-lg overflow-hidden">
                          {/* Group header */}
                          <div
                            className={cn(
                              "p-3 cursor-pointer transition-colors",
                              hasSelectedInGroup ? "bg-primary/10" : "hover:bg-muted/50"
                            )}
                            onClick={() => {
                              if (isMulti) {
                                setExpandedGroup(isExpanded ? null : group.key);
                              } else {
                                setSelectedTask(group.tasks[0]);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {isMulti && (
                                  isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                )}
                                <div className="font-medium text-sm truncate">{group.title}</div>
                              </div>
                              {!isMulti && (isSuperAdmin || isPennyekartAdmin) && (
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                    onClick={(e) => { e.stopPropagation(); setEditTask(group.tasks[0]); setEditTitle(group.tasks[0].title); setEditDescription(group.tasks[0].description || ""); setEditDialogOpen(true); }} title="Edit task">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); setDeleteTask(group.tasks[0]); }} title="Delete task">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {group.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-5">{group.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap ml-5">
                              {isMulti && !isExpanded ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {group.tasks.length} panchayaths
                                </Badge>
                              ) : !isMulti ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {group.tasks[0].panchayath?.name || "Unknown"}
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          {/* Expanded panchayath list */}
                          {isMulti && isExpanded && (
                            <div className="border-t divide-y">
                              {group.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className={cn(
                                    "px-3 py-2 pl-8 cursor-pointer transition-colors flex items-center justify-between gap-1",
                                    selectedTask?.id === task.id ? "bg-primary/10" : "hover:bg-muted/30"
                                  )}
                                  onClick={() => setSelectedTask(task)}
                                >
                                  <Badge variant={selectedTask?.id === task.id ? "default" : "secondary"} className="text-[10px]">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    {task.panchayath?.name || "Unknown"}
                                  </Badge>
                                  {(isSuperAdmin || isPennyekartAdmin) && (
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setDeleteTask(task); }} title="Delete">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hierarchy with Feedback */}
          <Card className="lg:col-span-2">
            <CardHeader className="px-3 sm:px-6 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {selectedTask ? selectedTask.title : "Select a task"}
                </CardTitle>
                {selectedTask && (
                  <Button
                    variant={showPendingOnly ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setShowPendingOnly(!showPendingOnly)}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Pending ({pendingCount})
                  </Button>
                )}
              </div>
              {selectedTask && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Users className="h-3 w-3" /> Total: {totalAgentsCount}
                  </Badge>
                  <Badge className="text-xs gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3" /> Done: {completedCount}
                  </Badge>
                  <Badge className="text-xs gap-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    <XCircle className="h-3 w-3" /> Not Done: {notCompletedCount}
                  </Badge>
                  <Badge className="text-xs gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    <Clock className="h-3 w-3" /> Pending: {pendingCount}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {!selectedTask ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select a task to view agents & feedback</p>
                </div>
              ) : isLoadingAgents ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No agents found for this panchayath
                </div>
              ) : (
                <div className="space-y-1">
                  {showPendingOnly ? (
                    // Flat list of only pending agents
                    agents
                      .filter((a) => !feedbackMap[a.id])
                      .map((agent) => (
                        <div key={agent.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border-b border-muted/30">
                          <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-xs sm:text-sm truncate">{agent.name}</span>
                              <Badge className={cn("text-[10px] px-1.5 py-0", ROLE_COLORS[agent.role])}>
                                {ROLE_LABELS[agent.role]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{agent.mobile}</span>
                              {agent.ward !== "N/A" && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />W{agent.ward}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleFeedback(agent.id, "completed")}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] font-medium border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1" onClick={() => handleFeedback(agent.id, "not_completed")}>
                              <XCircle className="h-3 w-3" />
                              Remark
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    filteredRootAgents.map((agent) => (
                      <TaskAgentNode
                        key={agent.id}
                        agent={agent}
                        allAgents={agents}
                        feedbackMap={feedbackMap}
                        onFeedback={handleFeedback}
                        showPendingOnly={showPendingOnly}
                      />
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Task description (optional)"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Panchayaths *</label>
              <Popover open={panchayathSearchOpen} onOpenChange={setPanchayathSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full mt-1 justify-between font-normal h-auto min-h-10"
                  >
                    <span className="flex flex-wrap gap-1 text-left">
                      {newPanchayathIds.length === 0 ? (
                        <span className="text-muted-foreground">Select panchayaths...</span>
                      ) : (
                        newPanchayathIds.map((pid) => {
                          const p = panchayaths.find((x) => x.id === pid);
                          return (
                            <Badge key={pid} variant="secondary" className="text-xs">
                              {p?.name || pid}
                            </Badge>
                          );
                        })
                      )}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search panchayath..." />
                    <CommandList>
                      <CommandEmpty>No panchayath found.</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-y-auto">
                        {panchayaths.map((p) => {
                          const isSelected = newPanchayathIds.includes(p.id);
                          return (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setNewPanchayathIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== p.id)
                                    : [...prev, p.id]
                                );
                              }}
                            >
                              <Checkbox checked={isSelected} className="mr-2" />
                              {p.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {newPanchayathIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {newPanchayathIds.length} selected
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Task description (optional)"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTask} disabled={isEditing || !editTitle.trim()}>
              {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deleteTask} onOpenChange={(open) => !open && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTask?.title}" and all its feedback. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

// --- Hierarchy node with feedback controls ---

interface TaskAgentNodeProps {
  agent: PennyekartAgent;
  allAgents: PennyekartAgent[];
  feedbackMap: Record<string, TaskFeedback>;
  onFeedback: (agentId: string, status: "completed" | "not_completed", remarks?: string) => void;
  showPendingOnly: boolean;
  visitedIds?: Set<string>;
}

function TaskAgentNode({
  agent,
  allAgents,
  feedbackMap,
  onFeedback,
  showPendingOnly,
  visitedIds = new Set(),
}: TaskAgentNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const children = allAgents.filter(
    (a) => a.parent_agent_id === agent.id && a.id !== agent.id && !visitedIds.has(a.id)
  );

  const displayChildren = showPendingOnly
    ? filterPendingTree(children, allAgents, feedbackMap)
    : children;

  const hasChildren = displayChildren.length > 0;
  const feedback = feedbackMap[agent.id];
  const status = feedback?.status || "pending";

  const statusIcon =
    status === "completed" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : status === "not_completed" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <Clock className="h-4 w-4 text-yellow-500" />
    );

  return (
    <div className="ml-2 sm:ml-4">
      <div className="flex items-start sm:items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-md hover:bg-muted/50 transition-colors group">
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0 mt-0.5 sm:mt-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5 sm:mt-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">
              {agent.name}
            </span>
            <Badge className={cn("text-[10px] px-1.5 py-0", ROLE_COLORS[agent.role])}>
              {ROLE_LABELS[agent.role]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5">
              <Phone className="h-2.5 w-2.5" />
              {agent.mobile}
            </span>
            {agent.ward !== "N/A" && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />
                W{agent.ward}
              </span>
            )}
          </div>
          {feedback?.remarks && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              "{feedback.remarks}"
            </p>
          )}
        </div>

        {/* Feedback controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {statusIcon}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onFeedback(agent.id, "completed")}
            title="Mark completed"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] font-medium border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
            onClick={() => {
              setRemarksOpen(!remarksOpen);
            }}
            title="Mark not completed (with remarks)"
          >
            <XCircle className="h-3 w-3" />
            Remark
          </Button>
        </div>
      </div>

      {/* Remarks input */}
      {remarksOpen && (
        <div className="ml-8 sm:ml-12 mb-2 flex gap-2 items-end">
          <Input
            placeholder="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="h-7 text-xs flex-1"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onFeedback(agent.id, "not_completed", remarks);
              setRemarksOpen(false);
              setRemarks("");
            }}
          >
            Save
          </Button>
        </div>
      )}

      {hasChildren && isExpanded && (
        <div className="border-l-2 border-muted ml-1.5 sm:ml-2.5">
          {displayChildren.map((child) => {
            const newVisited = new Set(visitedIds);
            newVisited.add(agent.id);
            return (
              <TaskAgentNode
                key={child.id}
                agent={child}
                allAgents={allAgents}
                feedbackMap={feedbackMap}
                onFeedback={onFeedback}
                showPendingOnly={showPendingOnly}
                visitedIds={newVisited}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filter tree to only show agents that are pending (no feedback) or have pending descendants
function filterPendingTree(
  agents: PennyekartAgent[],
  allAgents: PennyekartAgent[],
  feedbackMap: Record<string, TaskFeedback>
): PennyekartAgent[] {
  return agents.filter((agent) => hasPendingInSubtree(agent, allAgents, feedbackMap, new Set()));
}

function hasPendingInSubtree(
  agent: PennyekartAgent,
  allAgents: PennyekartAgent[],
  feedbackMap: Record<string, TaskFeedback>,
  visited: Set<string>
): boolean {
  if (visited.has(agent.id)) return false;
  visited.add(agent.id);

  const fb = feedbackMap[agent.id];
  if (!fb || fb.status === "pending") return true;

  const children = allAgents.filter(
    (a) => a.parent_agent_id === agent.id && a.id !== agent.id
  );
  return children.some((c) => hasPendingInSubtree(c, allAgents, feedbackMap, visited));
}
