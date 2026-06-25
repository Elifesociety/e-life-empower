import { useEffect, useMemo, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  ListTodo,
  Loader2,
  CheckCircle2,
  LogIn,
  Calendar as CalendarIcon,
  Info,
} from "lucide-react";

type Dept = { id: string; name: string; color: string | null };
type Plan = {
  id: string;
  department_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  created_by_member_id: string | null;
  is_public: boolean;
};
type Todo = {
  id: string;
  department_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_by_member_id: string | null;
  is_public: boolean;
};

interface Membership {
  member_id: string;
  department_id: string;
  member_role: string;
  department: { id: string; name: string; color: string | null };
}
interface Session {
  token: string;
  agent: { id: string; name: string; mobile: string };
  memberships: Membership[];
}

const SESSION_KEY = "elife_dept_session";
const PALETTE = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const STATUS_STYLE: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  on_hold: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
};

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function DepartmentPendingSlider() {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  const planAutoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );
  const todoAutoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );

  const deptMap = useMemo(() => {
    const m = new Map<string, Dept>();
    session?.memberships.forEach((mb) => {
      m.set(mb.department_id, {
        id: mb.department_id,
        name: mb.department.name,
        color: mb.department.color ?? null,
      });
    });
    return m;
  }, [session]);

  const deptIds = useMemo(() => Array.from(deptMap.keys()), [deptMap]);
  const myMemberIds = useMemo(
    () => new Set(session?.memberships.map((m) => m.member_id) || []),
    [session],
  );

  const colorFor = (deptId: string) => {
    const d = deptMap.get(deptId);
    if (d?.color) return d.color;
    const idx = deptIds.indexOf(deptId);
    return PALETTE[Math.max(0, idx) % PALETTE.length];
  };

  const load = async () => {
    if (!session || deptIds.length === 0) {
      setPlans([]);
      setTodos([]);
      return;
    }
    setLoading(true);
    const [p, t] = await Promise.all([
      supabase
        .from("department_plans")
        .select("id, department_id, title, description, target_date, status, created_by_member_id, is_public")
        .in("department_id", deptIds)
        .neq("status", "completed")
        .order("target_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("department_todos")
        .select("id, department_id, title, description, due_date, is_completed, created_by_member_id, is_public")
        .in("department_id", deptIds)
        .eq("is_completed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setPlans((p.data as Plan[]) || []);
    setTodos((t.data as Todo[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) setSession(readSession());
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const markTodoDone = async (todo: Todo) => {
    if (!session) return;
    const { data, error } = await supabase.functions.invoke("department-worklog", {
      body: { action: "update_todo", id: todo.id, is_completed: true, token: session.token },
    });
    if (error || (data as any)?.error) {
      toast({
        title: "Failed",
        description: error?.message || (data as any)?.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Marked done" });
    load();
  };

  const DeptBadge = ({ deptId }: { deptId: string }) => {
    const c = colorFor(deptId);
    const name = deptMap.get(deptId)?.name || "Department";
    return (
      <Badge
        className="text-[10px] border"
        style={{ backgroundColor: `${c}25`, color: c, borderColor: `${c}55` }}
      >
        {name}
      </Badge>
    );
  };

  const scrollToLogin = () => {
    const el = document.getElementById("department-login");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Nudge: emit a custom event the section can listen to to open the dialog
      window.dispatchEvent(new CustomEvent("elife:open-dept-login"));
    }
  };

  // Logged-out view
  if (!session) {
    return (
      <section className="py-10 lg:py-14 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card className="border-primary/30">
            <CardContent className="py-8 text-center space-y-3">
              <div className="flex justify-center gap-2 text-primary">
                <Target className="h-6 w-6" />
                <ListTodo className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Department planning & pending todos</h3>
              <p className="text-sm text-muted-foreground">
                Login as a department member to see your pending plans and todos here.
              </p>
              <Button size="sm" onClick={scrollToLogin}>
                <LogIn className="h-4 w-4 mr-1.5" /> Member Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  const renderEmpty = (label: string) => (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );

  return (
    <section className="py-10 lg:py-14 bg-muted/30">
      <div className="container mx-auto px-4 max-w-5xl space-y-8">
        <div className="text-center">
          <h2 className="text-2xl lg:text-3xl font-bold flex items-center justify-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Your Department Updates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pending planning and todos for {session.memberships.map((m) => m.department.name).join(", ")}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Pending Planning */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Pending Planning</h3>
                <Badge variant="secondary" className="text-[10px]">{plans.length}</Badge>
              </div>
              {plans.length === 0 ? (
                renderEmpty("No pending plans")
              ) : (
                <Carousel
                  opts={{ loop: plans.length > 1, align: "start" }}
                  plugins={[planAutoplay.current]}
                  className="w-full"
                >
                  <CarouselContent>
                    {plans.map((plan) => {
                      const c = colorFor(plan.department_id);
                      return (
                        <CarouselItem key={plan.id} className="md:basis-1/2 lg:basis-1/3">
                          <Card
                            className="border-l-4 h-full cursor-pointer hover:shadow-md transition-shadow"
                            style={{ borderLeftColor: c, backgroundColor: `${c}10` }}
                            onClick={() => setSelectedPlan(plan)}
                          >
                            <CardContent className="pt-4 space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <DeptBadge deptId={plan.department_id} />
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${STATUS_STYLE[plan.status] || ""}`}
                                >
                                  {plan.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <h4 className="font-semibold text-sm leading-snug">{plan.title}</h4>
                              {plan.description && (
                                <p className="text-xs text-muted-foreground line-clamp-3">
                                  {plan.description}
                                </p>
                              )}
                              {plan.target_date && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <CalendarIcon className="h-3 w-3" />
                                  Target: {new Date(plan.target_date).toLocaleDateString("en-IN")}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
              )}
            </div>

            {/* Pending Todos */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Pending Todos</h3>
                <Badge variant="secondary" className="text-[10px]">{todos.length}</Badge>
              </div>
              {todos.length === 0 ? (
                renderEmpty("No pending todos — great work!")
              ) : (
                <Carousel
                  opts={{ loop: todos.length > 1, align: "start" }}
                  plugins={[todoAutoplay.current]}
                  className="w-full"
                >
                  <CarouselContent>
                    {todos.map((todo) => {
                      const c = colorFor(todo.department_id);
                      const canComplete =
                        !!todo.created_by_member_id && myMemberIds.has(todo.created_by_member_id);
                      return (
                        <CarouselItem key={todo.id} className="md:basis-1/2 lg:basis-1/3">
                          <Card
                            className="border-l-4 h-full"
                            style={{ borderLeftColor: c, backgroundColor: `${c}10` }}
                          >
                            <CardContent className="pt-4 space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <DeptBadge deptId={todo.department_id} />
                                {todo.due_date && (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    {new Date(todo.due_date).toLocaleDateString("en-IN")}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-sm leading-snug">{todo.title}</h4>
                              {todo.description && (
                                <p className="text-xs text-muted-foreground line-clamp-3">
                                  {todo.description}
                                </p>
                              )}
                              {canComplete && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-xs"
                                  onClick={() => markTodoDone(todo)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark done
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
