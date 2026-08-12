import { supabase } from "@/integrations/supabase/client";

export type LessonType = "pdf" | "ppt" | "images" | "youtube" | "notes";

export interface Training {
  id: string;
  title: string;
  title_ml: string | null;
  description: string | null;
  cover_url: string | null;
  category: string;
  division_id: string | null;
  is_public: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface TrainingLesson {
  id: string;
  training_id: string;
  title: string;
  lesson_type: LessonType;
  content: LessonContent;
  duration_minutes: number;
  sort_order: number;
}

export interface LessonContent {
  file_url?: string;
  file_name?: string;
  youtube_id?: string;
  notes?: string;
  images?: { url: string; caption?: string }[];
}

export const DEPT_SESSION_KEY = "elife_dept_session";
export const LEARNER_KEY = "elife_learner_key";

export function getLearnerToken(): string | null {
  try {
    const raw = localStorage.getItem(DEPT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token || null;
  } catch {
    return null;
  }
}

/** Stable per-device/learner id used to store lesson progress. */
export function getLearnerKey(): string {
  const token = getLearnerToken();
  if (token) return `dept:${token.split(":")[0]}`;
  let key = localStorage.getItem(LEARNER_KEY);
  if (!key) {
    key = `guest:${crypto.randomUUID()}`;
    localStorage.setItem(LEARNER_KEY, key);
  }
  return key;
}

export function youtubeIdFromUrl(url: string): string {
  const patterns = [/youtu\.be\/([\w-]{6,})/, /[?&]v=([\w-]{6,})/, /embed\/([\w-]{6,})/, /shorts\/([\w-]{6,})/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return url.trim();
}

async function authHeaders(adminToken?: string | null) {
  const headers: Record<string, string> = {};
  if (adminToken) headers["x-admin-token"] = adminToken;
  return headers;
}

export async function callTrainings<T>(body: Record<string, unknown>, adminToken?: string | null): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-trainings", {
    body,
    headers: await authHeaders(adminToken),
  });
  if (error) {
    const details = (data as { error?: string } | null)?.error;
    throw new Error(details || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadTrainingFile(file: File, adminToken?: string | null): Promise<string> {
  const base64 = await fileToBase64(file);
  const res = await callTrainings<{ url: string }>(
    { action: "upload", file_name: file.name, file_base64: base64, content_type: file.type || "application/octet-stream" },
    adminToken,
  );
  return res.url;
}

export const CATEGORY_STYLES: Record<string, string> = {
  General: "from-primary/20 to-primary/5 text-primary",
  Pennyekart: "from-accent/25 to-accent/5 text-accent-foreground",
  Samrambhaka: "from-destructive/15 to-destructive/5 text-destructive",
};

export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  pdf: "Slide deck (PDF)",
  ppt: "Slide deck (PPT)",
  images: "Image presentation",
  youtube: "Video",
  notes: "Notes",
};
