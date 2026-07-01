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
    const expected = await sha256Hex(data + secret);
    if (expected !== sig) return null;
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
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;

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

      const password_hash = await sha256Hex(password + ":" + secret.slice(0, 16));
      if (password_hash !== auth.password_hash) {
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
      if (oldHash !== auth.password_hash) return json({ error: "Current password is incorrect" }, 401);

      const newHash = await sha256Hex(newPw + ":" + secret.slice(0, 16));
      await supabase.from("agent_auth").update({ password_hash: newHash }).eq("id", auth.id);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("samrabhaka-auth error:", e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});