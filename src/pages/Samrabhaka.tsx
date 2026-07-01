import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSamrabhakaAuth } from "@/hooks/useSamrabhakaAuth";
import { toast } from "sonner";
import { Loader2, LogOut, User, Phone, MapPin, Shield, Briefcase, ListChecks, ChevronRight } from "lucide-react";
import { ProjectsSection } from "@/components/samrabhaka/ProjectsSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Step = "mobile" | "register" | "login";

export default function Samrabhaka() {
  const { agent, isLoading, token, checkMobile, register, login, logout } = useSamrabhakaAuth();

  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [openFeature, setOpenFeature] = useState<"tasks" | "projects" | null>(null);
  const [pending, setPending] = useState(false);
  const [agentPreview, setAgentPreview] = useState<{ name: string; role: string } | null>(null);

  const resetAll = () => {
    setStep("mobile");
    setMobile("");
    setPassword("");
    setConfirmPassword("");
    setAgentPreview(null);
  };

  const handleCheckMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = mobile.replace(/\D+/g, "");
    if (digits.length < 8) {
      toast.error("Please enter a valid mobile number");
      return;
    }
    setPending(true);
    try {
      const res = await checkMobile(digits);
      if (!res.exists) {
        toast.error("This mobile is not registered as an agent. Contact your admin.");
        return;
      }
      setAgentPreview({ name: res.name, role: res.role });
      setStep(res.has_password ? "login" : "register");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check mobile");
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    setPending(true);
    try {
      await register(mobile.replace(/\D+/g, ""), password);
      toast.success("Account created!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setPending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await login(mobile.replace(/\D+/g, ""), password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  // ---- Dashboard ----
  if (token && agent) {
    return (
      <Layout>
        <div className="container max-w-3xl py-10">
          <div className="mb-8 text-center">
            <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-pink-500 to-pink-700 bg-clip-text text-transparent">
              സംരംഭക.കോം
            </h1>
            <p className="text-muted-foreground mt-2">Welcome back, {agent.name}</p>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Your Profile
              </CardTitle>
              <CardDescription>Agent information from Pennyekart hierarchy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProfileRow icon={<User className="h-4 w-4" />} label="Name" value={agent.name} />
              <ProfileRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={agent.mobile} />
              <ProfileRow icon={<Shield className="h-4 w-4" />} label="Role" value={formatRole(agent.role)} />
              {agent.panchayaths?.name && (
                <ProfileRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Panchayath"
                  value={`${agent.panchayaths.name}${agent.panchayaths.district ? " · " + agent.panchayaths.district : ""}`}
                />
              )}
              {agent.ward && <ProfileRow icon={<MapPin className="h-4 w-4" />} label="Ward" value={agent.ward} />}

              <div className="pt-4 border-t">
                <Button variant="outline" onClick={logout} className="gap-2">
                  <LogOut className="h-4 w-4" /> Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureTile
              icon={<ListChecks className="h-6 w-6" />}
              title="Your Tasks"
              description="View and manage your assigned tasks"
              onClick={() => setOpenFeature("tasks")}
            />
            <FeatureTile
              icon={<Briefcase className="h-6 w-6" />}
              title="My Projects"
              description="Your entrepreneurship projects"
              onClick={() => setOpenFeature("projects")}
            />
          </div>

          <Dialog open={openFeature === "projects"} onOpenChange={(o) => !o && setOpenFeature(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-pink-600" /> My Projects
                </DialogTitle>
                <DialogDescription>Your entrepreneurship projects</DialogDescription>
              </DialogHeader>
              <ProjectsSection token={token} />
            </DialogContent>
          </Dialog>

          <Dialog open={openFeature === "tasks"} onOpenChange={(o) => !o && setOpenFeature(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-pink-600" /> Your Tasks
                </DialogTitle>
                <DialogDescription>Tasks assigned to you</DialogDescription>
              </DialogHeader>
              <div className="py-10 text-center text-sm text-muted-foreground">
                No tasks assigned yet. Check back soon.
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // ---- Auth flow ----
  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center py-10 bg-gradient-to-br from-pink-50 via-background to-pink-50">
        <Card className="w-full max-w-md border-2 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              സം
            </div>
            <CardTitle className="text-3xl bg-gradient-to-r from-pink-500 to-pink-700 bg-clip-text text-transparent font-display">
              സംരംഭക.കോം
            </CardTitle>
            <CardDescription>
              {step === "mobile" && "Enter your registered agent mobile number"}
              {step === "register" && agentPreview && `Create password for ${agentPreview.name}`}
              {step === "login" && agentPreview && `Welcome back, ${agentPreview.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "mobile" && (
              <form onSubmit={handleCheckMobile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="numeric"
                    placeholder="e.g. 9656830104"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
              </form>
            )}

            {step === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="rounded-lg bg-pink-50 border border-pink-200 p-3 text-sm">
                  <p className="font-medium">{agentPreview?.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatRole(agentPreview?.role || "")} · {mobile}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-pw">Create Password</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pw">Confirm Password</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={resetAll} className="flex-1">
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700" disabled={pending}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Register
                  </Button>
                </div>
              </form>
            )}

            {step === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="rounded-lg bg-pink-50 border border-pink-200 p-3 text-sm">
                  <p className="font-medium">{agentPreview?.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatRole(agentPreview?.role || "")} · {mobile}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw">Password</Label>
                  <Input
                    id="pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={resetAll} className="flex-1">
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700" disabled={pending}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Login
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function FeatureTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 via-white to-pink-50 p-5 transition-all hover:shadow-lg hover:border-pink-500 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center shadow-md">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-foreground group-hover:text-pink-700 transition-colors">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-pink-400 group-hover:text-pink-600 group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
}

function formatRole(role: string): string {
  return role
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}