import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("add"), member_agent_id: z.string().uuid(), parent_member_agent_id: z.string().uuid().nullable() }),
  z.object({ action: z.literal("remove"), member_agent_id: z.string().uuid() }),
  z.object({ action: z.literal("move"), member_agent_id: z.string().uuid(), parent_member_agent_id: z.string().uuid().nullable() }),
  z.object({ action: z.literal("reorder"), ordered_member_ids: z.array(z.string().uuid()).max(500) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const mobile = (req.headers.get("x-caller-mobile") || "").replace(/\D/g, "");
    if (mobile.length !== 10) return json({ error: "Mobile number required" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: owners } = await sb
      .from("pennyekart_agents")
      .select("id, role, panchayath_id, responsible_panchayath_ids")
      .eq("mobile", mobile)
      .eq("is_active", true)
      .limit(1);
    const owner = owners?.[0];
    if (!owner) return json({ error: "Not an active agent" }, 403);

    const scope: string[] = owner.responsible_panchayath_ids?.length ? owner.responsible_panchayath_ids : [owner.panchayath_id];

    const loadRows = async () => {
      const { data, error } = await sb
        .from("agent_custom_team")
        .select("member_agent_id, parent_member_agent_id, sort_order")
        .eq("owner_agent_id", owner.id)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    };

    if (body.action === "list") return json({ owner_id: owner.id, scope, rows: await loadRows() });

    const rows = await loadRows();
    const memberIds = new Set(rows.map((r) => r.member_agent_id));
    const validParent = (p: string | null) => p === null || memberIds.has(p);

    if (body.action === "add") {
      if (body.member_agent_id === owner.id) return json({ error: "You cannot add yourself" }, 400);
      if (memberIds.has(body.member_agent_id)) return json({ error: "Already in your team" }, 400);
      if (!validParent(body.parent_member_agent_id)) return json({ error: "Invalid placement" }, 400);
      const { data: m } = await sb
        .from("pennyekart_agents")
        .select("id, panchayath_id, responsible_panchayath_ids, is_active")
        .eq("id", body.member_agent_id)
        .maybeSingle();
      if (!m || !m.is_active) return json({ error: "Agent not found" }, 404);
      const mScope: string[] = m.responsible_panchayath_ids?.length ? m.responsible_panchayath_ids : [m.panchayath_id];
      if (!mScope.some((id) => scope.includes(id))) return json({ error: "Agent is not in your allocated panchayaths" }, 403);
      const { error } = await sb.from("agent_custom_team").insert({
        owner_agent_id: owner.id,
        member_agent_id: body.member_agent_id,
        parent_member_agent_id: body.parent_member_agent_id,
        sort_order: rows.length,
      });
      if (error) throw error;
    }

    if (body.action === "remove") {
      const row = rows.find((r) => r.member_agent_id === body.member_agent_id);
      if (!row) return json({ error: "Not in your team" }, 404);
      await sb.from("agent_custom_team")
        .update({ parent_member_agent_id: row.parent_member_agent_id })
        .eq("owner_agent_id", owner.id)
        .eq("parent_member_agent_id", body.member_agent_id);
      await sb.from("agent_custom_team").delete().eq("owner_agent_id", owner.id).eq("member_agent_id", body.member_agent_id);
    }

    if (body.action === "move") {
      if (!memberIds.has(body.member_agent_id) || !validParent(body.parent_member_agent_id)) return json({ error: "Invalid move" }, 400);
      // prevent cycles
      const parentOf = new Map(rows.map((r) => [r.member_agent_id, r.parent_member_agent_id]));
      let cur = body.parent_member_agent_id;
      while (cur) {
        if (cur === body.member_agent_id) return json({ error: "Cannot place an agent under their own team member" }, 400);
        cur = parentOf.get(cur) ?? null;
      }
      await sb.from("agent_custom_team")
        .update({ parent_member_agent_id: body.parent_member_agent_id })
        .eq("owner_agent_id", owner.id)
        .eq("member_agent_id", body.member_agent_id);
    }

    if (body.action === "reorder") {
      for (let i = 0; i < body.ordered_member_ids.length; i++) {
        const id = body.ordered_member_ids[i];
        if (!memberIds.has(id)) continue;
        await sb.from("agent_custom_team").update({ sort_order: i }).eq("owner_agent_id", owner.id).eq("member_agent_id", id);
      }
    }

    return json({ owner_id: owner.id, scope, rows: await loadRows() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
