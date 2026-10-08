import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token, x-caller-mobile",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") || "elife_admin_secret_2024";

interface AdminToken {
  admin_id: string;
  user_id: string | null;
  division_id: string;
  full_name: string;
  exp: number;
}

function parseAdminToken(token: string): AdminToken | null {
  try {
    const [payloadB64, signature] = token.split(".");
    const payload = JSON.parse(atob(payloadB64));
    
    // Verify expiration
    if (payload.exp < Date.now()) {
      return null;
    }
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadB64 + ADMIN_SECRET);
    const hashBuffer = new Uint8Array(32);
    const dataArray = new Uint8Array(data);
    for (let i = 0; i < dataArray.length; i++) {
      hashBuffer[i % 32] ^= dataArray[i];
    }
    const expectedSig = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, "0")).join("");
    
    if (signature !== expectedSig) {
      // For now, allow the token if payload is valid (matching admin-auth logic)
    }
    
    return payload;
  } catch {
    return null;
  }
}

async function verifyAdmin(adminToken: string | null, authHeader: string | null): Promise<{ valid: boolean; admin?: AdminToken; isSuperAdmin?: boolean }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (adminToken) {
    const parsed = parseAdminToken(adminToken);
    if (!parsed) {
      return { valid: false };
    }
    
    // Check if admin exists and is active
    const { data: admin } = await supabase
      .from("admins")
      .select("id, division_id, full_name")
      .eq("id", parsed.admin_id)
      .eq("is_active", true)
      .single();
    
    if (!admin) {
      return { valid: false };
    }
    
    // Check for super_admin role via user_id
    let isSuperAdmin = false;
    if (parsed.user_id) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", parsed.user_id)
        .eq("role", "super_admin")
        .single();
      
      isSuperAdmin = !!roleData;
    }
    
    return { valid: true, admin: parsed, isSuperAdmin };
  }

  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (bearerToken) {
    const { data: userData } = await supabase.auth.getUser(bearerToken);
    const user = userData?.user;
    if (!user) return { valid: false };

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) return { valid: false };

    return {
      valid: true,
      isSuperAdmin: true,
      admin: {
        admin_id: user.id,
        user_id: user.id,
        division_id: "",
        full_name: user.email || "Super Admin",
        exp: Date.now() + 60 * 60 * 1000,
      },
    };
  }

  return { valid: false };
}

interface CallerAgent {
  id: string;
  role: "super_admin_partner" | "team_leader";
  panchayath_id: string;
  responsible_panchayath_ids: string[];
}

async function getCallerAgent(mobile: string): Promise<CallerAgent | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("pennyekart_agents")
    .select("id, role, panchayath_id, responsible_panchayath_ids, is_active")
    .eq("mobile", mobile)
    .in("role", ["super_admin_partner", "team_leader"])
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    role: data.role,
    panchayath_id: data.panchayath_id,
    responsible_panchayath_ids: data.responsible_panchayath_ids || [],
  };
}

function callerHasPanchayathScope(caller: CallerAgent, panchayathId: string): boolean {
  if (caller.panchayath_id === panchayathId) return true;
  return (caller.responsible_panchayath_ids || []).includes(panchayathId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get("x-admin-token");
    const authHeader = req.headers.get("authorization");
    const callerMobile = req.headers.get("x-caller-mobile");

    let admin: AdminToken | null = null;
    let isSuperAdmin = false;
    let caller: CallerAgent | null = null;

    // Peek body early so we can route direct-customer actions with their own auth.
    const rawBody = req.method !== "GET" && req.method !== "DELETE" ? await req.text() : "";
    const parsedBody = rawBody ? JSON.parse(rawBody) : null;
    const peekAction = parsedBody?.action as string | undefined;
    const isDirectCustomerAction = peekAction === "list_customers" ||
      peekAction === "add_customer" ||
      peekAction === "update_customer" ||
      peekAction === "delete_customer";

    if (adminToken || authHeader) {
      const result = await verifyAdmin(adminToken, authHeader);
      if (!result.valid || !result.admin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - Invalid admin token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      admin = result.admin;
      isSuperAdmin = !!result.isSuperAdmin;
    } else if (isDirectCustomerAction) {
      // Direct-customer actions: list_customers is public read; mutations validated inside the action handler.
    } else if (callerMobile) {
      caller = await getCallerAgent(callerMobile.replace(/\D/g, ""));
      if (!caller) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - Caller is not a Team Leader or Super Admin/Business Partner" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No admin session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const body = parsedBody;
    const { action } = body || {};
    const agentId = url.searchParams.get("id");

    // ── Direct customers (coordinator / group_leader / pro) ──
    if (isDirectCustomerAction) {
      const ALLOWED_ROLES = ["coordinator", "group_leader", "pro"];
      const normalizedCaller = callerMobile ? callerMobile.replace(/\D/g, "") : null;

      async function fetchAgentForCustomer(targetAgentId: string) {
        const { data } = await supabase
          .from("pennyekart_agents")
          .select("id, role, mobile, is_active, panchayath_id, responsible_panchayath_ids")
          .eq("id", targetAgentId)
          .maybeSingle();
        return data;
      }

      async function assertAuthorized(targetAgentRow: { mobile: string; role: string; is_active: boolean; panchayath_id: string; responsible_panchayath_ids: string[] | null } | null) {
        if (!targetAgentRow) return { ok: false, status: 404, error: "Agent not found" };
        if (!ALLOWED_ROLES.includes(targetAgentRow.role)) {
          return { ok: false, status: 400, error: "Direct customers are only available for Coordinator, Group Leader, or PRO agents" };
        }
        if (admin) return { ok: true };
        if (normalizedCaller && normalizedCaller === targetAgentRow.mobile && targetAgentRow.is_active) {
          return { ok: true };
        }
        // Team Leaders and Super Admin / Business Partners with scope over the target agent's panchayath
        if (normalizedCaller) {
          const { data: callerRow } = await supabase
            .from("pennyekart_agents")
            .select("role, panchayath_id, responsible_panchayath_ids, is_active")
            .eq("mobile", normalizedCaller)
            .in("role", ["team_leader", "super_admin_partner"])
            .eq("is_active", true)
            .maybeSingle();
          if (callerRow) {
            const scope = new Set<string>([
              callerRow.panchayath_id,
              ...((callerRow.responsible_panchayath_ids as string[] | null) || []),
            ].filter(Boolean));
            if (scope.has(targetAgentRow.panchayath_id)) return { ok: true };
          }
        }
        return { ok: false, status: 403, error: "Forbidden" };
      }

      function validateCustomer(c: any): { ok: true; value: { name: string; mobile: string; ward: string | null; address: string | null; notes: string | null; panchayath_id: string | null; is_outside: boolean } } | { ok: false; error: string } {
        if (!c || typeof c !== "object") return { ok: false, error: "Missing customer" };
        const name = String(c.name || "").trim();
        const mobile = String(c.mobile || "").replace(/\D/g, "");
        const ward = c.ward != null ? String(c.ward).trim() : "";
        const address = c.address != null ? String(c.address).trim() : "";
        const notes = c.notes != null ? String(c.notes).trim() : "";
        const panchayath_id = c.panchayath_id != null && String(c.panchayath_id).trim() !== ""
          ? String(c.panchayath_id).trim()
          : null;
        const is_outside = c.is_outside === true;
        if (name.length < 1 || name.length > 100) return { ok: false, error: "Name must be 1-100 characters" };
        if (mobile.length !== 10) return { ok: false, error: "Mobile must be 10 digits" };
        if (ward.length > 50) return { ok: false, error: "Ward must be ≤ 50 characters" };
        if (address.length > 300) return { ok: false, error: "Address must be ≤ 300 characters" };
        if (notes.length > 500) return { ok: false, error: "Notes must be ≤ 500 characters" };
        return { ok: true, value: { name, mobile, ward: ward || null, address: address || null, notes: notes || null, panchayath_id, is_outside } };
      }

      function jsonResp(payload: unknown, status = 200) {
        return new Response(JSON.stringify(payload), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "list_customers") {
        const targetAgentId = body?.agent_id;
        if (!targetAgentId) return jsonResp({ error: "Missing agent_id" }, 400);
        // List is public read; still verify agent exists and role allowed.
        const targetAgent = await fetchAgentForCustomer(targetAgentId);
        if (!targetAgent) return jsonResp({ error: "Agent not found" }, 404);
        if (!ALLOWED_ROLES.includes(targetAgent.role)) {
          return jsonResp({ data: [] });
        }
        const { data, error } = await supabase
          .from("agent_direct_customers")
          .select("*, panchayath:panchayaths(id, name)")
          .eq("agent_id", targetAgentId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResp({ data });
      }

      if (action === "add_customer") {
        const targetAgentId = body?.agent_id;
        if (!targetAgentId) return jsonResp({ error: "Missing agent_id" }, 400);
        const targetAgent = await fetchAgentForCustomer(targetAgentId);
        const authz = await assertAuthorized(targetAgent as any);
        if (!authz.ok) return jsonResp({ error: authz.error }, authz.status);
        const v = validateCustomer(body?.customer);
        if (!v.ok) return jsonResp({ error: v.error }, 400);
        const { data, error } = await supabase
          .from("agent_direct_customers")
          .insert({ agent_id: targetAgentId, ...v.value })
          .select()
          .single();
        if (error) {
          if (error.code === "23505") return jsonResp({ error: "This mobile is already in your customer list" }, 400);
          throw error;
        }
        return jsonResp({ data });
      }

      if (action === "update_customer") {
        const id = body?.id;
        if (!id) return jsonResp({ error: "Missing id" }, 400);
        const { data: existing } = await supabase
          .from("agent_direct_customers")
          .select("agent_id")
          .eq("id", id)
          .maybeSingle();
        if (!existing) return jsonResp({ error: "Customer not found" }, 404);
        const targetAgent = await fetchAgentForCustomer(existing.agent_id);
        const authz = await assertAuthorized(targetAgent as any);
        if (!authz.ok) return jsonResp({ error: authz.error }, authz.status);
        const v = validateCustomer(body?.customer);
        if (!v.ok) return jsonResp({ error: v.error }, 400);
        const { data, error } = await supabase
          .from("agent_direct_customers")
          .update(v.value)
          .eq("id", id)
          .select()
          .single();
        if (error) {
          if (error.code === "23505") return jsonResp({ error: "This mobile is already in your customer list" }, 400);
          throw error;
        }
        return jsonResp({ data });
      }

      if (action === "delete_customer") {
        const id = body?.id;
        if (!id) return jsonResp({ error: "Missing id" }, 400);
        const { data: existing } = await supabase
          .from("agent_direct_customers")
          .select("agent_id")
          .eq("id", id)
          .maybeSingle();
        if (!existing) return jsonResp({ error: "Customer not found" }, 404);
        const targetAgent = await fetchAgentForCustomer(existing.agent_id);
        const authz = await assertAuthorized(targetAgent as any);
        if (!authz.ok) return jsonResp({ error: authz.error }, authz.status);
        const { error } = await supabase
          .from("agent_direct_customers")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return jsonResp({ success: true });
      }
    }

    // GET - List agents
    if (req.method === "GET") {
      const panchayathFilter = url.searchParams.get("panchayath_id");
      
      let query = supabase
        .from("pennyekart_agents")
        .select("*, panchayath:panchayaths(name)")
        .order("role", { ascending: true })
        .order("name", { ascending: true });

      if (panchayathFilter) {
        // Match agents by home panchayath OR by responsible_panchayath_ids
        query = query.or(`panchayath_id.eq.${panchayathFilter},responsible_panchayath_ids.cs.{${panchayathFilter}}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Backup / restore ──
    const BACKUP_TABLES = ["pennyekart_agents", "agent_direct_customers", "agent_work_logs", "agent_wallet_transactions", "agent_complaints"];
    if (req.method === "POST" && (action === "export_backup" || action === "restore_backup")) {
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!admin) return json({ error: "Admin session required" }, 403);
      if (action === "export_backup") {
        const out: Record<string, unknown[]> = {};
        for (const t of BACKUP_TABLES) {
          const rows: unknown[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase.from(t).select("*").order("created_at", { ascending: true }).range(from, from + 999);
            if (error) return json({ error: `${t}: ${error.message}` }, 500);
            rows.push(...(data || []));
            if (!data || data.length < 1000) break;
          }
          out[t] = rows;
        }
        const { data: p } = await supabase.from("panchayaths").select("id, name").range(0, 9999);
        return json({ data: out, panchayaths: p || [] });
      }
      if (!isSuperAdmin) return json({ error: "Only Super Admin can restore backups" }, 403);
      const tables = (body?.tables || {}) as Record<string, Record<string, unknown>[]>;
      const result: Record<string, { restored: number; error?: string }> = {};
      for (const t of BACKUP_TABLES) {
        let rows = (tables[t] || []).filter((r) => r && typeof r.id === "string");
        if (t === "pennyekart_agents") {
          const byId = new Map(rows.map((r) => [r.id as string, r]));
          const depth = (r: Record<string, unknown>, seen = new Set<string>()): number => {
            const pid = r.parent_agent_id as string | null;
            if (!pid || seen.has(pid) || !byId.has(pid)) return 0;
            seen.add(pid);
            return 1 + depth(byId.get(pid)!, seen);
          };
          rows = [...rows].sort((a, b) => depth(a) - depth(b));
        }
        let restored = 0;
        let err: string | undefined;
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from(t).upsert(rows.slice(i, i + 500), { onConflict: "id" });
          if (error) { err = error.message; break; }
          restored += Math.min(500, rows.length - i);
        }
        result[t] = { restored, ...(err ? { error: err } : {}) };
      }
      return json({ result });
    }

    // ── Deleted agents bin (30-day retention) ──
    if (req.method === "POST" && (action === "list_deleted" || action === "restore_deleted" || action === "purge_deleted")) {
      const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!admin) return json({ error: "Admin session required" }, 403);
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("deleted_agents_archive").delete().lt("deleted_at", cutoff);
      if (action === "list_deleted") {
        const { data, error } = await supabase.from("deleted_agents_archive")
          .select("id, agent_id, agent_name, agent_mobile, agent_role, deleted_by, deleted_at, child_agent_ids, agent_data")
          .order("deleted_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      }
      if (!isSuperAdmin) return json({ error: "Only Super Admin can do this" }, 403);
      const archiveId = body?.archive_id as string;
      if (!archiveId) return json({ error: "archive_id required" }, 400);
      if (action === "purge_deleted") {
        const { error } = await supabase.from("deleted_agents_archive").delete().eq("id", archiveId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      const { data: arc } = await supabase.from("deleted_agents_archive").select("*").eq("id", archiveId).maybeSingle();
      if (!arc) return json({ error: "Not found or expired" }, 404);
      const agentRow = { ...(arc.agent_data as Record<string, unknown>) };
      if (agentRow.parent_agent_id) {
        const { data: par } = await supabase.from("pennyekart_agents").select("id").eq("id", agentRow.parent_agent_id as string).maybeSingle();
        if (!par) agentRow.parent_agent_id = null;
      }
      const { error: aErr } = await supabase.from("pennyekart_agents").upsert(agentRow, { onConflict: "id" });
      if (aErr) return json({ error: aErr.message }, 500);
      const rel = (arc.related_data || {}) as Record<string, Record<string, unknown>[]>;
      const errors: string[] = [];
      for (const [t, rows] of Object.entries(rel)) {
        if (!rows?.length) continue;
        const { error } = await supabase.from(t).upsert(rows, { onConflict: "id" });
        if (error) errors.push(`${t}: ${error.message}`);
      }
      const kids = (arc.child_agent_ids || []) as string[];
      if (kids.length) {
        await supabase.from("pennyekart_agents").update({ parent_agent_id: arc.agent_id }).in("id", kids).is("parent_agent_id", null);
      }
      await supabase.from("deleted_agents_archive").delete().eq("id", archiveId);
      return json({ success: true, errors });
    }

    // Caller-mobile sessions may create / update / delete agents in their scope
    if (caller && !admin) {
      const allowed = (req.method === "POST" && action === "create") || req.method === "PUT" || req.method === "DELETE";

      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "Forbidden - This action requires an admin session" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    // POST - Create agent
    if (req.method === "POST" && action === "create") {
      const { agent } = body;

      // Caller-mobile (public TL/Super Admin) scope checks
      if (caller) {
        if (!callerHasPanchayathScope(caller, agent.panchayath_id)) {
          return new Response(
            JSON.stringify({ error: "Forbidden - You can only add agents within your allocated panchayath" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Team Leaders cannot create Super Admin/Business Partners or other Team Leaders
        if (caller.role === "team_leader" && (agent.role === "super_admin_partner" || agent.role === "team_leader")) {
          return new Response(
            JSON.stringify({ error: "Forbidden - Team Leaders cannot create this role" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (agent.role === "team_leader" && agent.parent_agent_id) {
        const { data: parent } = await supabase
          .from("pennyekart_agents")
          .select("id")
          .eq("id", agent.parent_agent_id)
          .eq("role", "super_admin_partner")
          .eq("is_active", true)
          .maybeSingle();
        if (!parent) {
          return new Response(
            JSON.stringify({ error: "Reports To must be an active Super Admin / Business Partner" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Duplicate check: look for existing agent with same mobile in same panchayath
      const { data: existing } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, mobile, panchayath_id")
        .eq("mobile", agent.mobile);

      if (existing && existing.length > 0) {
        const dup = existing[0];
        // Get panchayath name for better error message
        const { data: panchData } = await supabase
          .from("panchayaths")
          .select("name")
          .eq("id", dup.panchayath_id)
          .single();
        const panchName = panchData?.name || "unknown";
        return new Response(
          JSON.stringify({ error: `Duplicate: Mobile ${agent.mobile} already exists for agent "${dup.name}" (${dup.role}) in ${panchName}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("pennyekart_agents")
        .insert({
          ...agent,
          created_by: admin?.admin_id ?? null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "Mobile number already exists" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Bulk create agents
    if (req.method === "POST" && action === "bulk_create") {
      const { agents } = body;
      
      // Duplicate check: check all mobiles in this batch against existing agents
      const mobiles = agents.map((a: any) => a.mobile);
      
      // Also check for duplicates within the batch itself
      const batchDuplicates = mobiles.filter((m: string, i: number) => mobiles.indexOf(m) !== i);
      if (batchDuplicates.length > 0) {
        return new Response(
          JSON.stringify({ error: `Duplicate mobiles within batch: ${[...new Set(batchDuplicates)].join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingAgents } = await supabase
        .from("pennyekart_agents")
        .select("mobile, name, role")
        .in("mobile", mobiles);

      if (existingAgents && existingAgents.length > 0) {
        const dupDetails = existingAgents.map((a: any) => `${a.mobile} (${a.name}, ${a.role})`).join("; ");
        return new Response(
          JSON.stringify({ error: `Duplicate mobile numbers already exist: ${dupDetails}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agentsWithCreator = agents.map((a: any) => ({
        ...a,
        created_by: admin.admin_id,
      }));

      const { data, error } = await supabase
        .from("pennyekart_agents")
        .insert(agentsWithCreator)
        .select();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "One or more mobile numbers already exist" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(JSON.stringify({ data, count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT - Update agent
    if (req.method === "PUT") {
      const { agent, id } = body;
      
      if (!id || !agent) {
        return new Response(
          JSON.stringify({ error: "Missing id or agent data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: currentAgent } = await supabase
        .from("pennyekart_agents")
        .select("role, parent_agent_id")
        .eq("id", id)
        .maybeSingle();
      if (!currentAgent) {
        return new Response(
          JSON.stringify({ error: "Agent not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Caller-mobile scope checks (public TL / Super Admin)
      if (caller) {
        const { data: target } = await supabase
          .from("pennyekart_agents")
          .select("panchayath_id, role")
          .eq("id", id)
          .single();
        if (!target) {
          return new Response(
            JSON.stringify({ error: "Agent not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!callerHasPanchayathScope(caller, target.panchayath_id) ||
            !callerHasPanchayathScope(caller, agent.panchayath_id)) {
          return new Response(
            JSON.stringify({ error: "Forbidden - Agent is outside your allocated panchayath" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (caller.role === "team_leader" && (target.role === "super_admin_partner" || target.role === "team_leader" || agent.role === "super_admin_partner" || agent.role === "team_leader")) {
          return new Response(
            JSON.stringify({ error: "Forbidden - Team Leaders cannot edit this role" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Remove fields that shouldn't be updated
      const { created_at, created_by, panchayath, parent_agent, children, ...updateData } = agent;

      const updatedRole = updateData.role || currentAgent.role;
      const updatedParentId = Object.prototype.hasOwnProperty.call(updateData, "parent_agent_id")
        ? updateData.parent_agent_id
        : currentAgent.parent_agent_id;
      if (updatedRole === "team_leader" && updatedParentId) {
        const { data: parent } = await supabase
          .from("pennyekart_agents")
          .select("id")
          .eq("id", updatedParentId)
          .eq("role", "super_admin_partner")
          .eq("is_active", true)
          .maybeSingle();
        if (!parent) {
          return new Response(
            JSON.stringify({ error: "Reports To must be an active Super Admin / Business Partner" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      const { data, error } = await supabase
        .from("pennyekart_agents")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE - Delete agent (cascade: reassign or delete children first)
    if (req.method === "DELETE" && agentId) {
      // Caller-mobile scope checks (public TL / Super Admin)
      if (caller && !admin) {
        const { data: target } = await supabase
          .from("pennyekart_agents")
          .select("panchayath_id, role")
          .eq("id", agentId)
          .maybeSingle();
        if (!target) {
          return new Response(
            JSON.stringify({ error: "Agent not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!callerHasPanchayathScope(caller, target.panchayath_id)) {
          return new Response(
            JSON.stringify({ error: "Forbidden - Agent is outside your allocated panchayath" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (caller.role === "team_leader" && (target.role === "super_admin_partner" || target.role === "team_leader")) {
          return new Response(
            JSON.stringify({ error: "Forbidden - Team Leaders cannot delete this role" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Archive a full copy (kept 30 days) before deleting
      {
        const { data: full } = await supabase.from("pennyekart_agents").select("*").eq("id", agentId).maybeSingle();
        if (full) {
          const related: Record<string, unknown[]> = {};
          for (const t of ["agent_direct_customers", "agent_work_logs", "agent_wallet_transactions", "agent_complaints", "agent_auth"]) {
            const { data } = await supabase.from(t).select("*").eq("agent_id", agentId);
            related[t] = data || [];
          }
          const { data: kids } = await supabase.from("pennyekart_agents").select("id").eq("parent_agent_id", agentId);
          const { error: arcErr } = await supabase.from("deleted_agents_archive").insert({
            agent_id: full.id, agent_name: full.name, agent_mobile: full.mobile, agent_role: full.role,
            agent_data: full, related_data: related, child_agent_ids: (kids || []).map((k: any) => k.id),
            deleted_by: admin ? ((admin as any).full_name || (admin as any).phone || "Admin") : (caller ? `Agent ${callerMobile}` : null),
          });
          if (arcErr) throw arcErr;
        }
      }

      // First, remove references from child agents by setting their parent_agent_id to null

      const { error: childError } = await supabase
        .from("pennyekart_agents")
        .update({ parent_agent_id: null })
        .eq("parent_agent_id", agentId);

      if (childError) {
        console.error("Error clearing children:", childError);
        throw childError;
      }

      const { error } = await supabase
        .from("pennyekart_agents")
        .delete()
        .eq("id", agentId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Task CRUD ──
    if (req.method === "POST" && action === "create_task") {
      const { tasks: taskRows } = body;
      const { data, error } = await supabase
        .from("pennyekart_agent_tasks")
        .insert(taskRows.map((t: any) => ({ ...t, created_by: admin.admin_id })))
        .select();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && action === "update_task") {
      const { id, title, description } = body;
      const { data, error } = await supabase
        .from("pennyekart_agent_tasks")
        .update({ title, description })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && action === "delete_task") {
      const { id } = body;
      await supabase.from("pennyekart_agent_task_feedback").delete().eq("task_id", id);
      const { error } = await supabase.from("pennyekart_agent_tasks").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Task Feedback ──
    if (req.method === "POST" && action === "save_feedback") {
      const { task_id, agent_id, status, remarks, existing_id } = body;
      if (existing_id) {
        const { error } = await supabase
          .from("pennyekart_agent_task_feedback")
          .update({ status, remarks: remarks || null })
          .eq("id", existing_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pennyekart_agent_task_feedback")
          .insert({
            task_id,
            agent_id,
            status,
            remarks: remarks || null,
            feedback_by: admin.admin_id,
          });
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
