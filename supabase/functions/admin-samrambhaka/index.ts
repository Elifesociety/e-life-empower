import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function verifyAdminToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const [payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    if (!decoded.exp || decoded.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!verifyAdminToken(req.headers.get("x-admin-token"))) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;

    // ---- LIST projects with agent info ----
    if (action === "list_projects") {
      const { data: projects, error } = await supabase
        .from("agent_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const agentIds = Array.from(new Set((projects || []).map((p: any) => p.agent_id)));
      const { data: agents } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role, ward, panchayath_id, panchayaths(name, district)")
        .in("id", agentIds.length ? agentIds : ["00000000-0000-0000-0000-000000000000"]);
      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));

      const enriched = (projects || []).map((p: any) => ({
        ...p,
        agent: agentMap.get(p.agent_id) || null,
      }));
      return json({ success: true, projects: enriched });
    }

    // ---- UPDATE project ----
    if (action === "update_project") {
      const id: string = body.id;
      const patch = body.patch || {};
      if (!id) return json({ error: "id required" }, 400);
      const allowed: any = {};
      for (const k of ["project_name", "plan_description", "model", "entity", "budget_plan", "own_share", "elife_share", "status"]) {
        if (patch[k] !== undefined) allowed[k] = patch[k];
      }
      const { data, error } = await supabase
        .from("agent_projects")
        .update(allowed)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, project: data });
    }

    // ---- DELETE project ----
    if (action === "delete_project") {
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await supabase.from("agent_projects").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- LIST tasks for a project ----
    if (action === "list_tasks") {
      const project_id: string = body.project_id;
      if (!project_id) return json({ error: "project_id required" }, 400);
      const { data, error } = await supabase
        .from("agent_project_tasks")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, tasks: data || [] });
    }

    // ---- BUDGET PLANS ----
    if (action === "list_budget_plans") {
      const { data, error } = await supabase
        .from("samrambhaka_budget_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, plans: data || [] });
    }

    if (action === "create_budget_plan") {
      const p = body.plan || {};
      if (!p.key || !p.label) return json({ error: "key and label required" }, 400);
      const { data, error } = await supabase
        .from("samrambhaka_budget_plans")
        .insert({
          key: String(p.key).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          label: p.label,
          own_share: Number(p.own_share) || 0,
          elife_share: Number(p.elife_share) || 0,
          is_active: p.is_active !== false,
          sort_order: Number(p.sort_order) || 0,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, plan: data });
    }

    if (action === "update_budget_plan") {
      const id: string = body.id;
      const p = body.plan || {};
      if (!id) return json({ error: "id required" }, 400);
      const patch: any = {};
      for (const k of ["label", "own_share", "elife_share", "is_active", "sort_order"]) {
        if (p[k] !== undefined) patch[k] = p[k];
      }
      const { data, error } = await supabase
        .from("samrambhaka_budget_plans")
        .update(patch).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, plan: data });
    }

    if (action === "delete_budget_plan") {
      const id: string = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await supabase.from("samrambhaka_budget_plans").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("admin-samrambhaka error:", e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
