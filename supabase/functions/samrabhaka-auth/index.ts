import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-samrabhaka-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeMobile(m: string): string {
  return (m || "").replace(/\D+/g, "");
}

async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const data = JSON.stringify(payload);
  const sig = await sha256Hex(data + secret);
  return btoa(data) + "." + sig;
}

async function verifyToken(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;
    const data = atob(b64);
    // accept current secret, and legacy tokens signed with the service role key
    const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const candidates = [secret, legacy].filter(Boolean);
    let ok = false;
    for (const c of candidates) {
      if ((await sha256Hex(data + c)) === sig) { ok = true; break; }
    }
    if (!ok) return null;
    const payload = JSON.parse(data);
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const secret = Deno.env.get("SAMRABHAKA_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;

    // ---- public_projects (no auth) ----
    if (action === "public_projects") {
      const { data: projects, error } = await supabase
        .from("agent_projects")
        .select("id, project_name, plan_description, logo_url, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);
      const ids = (projects || []).map((p: any) => p.id);
      let notesByProject: Record<string, any[]> = {};
      if (ids.length) {
        const { data: notes } = await supabase
          .from("agent_project_notes")
          .select("id, project_id, title, body, created_at")
          .in("project_id", ids)
          .order("created_at", { ascending: false });
        for (const n of notes || []) {
          (notesByProject[n.project_id] ||= []).push(n);
        }
      }
      return json({
        success: true,
        projects: (projects || []).map((p: any) => ({
          ...p,
          updates: (notesByProject[p.id] || []).slice(0, 5),
        })),
      });
    }

    // ---- check_mobile ----
    if (action === "check_mobile") {
      const mobile = normalizeMobile(body.mobile || "");
      if (mobile.length < 8) return json({ error: "Invalid mobile number" }, 400);

      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, is_active")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!agent) return json({ exists: false });
      if (!agent.is_active) return json({ error: "Your agent account is inactive. Contact admin." }, 403);

      const { data: auth } = await supabase
        .from("agent_auth")
        .select("id")
        .eq("agent_id", agent.id)
        .maybeSingle();

      return json({
        exists: true,
        has_password: !!auth,
        name: agent.name,
        role: agent.role,
      });
    }

    // ---- register ----
    if (action === "register") {
      const mobile = normalizeMobile(body.mobile || "");
      const password: string = body.password || "";
      if (mobile.length < 8) return json({ error: "Invalid mobile number" }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, is_active")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!agent) return json({ error: "Mobile number not found in agent hierarchy" }, 404);
      if (!agent.is_active) return json({ error: "Your agent account is inactive" }, 403);

      const { data: existing } = await supabase
        .from("agent_auth")
        .select("id")
        .eq("agent_id", agent.id)
        .maybeSingle();

      if (existing) return json({ error: "Account already exists. Please login." }, 409);

      const password_hash = await sha256Hex(password + ":" + secret.slice(0, 16));

      const { error: insErr } = await supabase.from("agent_auth").insert({
        agent_id: agent.id,
        mobile,
        password_hash,
        last_login_at: new Date().toISOString(),
      });
      if (insErr) return json({ error: insErr.message }, 500);

      const token = await signToken(
        { agent_id: agent.id, mobile, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
        secret,
      );
      return json({ success: true, token, agent: { id: agent.id, name: agent.name, role: agent.role, mobile } });
    }

    // ---- login ----
    if (action === "login") {
      const mobile = normalizeMobile(body.mobile || "");
      const password: string = body.password || "";
      if (!mobile || !password) return json({ error: "Mobile and password are required" }, 400);

      const { data: auth } = await supabase
        .from("agent_auth")
        .select("id, agent_id, password_hash")
        .eq("mobile", mobile)
        .maybeSingle();

      if (!auth) return json({ error: "Invalid mobile or password" }, 401);

      const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const password_hash = await sha256Hex(password + ":" + secret.slice(0, 16));
      let ok = password_hash === auth.password_hash;
      if (!ok && legacySecret && legacySecret !== secret) {
        const legacyHash = await sha256Hex(password + ":" + legacySecret.slice(0, 16));
        if (legacyHash === auth.password_hash) {
          ok = true;
          // migrate to the stable secret
          await supabase.from("agent_auth").update({ password_hash }).eq("id", auth.id);
        }
      }
      if (!ok) {
        return json({ error: "Invalid mobile or password" }, 401);
      }


      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, is_active, mobile")
        .eq("id", auth.agent_id)
        .maybeSingle();

      if (!agent || !agent.is_active) return json({ error: "Your account is inactive" }, 403);

      await supabase.from("agent_auth").update({ last_login_at: new Date().toISOString() }).eq("id", auth.id);

      const token = await signToken(
        { agent_id: agent.id, mobile: agent.mobile, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
        secret,
      );
      return json({ success: true, token, agent: { id: agent.id, name: agent.name, role: agent.role, mobile: agent.mobile } });
    }

    // ---- me ----
    if (action === "me") {
      const token = req.headers.get("x-samrabhaka-token") || body.token;
      if (!token) return json({ error: "Unauthorized" }, 401);
      const payload = await verifyToken(token, secret);
      if (!payload) return json({ error: "Invalid or expired token" }, 401);

      const { data: agent } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role, ward, is_active, panchayath_id, panchayaths(name, district)")
        .eq("id", payload.agent_id)
        .maybeSingle();

      if (!agent || !agent.is_active) return json({ error: "Account inactive" }, 403);
      return json({ success: true, agent });
    }

    // ---- change_password ----
    if (action === "change_password") {
      const token = req.headers.get("x-samrabhaka-token") || body.token;
      if (!token) return json({ error: "Unauthorized" }, 401);
      const payload = await verifyToken(token, secret);
      if (!payload) return json({ error: "Invalid or expired token" }, 401);

      const oldPw: string = body.old_password || "";
      const newPw: string = body.new_password || "";
      if (newPw.length < 6) return json({ error: "New password must be at least 6 characters" }, 400);

      const { data: auth } = await supabase
        .from("agent_auth")
        .select("id, password_hash")
        .eq("agent_id", payload.agent_id)
        .maybeSingle();
      if (!auth) return json({ error: "Not found" }, 404);

      const oldHash = await sha256Hex(oldPw + ":" + secret.slice(0, 16));
      const legacySecret2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const oldLegacyHash = legacySecret2
        ? await sha256Hex(oldPw + ":" + legacySecret2.slice(0, 16))
        : "";
      if (oldHash !== auth.password_hash && oldLegacyHash !== auth.password_hash) {
        return json({ error: "Current password is incorrect" }, 401);
      }


      const newHash = await sha256Hex(newPw + ":" + secret.slice(0, 16));
      await supabase.from("agent_auth").update({ password_hash: newHash }).eq("id", auth.id);
      return json({ success: true });
    }

    // ---- auth helper for project actions ----
    const requireAuth = async () => {
      const token = req.headers.get("x-samrabhaka-token") || body.token;
      if (!token) return { error: json({ error: "Unauthorized" }, 401) };
      const payload = await verifyToken(token, secret);
      if (!payload) return { error: json({ error: "Invalid or expired token" }, 401) };
      return { agent_id: payload.agent_id as string };
    };

    const BUDGET_SHARES: Record<string, { own: number; elife: number }> = {
      own_100: { own: 100, elife: 0 },
      "80_20": { own: 80, elife: 20 },
      "50_50": { own: 50, elife: 50 },
      "20_80": { own: 20, elife: 80 },
      samrambhini: { own: 0, elife: 0 },
    };

    // ---- list_projects ----
    if (action === "list_projects") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const { data, error } = await supabase
        .from("agent_projects")
        .select("*")
        .eq("agent_id", auth.agent_id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, projects: data || [] });
    }

    // ---- my_todos: all tasks across owned + member projects ----
    if (action === "my_todos") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;

      const [{ data: owned }, { data: memberships }] = await Promise.all([
        supabase.from("agent_projects").select("id, project_name").eq("agent_id", auth.agent_id),
        supabase.from("agent_project_members").select("project_id").eq("agent_id", auth.agent_id),
      ]);

      const memberIds = (memberships || []).map((m: { project_id: string }) => m.project_id);
      let memberProjects: { id: string; project_name: string }[] = [];
      if (memberIds.length) {
        const { data } = await supabase.from("agent_projects").select("id, project_name").in("id", memberIds);
        memberProjects = data || [];
      }

      const projectMap = new Map<string, string>();
      for (const p of [...(owned || []), ...memberProjects]) projectMap.set(p.id, p.project_name);
      const ids = Array.from(projectMap.keys());
      if (!ids.length) return json({ success: true, todos: [] });

      const { data: todos, error } = await supabase
        .from("agent_project_todos")
        .select("*")
        .in("project_id", ids)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      return json({
        success: true,
        todos: (todos || []).map((t: Record<string, unknown>) => ({
          ...t,
          project_name: projectMap.get(t.project_id as string) || "",
        })),
      });
    }


    // ---- create_project ----
    if (action === "create_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const p = body.project || {};
      if (!p.project_name || !p.model || !p.entity || !p.budget_plan) {
        return json({ error: "project_name, model, entity and budget_plan are required" }, 400);
      }
      if (!["individual", "partnership", "group"].includes(p.model)) return json({ error: "Invalid model" }, 400);
      if (!["own_company", "elife_affiliated"].includes(p.entity)) return json({ error: "Invalid entity" }, 400);
      const shares = BUDGET_SHARES[p.budget_plan];
      if (!shares) return json({ error: "Invalid budget_plan" }, 400);

      const { data, error } = await supabase
        .from("agent_projects")
        .insert({
          agent_id: auth.agent_id,
          project_name: String(p.project_name).slice(0, 200),
          plan_description: p.plan_description || null,
          model: p.model,
          entity: p.entity,
          budget_plan: p.budget_plan,
          logo_url: p.logo_url || null,
          own_share: shares.own,
          elife_share: shares.elife,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, project: data });
    }

    // ---- update_project ----
    if (action === "update_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      const p = body.project || {};
      if (!id) return json({ error: "id required" }, 400);

      const patch: Record<string, unknown> = {};
      if (p.project_name !== undefined) patch.project_name = String(p.project_name).slice(0, 200);
      if (p.plan_description !== undefined) patch.plan_description = p.plan_description || null;
      if (p.logo_url !== undefined) patch.logo_url = p.logo_url || null;
      if (p.model !== undefined) {
        if (!["individual", "partnership", "group"].includes(p.model)) return json({ error: "Invalid model" }, 400);
        patch.model = p.model;
      }
      if (p.entity !== undefined) {
        if (!["own_company", "elife_affiliated"].includes(p.entity)) return json({ error: "Invalid entity" }, 400);
        patch.entity = p.entity;
      }
      if (p.budget_plan !== undefined) {
        const shares = BUDGET_SHARES[p.budget_plan];
        if (!shares) return json({ error: "Invalid budget_plan" }, 400);
        patch.budget_plan = p.budget_plan;
        patch.own_share = shares.own;
        patch.elife_share = shares.elife;
      }

      const { data, error } = await supabase
        .from("agent_projects")
        .update(patch)
        .eq("id", id)
        .eq("agent_id", auth.agent_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, project: data });
    }

    // ---- delete_project ----
    if (action === "delete_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await supabase
        .from("agent_projects")
        .delete()
        .eq("id", id)
        .eq("agent_id", auth.agent_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // Helper: assert caller owns the project (or is a member)
    const assertProjectAccess = async (project_id: string, agent_id: string) => {
      const { data: proj } = await supabase
        .from("agent_projects")
        .select("id, agent_id, model")
        .eq("id", project_id)
        .maybeSingle();
      if (!proj) return { error: json({ error: "Project not found" }, 404) };
      if (proj.agent_id === agent_id) return { project: proj, isOwner: true as const };
      const { data: mem } = await supabase
        .from("agent_project_members")
        .select("id")
        .eq("project_id", project_id)
        .eq("agent_id", agent_id)
        .maybeSingle();
      if (!mem) return { error: json({ error: "Forbidden" }, 403) };
      return { project: proj, isOwner: false as const };
    };

    if (action === "get_project") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const acc = await assertProjectAccess(id, auth.agent_id);
      if ("error" in acc) return acc.error;

      const [{ data: project }, { data: todos }, { data: notes }, { data: members }] = await Promise.all([
        supabase.from("agent_projects").select("*").eq("id", id).single(),
        supabase.from("agent_project_todos").select("*").eq("project_id", id).order("created_at", { ascending: true }),
        supabase.from("agent_project_notes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        supabase
          .from("agent_project_members")
          .select("id, agent_id, created_at, pennyekart_agents(id, name, mobile, role)")
          .eq("project_id", id)
          .order("created_at", { ascending: true }),
      ]);

      return json({ success: true, project, todos: todos || [], notes: notes || [], members: members || [], isOwner: acc.isOwner });
    }

    if (action === "add_todo") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const project_id: string = body.project_id;
      const title: string = (body.title || "").toString().trim();
      if (!project_id || !title) return json({ error: "project_id and title required" }, 400);
      const acc = await assertProjectAccess(project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { data, error } = await supabase
        .from("agent_project_todos")
        .insert({ project_id, title: title.slice(0, 300) })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, todo: data });
    }

    if (action === "toggle_todo") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      const is_done: boolean = !!body.is_done;
      if (!id) return json({ error: "id required" }, 400);
      const { data: todo } = await supabase.from("agent_project_todos").select("project_id").eq("id", id).maybeSingle();
      if (!todo) return json({ error: "Not found" }, 404);
      const acc = await assertProjectAccess(todo.project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { error } = await supabase.from("agent_project_todos").update({ is_done }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete_todo") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { data: todo } = await supabase.from("agent_project_todos").select("project_id").eq("id", id).maybeSingle();
      if (!todo) return json({ error: "Not found" }, 404);
      const acc = await assertProjectAccess(todo.project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { error } = await supabase.from("agent_project_todos").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "add_note") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const project_id: string = body.project_id;
      const bodyText: string = (body.body || "").toString().trim();
      const title: string | null = body.title ? String(body.title).slice(0, 200) : null;
      if (!project_id || !bodyText) return json({ error: "project_id and body required" }, 400);
      const acc = await assertProjectAccess(project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { data, error } = await supabase
        .from("agent_project_notes")
        .insert({ project_id, title, body: bodyText })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, note: data });
    }

    if (action === "delete_note") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { data: n } = await supabase.from("agent_project_notes").select("project_id").eq("id", id).maybeSingle();
      if (!n) return json({ error: "Not found" }, 404);
      const acc = await assertProjectAccess(n.project_id, auth.agent_id);
      if ("error" in acc) return acc.error;
      const { error } = await supabase.from("agent_project_notes").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "search_registered_agents") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const q: string = (body.q || "").toString().trim();
      if (q.length < 2) return json({ success: true, agents: [] });

      const { data: authRows } = await supabase.from("agent_auth").select("agent_id").limit(1000);
      const registeredIds = (authRows || []).map((r) => r.agent_id);
      if (registeredIds.length === 0) return json({ success: true, agents: [] });

      const { data: agents } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role")
        .in("id", registeredIds)
        .or(`name.ilike.%${q}%,mobile.ilike.%${q}%`)
        .limit(20);
      return json({ success: true, agents: (agents || []).filter((a) => a.id !== auth.agent_id) });
    }

    if (action === "add_member") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const project_id: string = body.project_id;
      const agent_id: string = body.agent_id;
      if (!project_id || !agent_id) return json({ error: "project_id and agent_id required" }, 400);

      const { data: proj } = await supabase
        .from("agent_projects")
        .select("id, agent_id, model")
        .eq("id", project_id)
        .maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 404);
      if (proj.agent_id !== auth.agent_id) return json({ error: "Only the project owner can add members" }, 403);
      if (proj.model === "individual") return json({ error: "Individual projects cannot have partners" }, 400);
      if (agent_id === proj.agent_id) return json({ error: "You are already the owner" }, 400);

      const { data: authRow } = await supabase.from("agent_auth").select("id").eq("agent_id", agent_id).maybeSingle();
      if (!authRow) return json({ error: "Selected user is not a registered Samrambhaka user" }, 400);

      if (proj.model === "partnership") {
        const { count } = await supabase
          .from("agent_project_members")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project_id);
        if ((count || 0) >= 3) return json({ error: "Partnership projects allow max 4 members (owner + 3 partners)" }, 400);
      }

      const { data, error } = await supabase
        .from("agent_project_members")
        .insert({ project_id, agent_id })
        .select("id, agent_id, created_at, pennyekart_agents(id, name, mobile, role)")
        .single();
      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate")) return json({ error: "Already a member" }, 400);
        return json({ error: error.message }, 500);
      }
      return json({ success: true, member: data });
    }

    if (action === "remove_member") {
      const auth = await requireAuth();
      if ("error" in auth) return auth.error;
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { data: mem } = await supabase
        .from("agent_project_members")
        .select("id, project_id")
        .eq("id", id)
        .maybeSingle();
      if (!mem) return json({ error: "Not found" }, 404);
      const { data: proj } = await supabase.from("agent_projects").select("agent_id").eq("id", mem.project_id).maybeSingle();
      if (!proj || proj.agent_id !== auth.agent_id) return json({ error: "Only the project owner can remove members" }, 403);
      const { error } = await supabase.from("agent_project_members").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("samrabhaka-auth error:", e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});