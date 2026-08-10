import { useCallback, useEffect, useState } from "react";
import { Loader2, CircleCheck, Circle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

async function call(action: string, payload: Record<string, unknown>, token: string) {
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

interface Todo {
  id: string;
  title: string;
  is_done: boolean;
  project_id: string;
  project_name: string;
  created_at: string;
}

export function MyTasksSection({ token }: { token: string }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "done">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call("my_todos", {}, token);
      setTodos(res.todos || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (t: Todo) => {
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_done: !x.is_done } : x)));
    try {
      await call("toggle_todo", { id: t.id, is_done: !t.is_done }, token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      load();
    }
  };

  const visible = todos.filter((t) => (filter === "pending" ? !t.is_done : t.is_done));

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
          Pending ({todos.filter((t) => !t.is_done).length})
        </Button>
        <Button size="sm" variant={filter === "done" ? "default" : "outline"} onClick={() => setFilter("done")}>
          Completed ({todos.filter((t) => t.is_done).length})
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {filter === "pending" ? "No pending tasks. Add tasks inside your projects." : "No completed tasks yet."}
        </p>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {visible.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors"
            >
              <button onClick={() => toggle(t)} className="mt-0.5 shrink-0" aria-label="Toggle task">
                {t.is_done ? (
                  <CircleCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0">
                <p className={`text-sm ${t.is_done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3" /> {t.project_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
