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

  const palettes = [
    { card: "from-pink-500 via-rose-500 to-orange-400", chip: "bg-white/20", ring: "hover:shadow-pink-300/60" },
    { card: "from-indigo-500 via-purple-500 to-fuchsia-500", chip: "bg-white/20", ring: "hover:shadow-purple-300/60" },
    { card: "from-emerald-500 via-teal-500 to-cyan-500", chip: "bg-white/20", ring: "hover:shadow-teal-300/60" },
    { card: "from-amber-500 via-orange-500 to-red-500", chip: "bg-white/20", ring: "hover:shadow-orange-300/60" },
    { card: "from-sky-500 via-blue-500 to-indigo-600", chip: "bg-white/20", ring: "hover:shadow-blue-300/60" },
    { card: "from-lime-500 via-green-500 to-emerald-600", chip: "bg-white/20", ring: "hover:shadow-green-300/60" },
  ];

  return (
    <section className="mt-12">
      <div className="text-center mb-6">
        <h2 className="font-display text-2xl font-bold flex items-center justify-center gap-2">
          <Briefcase className="h-6 w-6 text-pink-600" />
          <span className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent">
            Samrambhaka Projects
          </span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Entrepreneurship projects by our agents
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p, i) => {
          const c = palettes[i % palettes.length];
          return (
            <Card
              key={p.id}
              className={`relative overflow-hidden border-0 text-white bg-gradient-to-br ${c.card} shadow-lg ${c.ring} hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
            >
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
              <CardHeader className="pb-2 relative">
                <div className="flex items-center gap-3">
                  {p.logo_url && (
                    <img
                      src={p.logo_url}
                      alt={`${p.project_name} logo`}
                      loading="lazy"
                      className="h-11 w-11 rounded-xl object-cover ring-2 ring-white/60 bg-white/90 shrink-0"
                    />
                  )}
                  <CardTitle className="text-base drop-shadow-sm">{p.project_name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 relative">
                {p.plan_description ? (
                  <p className="text-sm text-white/90 whitespace-pre-wrap line-clamp-4">
                    {p.plan_description}
                  </p>
                ) : (
                  <p className="text-sm text-white/70 italic">No description provided.</p>
                )}

                {p.updates.length > 0 && (
                  <div className={`rounded-xl ${c.chip} backdrop-blur-sm border border-white/30 p-3 space-y-2`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Megaphone className="h-3.5 w-3.5" /> Updates
                      <Badge className="ml-auto bg-white/90 text-foreground hover:bg-white">{p.updates.length}</Badge>
                    </div>
                    {p.updates.map((u) => (
                      <div key={u.id} className="text-xs">
                        {u.title && <p className="font-medium text-white">{u.title}</p>}
                        <p className="text-white/85 whitespace-pre-wrap line-clamp-3">{u.body}</p>
                        <p className="text-[10px] text-white/70 mt-0.5">
                          {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
