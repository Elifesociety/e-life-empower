import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, Megaphone } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qnucqwniloioxsowdqzj.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc";

interface PublicUpdate {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
}

interface PublicProject {
  id: string;
  project_name: string;
  plan_description: string | null;
  logo_url: string | null;
  created_at: string;
  updates: PublicUpdate[];
}

export function PublicProjectsShowcase() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/samrabhaka-auth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ action: "public_projects" }),
        });
        const json = await res.json();
        if (res.ok) setProjects(json.projects || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-pink-600" />
      </div>
    );
  }

  if (projects.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="text-center mb-6">
        <h2 className="font-display text-2xl font-bold flex items-center justify-center gap-2">
          <Briefcase className="h-6 w-6 text-pink-600" />
          Samrambhaka Projects
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Entrepreneurship projects by our agents
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Card key={p.id} className="border-2 hover:border-pink-300 hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {p.logo_url && (
                  <img
                    src={p.logo_url}
                    alt={`${p.project_name} logo`}
                    loading="lazy"
                    className="h-10 w-10 rounded-lg object-cover border bg-background shrink-0"
                  />
                )}
                <CardTitle className="text-base">{p.project_name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {p.plan_description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                  {p.plan_description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}

              {p.updates.length > 0 && (
                <div className="rounded-lg bg-pink-50/60 border border-pink-100 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-pink-700">
                    <Megaphone className="h-3.5 w-3.5" /> Updates
                    <Badge variant="secondary" className="ml-auto">{p.updates.length}</Badge>
                  </div>
                  {p.updates.map((u) => (
                    <div key={u.id} className="text-xs">
                      {u.title && <p className="font-medium">{u.title}</p>}
                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">{u.body}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
