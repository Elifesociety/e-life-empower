// Edge function: department member login + work log CRUD
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`elife-dept-${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json();
    const action = body.action as string;

    // ---- Admin actions: require super_admin (validated via Authorization header)
    if (action === "admin_upsert_member" || action === "admin_remove_member") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace("Bearer ", "");
      if (!jwt) return json({ error: "Unauthorized" }, 401);
      const { data: userData } = await supabase.auth.getUser(jwt);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const isSuper = roles?.some((r: any) => r.role === "super_admin");
      if (!isSuper) return json({ error: "Forbidden" }, 403);

      if (action === "admin_upsert_member") {
        const department_id = String(body.department_id || "");
        const agent_id = String(body.agent_id || "");
        const pin = String(body.pin || "").trim();
        const member_role = String(body.member_role || "staff");
        if (!department_id || !agent_id) return json({ error: "Missing fields" }, 400);

        const { data: existing } = await supabase
          .from("department_members")
          .select("id, pin_hash")
          .eq("department_id", department_id)
          .eq("agent_id", agent_id)
          .maybeSingle();

        let pin_hash = existing?.pin_hash;
        if (pin) pin_hash = await hashPin(pin);
        if (!pin_hash) return json({ error: "PIN required for new member" }, 400);

        if (existing) {
          const { error } = await supabase
            .from("department_members")
            .update({ pin_hash, member_role, is_active: true })
            .eq("id", existing.id);
          if (error) return json({ error: error.message }, 500);
        } else {
          const { error } = await supabase
            .from("department_members")
            .insert({ department_id, agent_id, pin_hash, member_role });
          if (error) return json({ error: error.message }, 500);
        }
        return json({ success: true });
      }

      if (action === "admin_remove_member") {
        const id = String(body.id || "");
        const { error } = await supabase.from("department_members").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
    }

    // ---- Login: returns matching department memberships if mobile+pin valid
    if (action === "login") {
      const mobile = String(body.mobile || "").replace(/\D/g, "");
      const pin = String(body.pin || "").trim();
      if (mobile.length < 10 || pin.length < 4) {
        return json({ error: "Invalid mobile or PIN" }, 400);
      }
      const { data: agents } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role")
        .eq("mobile", mobile)
        .eq("is_active", true);
      if (!agents || agents.length === 0) return json({ error: "Agent not found" }, 404);

      const agentIds = agents.map((a) => a.id);
      const { data: members } = await supabase
        .from("department_members")
        .select("id, department_id, agent_id, member_role, pin_hash, is_active, departments(id, name, color, icon)")
        .in("agent_id", agentIds)
        .eq("is_active", true);

      if (!members || members.length === 0) return json({ error: "Not a department member" }, 403);

      const pinHash = await hashPin(pin);
      const valid = members.filter((m: any) => m.pin_hash === pinHash);
      if (valid.length === 0) return json({ error: "Invalid PIN" }, 401);

      // Issue session token (simple): mobile + pin hash, validated on each call
      return json({
        success: true,
        agent: { ...agents[0], is_scode: agents.some((a: any) => a.role === "scode") },
        memberships: valid.map((m: any) => ({
          member_id: m.id,
          department_id: m.department_id,
          department: m.departments,
          member_role: m.member_role,
        })),
        token: `${mobile}:${pinHash}`,
      });
    }

    // For mutating actions, validate token
    const token = String(body.token || "");
    const [tMobile, tHash] = token.split(":");
    if (!tMobile || !tHash) return json({ error: "Unauthorized" }, 401);

    const { data: tokenAgents } = await supabase
      .from("pennyekart_agents")
      .select("id, role")
      .eq("mobile", tMobile)
      .eq("is_active", true);
    if (!tokenAgents || tokenAgents.length === 0) return json({ error: "Unauthorized" }, 401);
    const agentIds = tokenAgents.map((a) => a.id);
    const isScode = tokenAgents.some((a: any) => a.role === "scode");

    const { data: myMembers } = await supabase
      .from("department_members")
      .select("id, department_id, agent_id")
      .in("agent_id", agentIds)
      .eq("pin_hash", tHash)
      .eq("is_active", true);
    if (!myMembers || myMembers.length === 0) return json({ error: "Unauthorized" }, 401);

    const myMemberIds = new Set(myMembers.map((m) => m.id));
    const myDeptIds = new Set(myMembers.map((m) => m.department_id));
    const canEditAny = (creatorId: string | null | undefined) =>
      isScode || (!!creatorId && myMemberIds.has(creatorId));

    if (action === "create_log") {
      let memberId = String(body.member_id || "");
      const department_id = String(body.department_id || "");
      const work_details = String(body.work_details || "").trim();
      const work_date = String(body.work_date || new Date().toISOString().slice(0, 10));
      if (!work_details) return json({ error: "Work details required" }, 400);
      let deptId = department_id;
      // Resolve member_id: prefer explicit; for scode allow any dept (pick membership or first)
      if (memberId && myMemberIds.has(memberId)) {
        const m = myMembers.find((m) => m.id === memberId)!;
        deptId = deptId || m.department_id;
      } else if (isScode && deptId) {
        const m = myMembers.find((m) => m.department_id === deptId) || myMembers[0];
        memberId = m.id;
      } else if (deptId) {
        const m = myMembers.find((m) => m.department_id === deptId);
        if (!m) return json({ error: "Forbidden" }, 403);
        memberId = m.id;
      } else {
        return json({ error: "Department required" }, 400);
      }
      const { data, error } = await supabase
        .from("department_work_logs")
        .insert({ member_id: memberId, department_id: deptId, work_date, work_details, created_by_member_id: memberId, is_public: body.is_public !== false })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, log: data });
    }

    if (action === "update_log") {
      const id = String(body.id || "");
      const { data: existing } = await supabase
        .from("department_work_logs")
        .select("id, member_id, department_id, created_by_member_id")
        .eq("id", id)
        .single();
      if (!existing) return json({ error: "Not found" }, 404);
      const creatorId = existing.created_by_member_id || existing.member_id;
      if (!canEditAny(creatorId)) return json({ error: "Only the creator can edit" }, 403);
      const patch: any = {};
      if (body.work_details !== undefined) patch.work_details = String(body.work_details).trim();
      if (body.is_public !== undefined) patch.is_public = !!body.is_public;
      const { error } = await supabase.from("department_work_logs").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete_log") {
      const id = String(body.id || "");
      const { data: existing } = await supabase
        .from("department_work_logs")
        .select("id, department_id, member_id, created_by_member_id")
        .eq("id", id)
        .single();
      if (!existing) return json({ error: "Not found" }, 404);
      const creatorId = existing.created_by_member_id || existing.member_id;
      if (!canEditAny(creatorId)) return json({ error: "Only the creator can delete" }, 403);
      const { error } = await supabase.from("department_work_logs").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- Plans ----
    const firstMember = myMembers[0];
    if (action === "create_plan") {
      const department_id = String(body.department_id || "");
      if (!isScode && !myDeptIds.has(department_id)) return json({ error: "Forbidden" }, 403);
      const title = String(body.title || "").trim();
      if (!title) return json({ error: "Title required" }, 400);
      const member = myMembers.find((m) => m.department_id === department_id) || firstMember;
      const { data, error } = await supabase.from("department_plans").insert({
        department_id, title,
        description: body.description || null,
        target_date: body.target_date || null,
        status: body.status || "planning",
        created_by_member_id: member.id,
        is_public: body.is_public !== false,
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, plan: data });
    }
    if (action === "update_plan") {
      const id = String(body.id || "");
      const { data: existing } = await supabase.from("department_plans").select("id, department_id, created_by_member_id").eq("id", id).single();
      if (!existing) return json({ error: "Not found" }, 404);
      if (!canEditAny(existing.created_by_member_id)) return json({ error: "Only the creator can edit" }, 403);
      const patch: any = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.description !== undefined) patch.description = body.description || null;
      if (body.target_date !== undefined) patch.target_date = body.target_date || null;
      if (body.status !== undefined) patch.status = body.status;
      if (body.is_public !== undefined) patch.is_public = !!body.is_public;
      const { error } = await supabase.from("department_plans").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }
    if (action === "delete_plan") {
      const id = String(body.id || "");
      const { data: existing } = await supabase.from("department_plans").select("id, department_id, created_by_member_id").eq("id", id).single();
      if (!existing) return json({ error: "Not found" }, 404);
      if (!canEditAny(existing.created_by_member_id)) return json({ error: "Only the creator can delete" }, 403);
      const { error } = await supabase.from("department_plans").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- Todos ----
    if (action === "create_todo") {
      const department_id = String(body.department_id || "");
      if (!isScode && !myDeptIds.has(department_id)) return json({ error: "Forbidden" }, 403);
      const title = String(body.title || "").trim();
      if (!title) return json({ error: "Title required" }, 400);
      const member = myMembers.find((m) => m.department_id === department_id) || firstMember;
      const { data, error } = await supabase.from("department_todos").insert({
        department_id, title,
        description: body.description || null,
        due_date: body.due_date || null,
        created_by_member_id: member.id,
        is_public: body.is_public !== false,
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, todo: data });
    }
    if (action === "update_todo") {
      const id = String(body.id || "");
      const { data: existing } = await supabase.from("department_todos").select("id, department_id, created_by_member_id").eq("id", id).single();
      if (!existing) return json({ error: "Not found" }, 404);
      if (!canEditAny(existing.created_by_member_id)) return json({ error: "Only the creator can edit" }, 403);
      const patch: any = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.description !== undefined) patch.description = body.description || null;
      if (body.due_date !== undefined) patch.due_date = body.due_date || null;
      if (body.is_public !== undefined) patch.is_public = !!body.is_public;
      if (body.is_completed !== undefined) {
        patch.is_completed = !!body.is_completed;
        patch.completed_at = body.is_completed ? new Date().toISOString() : null;
        const member = myMembers.find((m) => m.department_id === existing.department_id) || firstMember;
        patch.completed_by_member_id = body.is_completed ? member.id : null;
      }
      const { error } = await supabase.from("department_todos").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }
    if (action === "delete_todo") {
      const id = String(body.id || "");
      const { data: existing } = await supabase.from("department_todos").select("id, department_id, created_by_member_id").eq("id", id).single();
      if (!existing) return json({ error: "Not found" }, 404);
      if (!canEditAny(existing.created_by_member_id)) return json({ error: "Only the creator can delete" }, 403);
      const { error } = await supabase.from("department_todos").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e.message || "Server error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
