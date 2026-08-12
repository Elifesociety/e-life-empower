import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Search, PlayCircle, Images, FileText, Video, Lock, Sparkles } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { callTrainings, getLearnerToken, getLearnerKey, type Training } from "@/lib/trainingsApi";
import { supabase } from "@/integrations/supabase/client";

interface LessonMeta {
  id: string;
  training_id: string;
  lesson_type: string;
  duration_minutes: number;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  ppt: FileText,
  images: Images,
  youtube: Video,
  notes: FileText,
};

export default function Trainings() {
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "Trainings — e-Life Society Learning Hub";
    (async () => {
      try {
        const res = await callTrainings<{ trainings: Training[]; lessons: LessonMeta[]; unlocked: boolean }>({
          action: "public_list",
          learner_token: getLearnerToken(),
        });
        setTrainings(res.trainings);
        setLessons(res.lessons);
        setUnlocked(res.unlocked);
      } catch {
        setTrainings([]);
      } finally {
        setLoading(false);
      }
    })();

    supabase
      .from("training_progress")
      .select("lesson_id")
      .eq("learner_key", getLearnerKey())
      .then(({ data }) => setCompleted(new Set((data || []).map((r) => r.lesson_id))));
  }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(trainings.map((t) => t.category).filter(Boolean)))],
    [trainings],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trainings.filter((t) => {
      const matchCat = category === "All" || t.category === category;
      const matchQ =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.title_ml || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [trainings, search, category]);

  const progressFor = (trainingId: string) => {
    const ls = lessons.filter((l) => l.training_id === trainingId);
    if (!ls.length) return { pct: 0, total: 0 };
    const done = ls.filter((l) => completed.has(l.id)).length;
    return { pct: Math.round((done / ls.length) * 100), total: ls.length };
  };

  return (
    <Layout>
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container py-10 md:py-14">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" /> Learning Hub
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Trainings</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Slide decks, image presentations, videos and notes — everything you need to learn, in one place.
            <span className="ml-1 text-foreground/70">പരിശീലന പരിപാടികൾ</span>
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trainings..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-secondary",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {!unlocked && (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Members-only trainings appear after you sign in to your department on the home page.
            </p>
          )}
        </div>
      </section>

      <section className="container py-8 md:py-12">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-20 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No trainings available yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => {
              const { pct, total } = progressFor(t.id);
              const types = Array.from(new Set(lessons.filter((l) => l.training_id === t.id).map((l) => l.lesson_type)));
              return (
                <Link
                  key={t.id}
                  to={`/trainings/${t.id}`}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
                    i % 5 === 0 && "lg:col-span-2",
                  )}
                >
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-accent/20">
                    {t.cover_url ? (
                      <img
                        src={t.cover_url}
                        alt={t.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <GraduationCap className="h-12 w-12 text-primary/60" />
                      </div>
                    )}
                    <Badge className="absolute left-3 top-3 bg-background/90 text-foreground hover:bg-background">
                      {t.category}
                    </Badge>
                    {!t.is_public && (
                      <Badge className="absolute right-3 top-3 gap-1 bg-accent text-accent-foreground">
                        <Lock className="h-3 w-3" /> Members
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h2 className="text-lg font-semibold leading-tight">{t.title}</h2>
                    {t.title_ml && <p className="text-sm text-primary/80">{t.title_ml}</p>}
                    {t.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                    )}
                    <div className="mt-auto space-y-3 pt-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <PlayCircle className="h-3.5 w-3.5" /> {total} lesson{total === 1 ? "" : "s"}
                        </span>
                        {types.map((ty) => {
                          const Icon = TYPE_ICON[ty] || FileText;
                          return <Icon key={ty} className="h-3.5 w-3.5" />;
                        })}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}
