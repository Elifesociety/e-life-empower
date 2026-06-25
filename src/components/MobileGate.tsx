import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Phone, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MOBILE_KEY = "elife_status_mobile";
const GATE_KEY = "elife_gate_status"; // "verified" | "programs_only"
const IGNORE_KEY = "elife_status_ignored";

// Routes that bypass the gate entirely (auth, admin areas, agent self-register, program detail).
const BYPASS_PREFIXES = [
  "/auth",
  "/admin",
  "/super-admin",
  "/dashboard",
  "/admin-dashboard",
  "/unauthorized",
  "/register-agent",
  "/program/", // public program detail (shareable)
];

// When status === "programs_only", only these routes are reachable.
const PROGRAMS_ONLY_ALLOWED_PREFIXES = ["/programs", "/program/", ...BYPASS_PREFIXES];

function getGateStatus(): "verified" | "programs_only" | null {
  try {
    const v = localStorage.getItem(GATE_KEY);
    return v === "verified" || v === "programs_only" ? v : null;
  } catch {
    return null;
  }
}

export function MobileGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"verified" | "programs_only" | null>(() => getGateStatus());
  const [inputMobile, setInputMobile] = useState("");
  const [checking, setChecking] = useState(false);

  // Bypass on admin/auth/etc. — no gate at all
  const bypass = BYPASS_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Force programs-only users back to /programs if they wander
  useEffect(() => {
    if (bypass) return;
    if (status === "programs_only") {
      const allowed = PROGRAMS_ONLY_ALLOWED_PREFIXES.some((p) =>
        p.endsWith("/") ? location.pathname.startsWith(p) : location.pathname === p,
      );
      if (!allowed) navigate("/programs", { replace: true });
    }
  }, [status, location.pathname, bypass, navigate]);

  // Listen for resets from elsewhere (e.g. "Change number" button)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GATE_KEY) setStatus(getGateStatus());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleSubmit = async () => {
    const cleaned = inputMobile.replace(/\D/g, "");
    if (cleaned.length < 10) return;
    setChecking(true);
    try {
      const [agentRes, collRes] = await Promise.all([
        supabase.from("pennyekart_agents").select("id").eq("mobile", cleaned).limit(1),
        supabase.from("cash_collections").select("id").eq("mobile", cleaned).limit(1),
      ]);
      const found =
        (agentRes.data && agentRes.data.length > 0) ||
        (collRes.data && collRes.data.length > 0);

      try {
        localStorage.setItem(MOBILE_KEY, cleaned);
        localStorage.removeItem(IGNORE_KEY);
        localStorage.setItem(GATE_KEY, found ? "verified" : "programs_only");
      } catch {}

      setStatus(found ? "verified" : "programs_only");
      setInputMobile("");

      if (!found) {
        toast({
          title: "Number not in our records",
          description: "Showing available programs only.",
        });
        navigate("/programs", { replace: true });
      }
    } finally {
      setChecking(false);
    }
  };

  // Don't show dialog on bypass routes
  if (bypass) return null;
  if (status !== null) return null;

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Welcome to e-Life</DialogTitle>
          <DialogDescription className="text-center">
            Enter your registered mobile number to access your personal dashboard.
            If your number is not in our records, you'll see our public programs.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="tel"
            value={inputMobile}
            onChange={(e) => setInputMobile(e.target.value)}
            placeholder="Mobile number"
            className="pl-10"
            maxLength={15}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && !checking && handleSubmit()}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={checking || inputMobile.replace(/\D/g, "").length < 10}
            className="w-full"
          >
            {checking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function resetMobileGate() {
  try {
    localStorage.removeItem(MOBILE_KEY);
    localStorage.removeItem(GATE_KEY);
    localStorage.removeItem(IGNORE_KEY);
  } catch {}
  window.location.href = "/";
}
