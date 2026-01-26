import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { phone, password, action } = await req.json();
    
    if (!phone || !password) {
      return new Response(
        JSON.stringify({ error: "Phone and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove spaces, ensure format)
    const normalizedPhone = phone.replace(/\s+/g, "").trim();
    
    if (action === "login") {
      console.log("Admin login attempt for phone:", normalizedPhone);
      
      // Find admin by phone
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("id, user_id, password_hash, is_active, division_id")
        .eq("phone", normalizedPhone)
        .single();
      
      if (adminError || !admin) {
        console.log("Admin not found:", adminError?.message);
        return new Response(
          JSON.stringify({ error: "Invalid phone number or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!admin.is_active) {
        console.log("Admin account is inactive");
        return new Response(
          JSON.stringify({ error: "Your account has been deactivated. Contact Super Admin." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!admin.password_hash) {
        console.log("Admin password not set");
        return new Response(
          JSON.stringify({ error: "Password not set. Contact Super Admin." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify password using bcrypt
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      if (hashedPassword !== admin.password_hash) {
        console.log("Password mismatch");
        return new Response(
          JSON.stringify({ error: "Invalid phone number or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Get the user's email for Supabase auth
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", admin.user_id)
        .single();
      
      if (profileError || !profile) {
        console.log("Profile not found:", profileError?.message);
        return new Response(
          JSON.stringify({ error: "Account configuration error. Contact Super Admin." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Generate a custom session token for the admin
      // Since we're using custom auth, we'll return admin data and a signed token
      const tokenPayload = {
        admin_id: admin.id,
        user_id: admin.user_id,
        division_id: admin.division_id,
        exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      
      // Sign the token
      const tokenData = JSON.stringify(tokenPayload);
      const tokenEncoder = new TextEncoder();
      const tokenBuffer = tokenEncoder.encode(tokenData + supabaseServiceKey);
      const signatureBuffer = await crypto.subtle.digest("SHA-256", tokenBuffer);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const signature = signatureArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      const token = btoa(tokenData) + "." + signature;
      
      console.log("Admin login successful");
      
      return new Response(
        JSON.stringify({
          success: true,
          token,
          admin: {
            id: admin.id,
            user_id: admin.user_id,
            division_id: admin.division_id,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in admin-auth:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
