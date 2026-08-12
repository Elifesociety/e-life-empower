import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  GraduationCap,
  Images,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  callTrainings,
  LESSON_TYPE_LABEL,
  uploadTrainingFile,
  youtubeIdFromUrl,
  type LessonType,
  type Training,
  type TrainingLesson,
} from "@/lib/trainingsApi";

interface Division { id: string; name: string }

const emptyTraining = {
  id: "",
  title: "",
  title_ml: "",
  description: "",
  cover_url: "",
  category: "General",
  division_id: "",
  is_public: true,
  is_published: false,
  sort_order: 0,
};

const emptyLesson = {
  id: "",
  title: "",
  lesson_type: "notes" as LessonType,
  duration_minutes: 0,
  file_url: "",
  file_name: "",
  youtube_url: "",
  notes: "",
  images: [] as { url: string; caption?: string }[],
};

export default function TrainingsManagement() {
  const { adminToken, isSuperAdmin, adminData } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [trainingForm, setTrainingForm] = useState({ ...emptyTraining });
  const [trainingDialog, setTrainingDialog] = useState(false);
  const [lessonForm, setLessonForm] = useState({ ...emptyLesson });
  const [lessonDialog, setLessonDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callTrainings<{ trainings: Training[]; lessons: TrainingLesson[] }>(
        { action: "admin_list" },
        adminToken,
      );
      setTrainings(res.trainings);
      setLessons(res.lessons);
      setSelectedId((prev) => prev || res.trainings[0]?.id || null);
    } catch (e) {
      toast({ title: "Failed to load trainings", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [adminToken, toast]);

  useEffect(() => {
    load();
    supabase
      .from("divisions")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setDivisions(data || []));
  }, [load]);

  useEffect(() => {
    document.title = "Trainings Management | e-Life Society";
  }, []);

  const selected = useMemo(() => trainings.find((t) => t.id === selectedId) || null, [trainings, selectedId]);
  const selectedLessons = useMemo(
    () => lessons.filter((l) => l.training_id === selectedId).sort((a, b) => a.sort_order - b.sort_order),
    [lessons, selectedId],
  );

  const openTraining = (t?: Training) => {
    setTrainingForm(
      t
        ? {
            id: t.id,
            title: t.title,
            title_ml: t.title_ml || "",
            description: t.description || "",
            cover_url: t.cover_url || "",
            category: t.category,
            division_id: t.division_id || "",
            is_public: t.is_public,
            is_published: t.is_published,
            sort_order: t.sort_order,
          }
        : { ...emptyTraining, division_id: isSuperAdmin ? "" : adminData?.division_id || "" },
    );
    setTrainingDialog(true);
  };

  const saveTraining = async () => {
    if (!trainingForm.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await callTrainings(
        {
          action: "save_training",
          training: {
            ...trainingForm,
            id: trainingForm.id || undefined,
            division_id: trainingForm.division_id || null,
          },
        },
        adminToken,
      );
      toast({ title: trainingForm.id ? "Training updated" : "Training created" });
      setTrainingDialog(false);
      await load();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTraining = async (t: Training) => {
    if (!confirm(`Delete "${t.title}" and all of its lessons?`)) return;
    try {
      await callTrainings({ action: "delete_training", id: t.id }, adminToken);
      if (selectedId === t.id) setSelectedId(null);
      toast({ title: "Training deleted" });
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const openLesson = (l?: TrainingLesson) => {
    setLessonForm(
      l
        ? {
            id: l.id,
            title: l.title,
            lesson_type: l.lesson_type,
            duration_minutes: l.duration_minutes,
            file_url: l.content?.file_url || "",
            file_name: l.content?.file_name || "",
            youtube_url: l.content?.youtube_id ? `https://youtu.be/${l.content.youtube_id}` : "",
            notes: l.content?.notes || "",
            images: l.content?.images || [],
          }
        : { ...emptyLesson },
    );
    setLessonDialog(true);
  };

  const handleUpload = async (file: File, kind: "file" | "cover" | "image") => {
    setUploading(true);
    try {
      const url = await uploadTrainingFile(file, adminToken);
      if (kind === "cover") setTrainingForm((f) => ({ ...f, cover_url: url }));
      else if (kind === "file") setLessonForm((f) => ({ ...f, file_url: url, file_name: file.name }));
      else setLessonForm((f) => ({ ...f, images: [...f.images, { url, caption: "" }] }));
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveLesson = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const content: Record<string, unknown> = {};
      if (lessonForm.lesson_type === "pdf" || lessonForm.lesson_type === "ppt") {
        content.file_url = lessonForm.file_url;
        content.file_name = lessonForm.file_name;
      } else if (lessonForm.lesson_type === "youtube") {
        content.youtube_id = youtubeIdFromUrl(lessonForm.youtube_url);
      } else if (lessonForm.lesson_type === "images") {
        content.images = lessonForm.images;
      } else {
        content.notes = lessonForm.notes;
      }
      await callTrainings(
        {
          action: "save_lesson",
          lesson: {
            id: lessonForm.id || undefined,
            training_id: selectedId,
            title: lessonForm.title,
            lesson_type: lessonForm.lesson_type,
            duration_minutes: lessonForm.duration_minutes,
            content,
            sort_order: lessonForm.id
              ? selectedLessons.find((l) => l.id === lessonForm.id)?.sort_order ?? 0
              : selectedLessons.length,
          },
        },
        adminToken,
      );
      toast({ title: lessonForm.id ? "Lesson updated" : "Lesson added" });
      setLessonDialog(false);
      await load();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (l: TrainingLesson) => {
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    try {
      await callTrainings({ action: "delete_lesson", id: l.id }, adminToken);
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const move = async (index: number, delta: number) => {
    const next = [...selectedLessons];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const items = next.map((l, i) => ({ id: l.id, sort_order: i }));
    setLessons((prev) =>
      prev.map((l) => {
        const found = items.find((i) => i.id === l.id);
        return found ? { ...l, sort_order: found.sort_order } : l;
      }),
    );
    await callTrainings({ action: "reorder_lessons", items }, adminToken);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to={isSuperAdmin ? "/super-admin" : "/admin-dashboard"}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">Trainings</h1>
              <p className="text-xs text-muted-foreground">Build multi-lesson learning modules</p>
            </div>
          </div>
          <Button onClick={() => openTraining()}>
            <Plus className="mr-2 h-4 w-4" /> New training
          </Button>
        </div>
      </header>

      <main className="container grid gap-6 py-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && trainings.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No trainings yet. Create your first one.
            </div>
          )}
          {trainings.map((t) => (
            <Card
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`cursor-pointer transition ${selectedId === t.id ? "border-primary ring-1 ring-primary" : "hover:bg-secondary/50"}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                    <Badge variant={t.is_published ? "default" : "outline"} className="text-[10px]">
                      {t.is_published ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{t.is_public ? "Public" : "Members"}</Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openTraining(t); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteTraining(t); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          {!selected ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              Select a training to manage its lessons.
            </div>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base">Lessons — {selected.title}</CardTitle>
                <Button size="sm" onClick={() => openLesson()}>
                  <Plus className="mr-2 h-4 w-4" /> Add lesson
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedLessons.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No lessons yet.</p>
                )}
                {selectedLessons.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {LESSON_TYPE_LABEL[l.lesson_type]}
                        {l.duration_minutes > 0 && ` · ${l.duration_minutes} min`}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === selectedLessons.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openLesson(l)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteLesson(l)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Training dialog */}
      <Dialog open={trainingDialog} onOpenChange={setTrainingDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{trainingForm.id ? "Edit training" : "New training"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={trainingForm.title} onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Title (Malayalam)</Label>
              <Input value={trainingForm.title_ml} onChange={(e) => setTrainingForm({ ...trainingForm, title_ml: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={trainingForm.description}
                onChange={(e) => setTrainingForm({ ...trainingForm, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={trainingForm.category} onChange={(e) => setTrainingForm({ ...trainingForm, category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Division</Label>
                <Select
                  value={trainingForm.division_id || "none"}
                  onValueChange={(v) => setTrainingForm({ ...trainingForm, division_id: v === "none" ? "" : v })}
                  disabled={!isSuperAdmin}
                >
                  <SelectTrigger><SelectValue placeholder="All divisions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All divisions</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cover image</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "cover")}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {trainingForm.cover_url && (
                <img src={trainingForm.cover_url} alt="Cover preview" className="h-24 w-full rounded-lg object-cover" />
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground">Off = visible only to logged-in department members</p>
              </div>
              <Switch checked={trainingForm.is_public} onCheckedChange={(v) => setTrainingForm({ ...trainingForm, is_public: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Drafts are hidden from the learning hub</p>
              </div>
              <Switch checked={trainingForm.is_published} onCheckedChange={(v) => setTrainingForm({ ...trainingForm, is_published: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrainingDialog(false)}>Cancel</Button>
            <Button onClick={saveTraining} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{lessonForm.id ? "Edit lesson" : "Add lesson"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lesson title</Label>
              <Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={lessonForm.lesson_type}
                  onValueChange={(v) => setLessonForm({ ...lessonForm, lesson_type: v as LessonType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LESSON_TYPE_LABEL) as LessonType[]).map((t) => (
                      <SelectItem key={t} value={t}>{LESSON_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={lessonForm.duration_minutes}
                  onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: Number(e.target.value) })}
                />
              </div>
            </div>

            {(lessonForm.lesson_type === "pdf" || lessonForm.lesson_type === "ppt") && (
              <div className="space-y-2">
                <Label>{lessonForm.lesson_type === "pdf" ? "PDF file" : "PowerPoint file"}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept={lessonForm.lesson_type === "pdf" ? "application/pdf" : ".ppt,.pptx"}
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "file")}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {lessonForm.file_url && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3 w-3" /> {lessonForm.file_name || "Uploaded"}
                  </p>
                )}
              </div>
            )}

            {lessonForm.lesson_type === "youtube" && (
              <div className="space-y-2">
                <Label>YouTube link</Label>
                <Input
                  placeholder="https://youtu.be/..."
                  value={lessonForm.youtube_url}
                  onChange={(e) => setLessonForm({ ...lessonForm, youtube_url: e.target.value })}
                />
              </div>
            )}

            {lessonForm.lesson_type === "images" && (
              <div className="space-y-3">
                <Label>Presentation images</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "image")}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="space-y-2">
                  {lessonForm.images.map((img, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                      <img src={img.url} alt="" className="h-10 w-14 rounded object-cover" />
                      <Input
                        placeholder="Caption"
                        value={img.caption || ""}
                        onChange={(e) => {
                          const images = [...lessonForm.images];
                          images[i] = { ...images[i], caption: e.target.value };
                          setLessonForm({ ...lessonForm, images });
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setLessonForm({ ...lessonForm, images: lessonForm.images.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {lessonForm.images.length === 0 && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Images className="h-3 w-3" /> Add images one by one — they play as a slideshow.
                    </p>
                  )}
                </div>
              </div>
            )}

            {lessonForm.lesson_type === "notes" && (
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea rows={8} value={lessonForm.notes} onChange={(e) => setLessonForm({ ...lessonForm, notes: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog(false)}>Cancel</Button>
            <Button onClick={saveLesson} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
