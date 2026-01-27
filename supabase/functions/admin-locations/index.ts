import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const adminToken = req.headers.get("x-admin-token");
    
    // Validate admin token if provided
    if (adminToken) {
      try {
        const [payload] = adminToken.split(".");
        const decoded = JSON.parse(atob(payload));
        if (!decoded.exp || decoded.exp < Date.now()) {
          return new Response(
            JSON.stringify({ error: "Admin token expired" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid admin token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "panchayaths";
    const action = url.searchParams.get("action") || "list";

    console.log(`Admin locations request: ${action} ${resource}`);

    // Handle different resources
    if (resource === "panchayaths") {
      if (req.method === "GET" || action === "list") {
        const { data, error } = await supabase
          .from("panchayaths")
          .select("*")
          .order("name");

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (req.method === "POST" && action === "create") {
        const body = await req.json();
        const { data, error } = await supabase
          .from("panchayaths")
          .insert(body)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (req.method === "PATCH" && action === "update") {
        const body = await req.json();
        const { id, ...updates } = body;
        
        const { data, error } = await supabase
          .from("panchayaths")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (resource === "clusters") {
      if (req.method === "GET" || action === "list") {
        const { data, error } = await supabase
          .from("clusters")
          .select(`
            *,
            panchayath:panchayaths(name)
          `)
          .order("name");

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (req.method === "POST" && action === "create") {
        const body = await req.json();
        const { data, error } = await supabase
          .from("clusters")
          .insert(body)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (req.method === "PATCH" && action === "update") {
        const body = await req.json();
        const { id, ...updates } = body;
        
        const { data, error } = await supabase
          .from("clusters")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid resource or action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Admin locations error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
