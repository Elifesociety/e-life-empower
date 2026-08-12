import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "program-media";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AdminCtx {
  admin_id: string;
  user_id: string | null;
  division_id: string;
  isSuperAdmin: boolean;
}

function parseAdminToken(token: string): { admin_id: string; user_id: string | null; division_id: string; exp: number } | null {
  try {
    const [payloadB64] = token.split(".");
    const payload = JSON.parse(atob(payloadB64));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function verifyAdmin(adminToken: string | null, authHeader: string | null): Promise<AdminCtx | null> {
  if (adminToken) {
    const parsed = parseAdminToken(adminToken);
    if (!parsed) return null;
    const { data: admin } = await supabase
      .from("admins")
      .select("id, division_id, is_active")
      .eq("id", parsed.admin_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!admin) return null;
    let isSuperAdmin = false;
    if (parsed.user_id) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", parsed.user_id)
        .eq("role", "super_admin")
        .maybeSingle();
      isSuperAdmin = !!roleData;
    }
    return { admin_id: admin.id, user_id: parsed.user_id, division_id: admin.division_id, isSuperAdmin };
  }

  const bearer = authHeader?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    const { data: userData } = await supabase.auth.getUser(bearer);
    const user = userData?.user;
    if (!user) return null;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleList = (roles || []).map((r) => r.role);
    if (!roleList.includes("super_admin") && !roleList.includes("admin")) return null;
    const { data: adminRow } = await supabase
      .from("admins")
      .select("id, division_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    return {
      admin_id: adminRow?.id || user.id,
      user_id: user.id,
      division_id: adminRow?.division_id || "",
      isSuperAdmin: roleList.includes("super_admin"),
    };
  }
  return null;
}

// A learner is a department member (mobile:pinHash token) — used to unlock private trainings.
async function isValidLearner(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const [mobile, hash] = String(token).split(":");
  if (!mobile || !hash) return false;
  const { data: agents } = await supabase.from("pennyekart_agents").select("id").eq("mobile", mobile);
  if (!agents || agents.length === 0) return false;
  const { data: members } = await supabase
    .from("department_members")
    .select("id")
    .in("agent_id", agents.map((a) => a.id))
    .eq("pin_hash", hash)
    .eq("is_active", true)
    .limit(1);
  return !!members && members.length > 0;
}

function canManage(ctx: AdminCtx, divisionId: string | null): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!divisionId) return false;
  return divisionId === ctx.division_id;
}

async function uploadFile(fileName: string, base64: string, contentType: string) {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  const safe = fileName.replace(/[^\w.\-]/g, "_");
  const path = `trainings/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ---------- Public actions ----------
    if (action === "public_list" || action === "public_detail") {
      const unlocked = await isValidLearner(body.learner_token);
      let query = supabase
        .from("trainings")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!unlocked) query = query.eq("is_public", true);

      if (action === "public_list") {
        const { data: trainings, error } = await query;
        if (error) return json({ error: error.message }, 400);
        const ids = (trainings || []).map((t) => t.id);
        const { data: lessons } = ids.length
          ? await supabase
              .from("training_lessons")
              .select("id, training_id, lesson_type, duration_minutes")
              .in("training_id", ids)
          : { data: [] as unknown[] };
        return json({ trainings: trainings || [], lessons: lessons || [], unlocked });
      }

      const trainingId = String(body.training_id || "");
      const { data: trainings } = await query.eq("id", trainingId).limit(1);
      const training = trainings?.[0];
      if (!training) return json({ error: "Training not available" }, 404);
      const { data: lessons } = await supabase
        .from("training_lessons")
        .select("*")
        .eq("training_id", trainingId)
        .order("sort_order", { ascending: true });
      return json({ training, lessons: lessons || [], unlocked });
    }

    // ---------- Admin actions ----------
    const ctx = await verifyAdmin(req.headers.get("x-admin-token"), req.headers.get("authorization"));
    if (!ctx) return json({ error: "Unauthorized" }, 401);

    switch (action) {
      case "admin_list": {
        let q = supabase.from("trainings").select("*").order("created_at", { ascending: false });
        if (!ctx.isSuperAdmin) q = q.eq("division_id", ctx.division_id);
        const { data: trainings, error } = await q;
        if (error) return json({ error: error.message }, 400);
        const ids = (trainings || []).map((t) => t.id);
        const { data: lessons } = ids.length
          ? await supabase.from("training_lessons").select("*").in("training_id", ids).order("sort_order")
          : { data: [] as unknown[] };
        return json({ trainings: trainings || [], lessons: lessons || [] });
      }

      case "upload": {
        const url = await uploadFile(String(body.file_name || "file"), String(body.file_base64 || ""), String(body.content_type || "application/octet-stream"));
        return json({ url });
      }

      case "save_training": {
        const payload = body.training || {};
        const divisionId = payload.division_id || (ctx.isSuperAdmin ? null : ctx.division_id);
        if (!ctx.isSuperAdmin && divisionId !== ctx.division_id) {
          return json({ error: "You can only manage trainings for your own division" }, 403);
        }
        const record = {
          title: String(payload.title || "").trim(),
          title_ml: payload.title_ml || null,
          description: payload.description || null,
          cover_url: payload.cover_url || null,
          category: payload.category || "General",
          division_id: divisionId,
          is_public: payload.is_public !== false,
          is_published: !!payload.is_published,
          sort_order: Number(payload.sort_order || 0),
        };
        if (!record.title) return json({ error: "Title is required" }, 400);

        if (payload.id) {
          const { data: existing } = await supabase.from("trainings").select("division_id").eq("id", payload.id).maybeSingle();
          if (!existing || !canManage(ctx, existing.division_id)) return json({ error: "Not allowed" }, 403);
          const { data, error } = await supabase.from("trainings").update(record).eq("id", payload.id).select().single();
          if (error) return json({ error: error.message }, 400);
          return json({ training: data });
        }
        const { data, error } = await supabase
          .from("trainings")
          .insert({ ...record, created_by: ctx.user_id })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ training: data });
      }

      case "delete_training": {
        const id = String(body.id || "");
        const { data: existing } = await supabase.from("trainings").select("division_id").eq("id", id).maybeSingle();
        if (!existing || !canManage(ctx, existing.division_id)) return json({ error: "Not allowed" }, 403);
        const { error } = await supabase.from("trainings").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "save_lesson": {
        const payload = body.lesson || {};
        const trainingId = String(payload.training_id || "");
        const { data: parent } = await supabase.from("trainings").select("division_id").eq("id", trainingId).maybeSingle();
        if (!parent || !canManage(ctx, parent.division_id)) return json({ error: "Not allowed" }, 403);
        const allowed = ["pdf", "ppt", "images", "youtube", "notes"];
        const lessonType = String(payload.lesson_type || "notes");
        if (!allowed.includes(lessonType)) return json({ error: "Invalid lesson type" }, 400);
        const record = {
          training_id: trainingId,
          title: String(payload.title || "").trim() || "Untitled lesson",
          lesson_type: lessonType,
          content: payload.content || {},
          duration_minutes: Number(payload.duration_minutes || 0),
          sort_order: Number(payload.sort_order || 0),
        };
        if (payload.id) {
          const { data, error } = await supabase.from("training_lessons").update(record).eq("id", payload.id).select().single();
          if (error) return json({ error: error.message }, 400);
          return json({ lesson: data });
        }
        const { data, error } = await supabase.from("training_lessons").insert(record).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ lesson: data });
      }

      case "delete_lesson": {
        const id = String(body.id || "");
        const { data: lesson } = await supabase.from("training_lessons").select("training_id").eq("id", id).maybeSingle();
        if (!lesson) return json({ error: "Not found" }, 404);
        const { data: parent } = await supabase.from("trainings").select("division_id").eq("id", lesson.training_id).maybeSingle();
        if (!parent || !canManage(ctx, parent.division_id)) return json({ error: "Not allowed" }, 403);
        const { error } = await supabase.from("training_lessons").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case "reorder_lessons": {
        const items = Array.isArray(body.items) ? body.items : [];
        for (const item of items) {
          await supabase.from("training_lessons").update({ sort_order: Number(item.sort_order || 0) }).eq("id", item.id);
        }
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("admin-trainings error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
