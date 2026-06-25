import { useEffect, useMemo, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone,
  Wallet,
  IndianRupee,
  ListTodo,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
  RefreshCw,
  EyeOff,
  Eye,
  Sparkles,
} from "lucide-react";

const MOBILE_KEY = "elife_status_mobile";
const IGNORE_KEY = "elife_status_ignored";
const DEPT_SESSION_KEY = "elife_dept_session";

interface Collection {
  id: string;
  person_name: string;
  amount: number;
  status: string;
  receipt_number: string | null;
  created_at: string;
  panchayath_name: string | null;
  division_name?: string | null;
}
interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  remarks: string | null;
  department_name?: string | null;
}
interface AgentInfo {
  id: string;
  name: string;
  role: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  verified: "bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-300",
  submitted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  on_hold: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  cancelled: "bg-gray-500/15 text-gray-700 border-gray-500/40 dark:text-gray-300",
};

function getStoredMobile(): string | null {
  try {
    const explicit = localStorage.getItem(MOBILE_KEY);
    if (explicit) return explicit;
  } catch {}
  return null;
}

function getDeptSessionMobile(): string | null {
  try {
    const raw = localStorage.getItem(DEPT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.agent?.mobile || null;
  } catch {
    return null;
  }
}

export function PaymentStatusSlider() {
  const [mobile, setMobile] = useState<string | null>(() => getStoredMobile());
  const [ignored, setIgnored] = useState<boolean>(() => {
    try {
      return localStorage.getItem(IGNORE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [inputMobile, setInputMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);

  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );

  // Pre-fill input with dept session mobile if available
  useEffect(() => {
    if (!mobile && !ignored && !inputMobile) {
      const dept = getDeptSessionMobile();
      if (dept) setInputMobile(dept);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for dept session changes — auto activate when user logs in
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEPT_SESSION_KEY) {
        if (!mobile && !ignored) {
          const dept = getDeptSessionMobile();
          if (dept) setInputMobile(dept);
        }
      }
      if (e.key === MOBILE_KEY) setMobile(getStoredMobile());
      if (e.key === IGNORE_KEY) setIgnored(localStorage.getItem(IGNORE_KEY) === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mobile, ignored]);

  const load = async (m: string) => {
    setLoading(true);
    try {
      const cleaned = m.replace(/\D/g, "");

      const { data: collData } = await supabase
        .from("cash_collections")
        .select("id, person_name, amount, status, receipt_number, created_at, panchayath_name, division_id")
        .eq("mobile", cleaned)
        .order("created_at", { ascending: false })
        .limit(20);

      let collsWithDiv: Collection[] = [];
      if (collData && collData.length > 0) {
        const divIds = [...new Set(collData.map((c: any) => c.division_id))];
        const { data: divisions } = await supabase
          .from("divisions")
          .select("id, name")
          .in("id", divIds);
        const divMap = new Map(divisions?.map((d: any) => [d.id, d.name]) || []);
        collsWithDiv = collData.map((c: any) => ({
          id: c.id,
          person_name: c.person_name,
          amount: c.amount,
          status: c.status,
          receipt_number: c.receipt_number,
          created_at: c.created_at,
          panchayath_name: c.panchayath_name,
          division_name: divMap.get(c.division_id) || null,
        }));
      }
      setCollections(collsWithDiv);

      const { data: agentData } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role")
        .eq("mobile", cleaned)
        .eq("is_active", true)
        .limit(1);

      let agent: AgentInfo | null = null;
      if (agentData && agentData.length > 0) {
        agent = agentData[0] as AgentInfo;
        setAgentInfo(agent);

        const { data: walletData } = await supabase
          .from("agent_wallet_transactions")
          .select("amount")
          .eq("agent_id", agent.id);
        if (walletData) {
          const bal = walletData.reduce((s: number, t: any) => s + Number(t.amount), 0);
          setWalletBalance(bal);
        } else {
          setWalletBalance(null);
        }

        // Tasks assigned to this agent
        const { data: taskData } = await supabase
          .from("department_tasks")
          .select("id, title, description, due_date, status, remarks, department_id")
          .eq("assigned_agent_id", agent.id)
          .neq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(20);

        if (taskData && taskData.length > 0) {
          const deptIds = [...new Set(taskData.map((t: any) => t.department_id))];
          const { data: depts } = await supabase
            .from("departments")
            .select("id, name")
            .in("id", deptIds);
          const deptMap = new Map(depts?.map((d: any) => [d.id, d.name]) || []);
          setTasks(
            taskData.map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              due_date: t.due_date,
              status: t.status,
              remarks: t.remarks,
              department_name: deptMap.get(t.department_id) || null,
            })),
          );
        } else {
          setTasks([]);
        }
      } else {
        setAgentInfo(null);
        setWalletBalance(null);
        setTasks([]);
      }
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  useEffect(() => {
    if (mobile && !ignored) load(mobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, ignored]);

  const handleActivate = () => {
    const cleaned = inputMobile.replace(/\D/g, "");
    if (cleaned.length < 10) return;
    try {
      localStorage.setItem(MOBILE_KEY, cleaned);
      localStorage.removeItem(IGNORE_KEY);
    } catch {}
    setIgnored(false);
    setMobile(cleaned);
  };

  const handleIgnore = () => {
    try {
      localStorage.setItem(IGNORE_KEY, "1");
    } catch {}
    setIgnored(true);
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(MOBILE_KEY);
      localStorage.removeItem(IGNORE_KEY);
    } catch {}
    setMobile(null);
    setIgnored(false);
    setCollections([]);
    setTasks([]);
    setAgentInfo(null);
    setWalletBalance(null);
    setSearched(false);
    setInputMobile("");
  };

  const totalItems = useMemo(
    () => collections.length + tasks.length + (walletBalance !== null ? 1 : 0),
    [collections, tasks, walletBalance],
  );

  // Ignored — small re-enable bar
  if (ignored) {
    return (
      <section className="py-4 bg-muted/20">
        <div className="container mx-auto px-4 max-w-5xl flex justify-center">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <Eye className="h-4 w-4 mr-1.5" /> Show my payment & task status
          </Button>
        </div>
      </section>
    );
  }

  // Not yet activated — prompt
  if (!mobile) {
    return (
      <section className="py-10 lg:py-14 bg-gradient-to-br from-primary/5 via-fuchsia-500/5 to-amber-500/5">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-primary/30 overflow-hidden">
            <div className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 h-1" />
            <CardContent className="py-7 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Activate your personal status feed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your mobile number once — we'll auto-show your payment records, wallet
                  and assigned tasks as a live updating card.
                </p>
              </div>
              <div className="flex gap-2 max-w-sm mx-auto">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={inputMobile}
                    onChange={(e) => setInputMobile(e.target.value)}
                    placeholder="Mobile number"
                    className="pl-10"
                    maxLength={15}
                    onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                  />
                </div>
                <Button
                  onClick={handleActivate}
                  disabled={inputMobile.replace(/\D/g, "").length < 10}
                >
                  Activate
                </Button>
              </div>
              <div>
                <Button variant="ghost" size="sm" onClick={handleIgnore}>
                  <EyeOff className="h-4 w-4 mr-1.5" /> Ignore for now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  // Activated — show moving card
  return (
    <section className="py-10 lg:py-14 bg-gradient-to-br from-primary/5 via-fuchsia-500/5 to-amber-500/5">
      <div className="container mx-auto px-4 max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" /> Your Payment & Task Updates
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {agentInfo
                ? `${agentInfo.name} • ${mobile}`
                : `Showing records for ${mobile}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Change
            </Button>
            <Button variant="ghost" size="sm" onClick={handleIgnore}>
              <EyeOff className="h-4 w-4 mr-1.5" /> Ignore
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : searched && totalItems === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <XCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No payment records, wallet or tasks found for this number.
            </CardContent>
          </Card>
        ) : (
          <Carousel
            opts={{ loop: totalItems > 1, align: "start" }}
            plugins={[autoplay.current]}
            className="w-full"
          >
            <CarouselContent>
              {walletBalance !== null && (
                <CarouselItem className="md:basis-1/2 lg:basis-1/3">
                  <Card className="h-full border-l-4 border-emerald-500 bg-gradient-to-br from-emerald-500/10 to-emerald-500/0">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/40 dark:text-emerald-300 border text-[10px]">
                          Wallet
                        </Badge>
                        <Wallet className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h4 className="font-semibold text-sm leading-snug">Available Balance</h4>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      {agentInfo && (
                        <p className="text-[11px] text-muted-foreground">{agentInfo.name}</p>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>
              )}

              {tasks.map((t) => (
                <CarouselItem key={`task-${t.id}`} className="md:basis-1/2 lg:basis-1/3">
                  <Card className="h-full border-l-4 border-fuchsia-500 bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-500/0">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge className="bg-fuchsia-500/20 text-fuchsia-700 border-fuchsia-500/40 dark:text-fuchsia-300 border text-[10px]">
                          <ListTodo className="h-3 w-3 mr-1" /> Task
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_STYLE[t.status] || ""}`}
                        >
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-sm leading-snug">{t.title}</h4>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        {t.department_name && <p>Dept: {t.department_name}</p>}
                        {t.due_date && (
                          <p className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Due: {new Date(t.due_date).toLocaleDateString("en-IN")}
                          </p>
                        )}
                        {t.remarks && <p className="italic">"{t.remarks}"</p>}
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}

              {collections.map((c) => (
                <CarouselItem key={`coll-${c.id}`} className="md:basis-1/2 lg:basis-1/3">
                  <Card className="h-full border-l-4 border-amber-500 bg-gradient-to-br from-amber-500/10 to-amber-500/0">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/40 dark:text-amber-300 border text-[10px]">
                          <IndianRupee className="h-3 w-3 mr-0.5" /> Payment
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_STYLE[c.status] || ""}`}
                        >
                          {c.status === "submitted" ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Submitted
                            </>
                          ) : (
                            c.status
                          )}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-sm leading-snug">{c.person_name}</h4>
                      <p className="text-xl font-bold">
                        ₹{Number(c.amount).toLocaleString("en-IN")}
                      </p>
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        {c.receipt_number && <p>Receipt: {c.receipt_number}</p>}
                        {c.division_name && <p>Division: {c.division_name}</p>}
                        {c.panchayath_name && <p>Panchayath: {c.panchayath_name}</p>}
                        <p>{new Date(c.created_at).toLocaleDateString("en-IN")}</p>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}
      </div>
    </section>
  );
}
