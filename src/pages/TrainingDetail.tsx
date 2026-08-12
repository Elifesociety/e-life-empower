import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, Clock, GraduationCap, Lock } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LessonViewer } from "@/components/trainings/LessonViewer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  callTrainings,
  getLearnerKey,
  getLearnerToken,
  LESSON_TYPE_LABEL,
  type Training,
  type TrainingLesson,
} from "@/lib/trainingsApi";

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<Training | null>(null);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await callTrainings<{ training: Training; lessons: TrainingLesson[] }>({
          action: "public_detail",
          training_id: id,
          learner_token: getLearnerToken(),
        });
        setTraining(res.training);
        setLessons(res.lessons);
        setActiveId(res.lessons[0]?.id || null);
        document.title = `${res.training.title} — Trainings | e-Life Society`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Training not available");
      } finally {
        setLoading(false);
      }
    })();

    supabase
      .from("training_progress")
      .select("lesson_id")
      .eq("training_id", id)
      .eq("learner_key", getLearnerKey())
      .then(({ data }) => setCompleted(new Set((data || []).map((r) => r.lesson_id))));
  }, [id]);

  const active = useMemo(() => lessons.find((l) => l.id === activeId) || null, [lessons, activeId]);
  const pct = lessons.length ? Math.round((completed.size / lessons.length) * 100) : 0;

  const toggleComplete = async (lesson: TrainingLesson) => {
    const learnerKey = getLearnerKey();
    if (completed.has(lesson.id)) {
      await supabase.from("training_progress").delete().eq("lesson_id", lesson.id).eq("learner_key", learnerKey);
      setCompleted((prev) => {
        const next = new Set(prev);
        next.delete(lesson.id);
        return next;
      });
      return;
    }
    const { error: insertError } = await supabase
      .from("training_progress")
      .insert({ training_id: lesson.training_id, lesson_id: lesson.id, learner_key: learnerKey });
    if (insertError) {
      toast({ title: "Could not save progress", description: insertError.message, variant: "destructive" });
      return;
    }
    setCompleted((prev) => new Set(prev).add(lesson.id));
  };

  const goNext = () => {
    const idx = lessons.findIndex((l) => l.id === activeId);
    if (idx >= 0 && idx < lessons.length - 1) setActiveId(lessons[idx + 1].id);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container space-y-4 py-10">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (error || !training) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">{error || "Training not found"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Members-only trainings require a department login from the home page.
          </p>
          <Button asChild className="mt-5">
            <Link to="/trainings">Back to trainings</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container py-8">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
            <Link to="/trainings">
              <ArrowLeft className="mr-2 h-4 w-4" /> All trainings
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{training.category}</Badge>
            {!training.is_public && (
              <Badge className="gap-1 bg-accent text-accent-foreground">
                <Lock className="h-3 w-3" /> Members
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{training.title}</h1>
          {training.title_ml && <p className="text-primary/80">{training.title_ml}</p>}
          {training.description && <p className="mt-2 max-w-3xl text-muted-foreground">{training.description}</p>}
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{pct}% complete</span>
          </div>
        </div>
      </section>

      <section className="container grid gap-6 py-8 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lessons</h2>
          {lessons.length === 0 && <p className="text-sm text-muted-foreground">No lessons added yet.</p>}
          {lessons.map((lesson, i) => (
            <button
              key={lesson.id}
              onClick={() => setActiveId(lesson.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                lesson.id === activeId ? "border-primary bg-primary/5" : "hover:bg-secondary",
              )}
            >
              <span className="mt-0.5">
                {completed.has(lesson.id) ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-tight">
                  {i + 1}. {lesson.title}
                </span>
                <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {LESSON_TYPE_LABEL[lesson.lesson_type]}
                  {lesson.duration_minutes > 0 && (
                    <>
                      <Clock className="h-3 w-3" />
                      {lesson.duration_minutes} min
                    </>
                  )}
                </span>
              </span>
            </button>
          ))}
        </aside>

        <div className="min-w-0 space-y-4">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{active.title}</h2>
                <div className="flex gap-2">
                  <Button
                    variant={completed.has(active.id) ? "secondary" : "default"}
                    size="sm"
                    onClick={() => toggleComplete(active)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {completed.has(active.id) ? "Completed" : "Mark complete"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={goNext} disabled={active.id === lessons[lessons.length - 1]?.id}>
                    Next lesson
                  </Button>
                </div>
              </div>
              <LessonViewer lesson={active} />
            </>
          ) : (
            <div className="rounded-2xl border border-dashed py-20 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">Lessons will appear here soon.</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
