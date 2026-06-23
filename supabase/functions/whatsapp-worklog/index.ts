import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CORE_HELP = `📋 *PennyeKart Agent Commands*

1️⃣ <your work details>
  Submit your daily work log.
  Example: _1 Visited 5 shops in Ward 3, collected 2 orders_

2️⃣
  View your reporting person details.

3️⃣ ?
  Check your complaint status & admin remarks.

3️⃣ <your complaint>
  Register a new complaint.
  Example: _3 Delivery not received for order #123_

4️⃣
  Check your wallet balance.

5️⃣
  Today's work log absence report (all agents).

6️⃣
  Coordinator absence report (by panchayath).

7️⃣
  Group Leader absence report (by panchayath).

8️⃣
  Show this help message.`;

function buildHelpText(customCommands: Array<{ keyword: string; label: string }>) {
  let help = CORE_HELP;
  for (const cmd of customCommands) {
    help += `\n\n${cmd.keyword}️⃣\n  ${cmd.label}`;
  }
  help += `\n\n💡 *Tips:*
• Send *1* followed by your work to log it.
• You can send multiple reports in a day — they will be appended.
• Your work logs are tracked daily by your team leader.`;
  return help;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function twiml(msg: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(msg)}</Message></Response>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } }
  );
}

const roleLabels: Record<string, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO",
};

async function buildAbsenceReport(
  supabase: ReturnType<typeof createClient>,
  today: string,
  roleFilter?: string,
  panchayathId?: string,
) {
  let agentQuery = supabase
    .from("pennyekart_agents")
    .select("id, name, mobile, role, panchayath_id, ward, panchayath:panchayaths(name)")
    .eq("is_active", true);

  if (roleFilter) {
    agentQuery = agentQuery.eq("role", roleFilter);
  }
  if (panchayathId) {
    agentQuery = agentQuery.eq("panchayath_id", panchayathId);
  }

  const { data: agents, error: agentErr } = await agentQuery;
  if (agentErr) throw agentErr;
  if (!agents || agents.length === 0) return "No agents found for this filter.";

  // Get today's logs for these agents
  const agentIds = agents.map((a: any) => a.id);
  const { data: logs } = await supabase
    .from("agent_work_logs")
    .select("agent_id")
    .eq("work_date", today)
    .in("agent_id", agentIds);

  const submittedIds = new Set((logs || []).map((l: any) => l.agent_id));
  const absent = agents.filter((a: any) => !submittedIds.has(a.id));
  const submitted = agents.filter((a: any) => submittedIds.has(a.id));

  const total = agents.length;
  const submittedCount = submitted.length;
  const absentCount = absent.length;
  const rate = total > 0 ? Math.round((submittedCount / total) * 100) : 0;

  let msg = `📊 *Work Log Report — ${today}*\n`;
  if (roleFilter) msg += `🏷️ Role: ${roleLabels[roleFilter] || roleFilter}\n`;

  const panchName = panchayathId && agents[0]?.panchayath?.name;
  if (panchName) msg += `📍 Panchayath: ${panchName}\n`;

  msg += `\n✅ Submitted: ${submittedCount}/${total} (${rate}%)\n❌ Absent: ${absentCount}\n`;

  const MAX_ABSENT_SHOW = 15;
  if (absentCount > 0) {
    msg += `\n❌ *Absent:*`;
    const showAbsent = absent.slice(0, MAX_ABSENT_SHOW);
    for (const a of showAbsent) {
      msg += `\n• ${a.name} — ${a.mobile}`;
    }
    if (absentCount > MAX_ABSENT_SHOW) {
      msg += `\n...+${absentCount - MAX_ABSENT_SHOW} more`;
    }
  }

  return msg;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string)?.trim();

    if (!from || !body) {
      return twiml("Missing message content.");
    }

    const phoneRaw = from.replace("whatsapp:", "").trim();
    const last10 = phoneRaw.replace(/\D/g, "").slice(-10);
    const command = body.trim();

    console.log(`WhatsApp from ${phoneRaw}: ${body.substring(0, 100)}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch custom commands for help & matching
    const { data: customCommands } = await supabase
      .from("whatsapp_bot_commands")
      .select("keyword, alt_keyword, label, response_text")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const activeCustom = customCommands || [];

    // Handle help before agent lookup
    if (command === "8" || command.toLowerCase() === "help" || command.toLowerCase() === "hi" || command.toLowerCase() === "hello") {
      return twiml(buildHelpText(activeCustom));
    }

    // Find agent
    let { data: agent } = await supabase
      .from("pennyekart_agents")
      .select("id, name, mobile, role, parent_agent_id")
      .eq("mobile", last10)
      .eq("is_active", true)
      .maybeSingle();

    if (!agent) {
      const { data: agent2 } = await supabase
        .from("pennyekart_agents")
        .select("id, name, mobile, role, parent_agent_id")
        .eq("mobile", phoneRaw)
        .eq("is_active", true)
        .maybeSingle();
      agent = agent2;
    }

    if (!agent) {
      return twiml(`❌ Your number is not registered as an agent. Please contact your team leader.\n\nType *3* for help.`);
    }

    const today = new Date().toISOString().split("T")[0];

    // --- COMMAND: 2 = reporting person details ---
    if (command === "2" || command.toLowerCase() === "status") {
      const hierarchy: Array<{ name: string; mobile: string; role: string }> = [];
      let currentParentId = agent.parent_agent_id;
      let depth = 0;

      while (currentParentId && depth < 5) {
        const { data: parent } = await supabase
          .from("pennyekart_agents")
          .select("id, name, mobile, role, parent_agent_id")
          .eq("id", currentParentId)
          .eq("is_active", true)
          .maybeSingle();

        if (!parent) break;
        hierarchy.push({ name: parent.name, mobile: parent.mobile, role: parent.role });
        currentParentId = parent.parent_agent_id;
        depth++;
      }

      if (hierarchy.length === 0) {
        return twiml(`👤 *${agent.name}* (${roleLabels[agent.role] || agent.role})\n\nNo reporting person found. You may be a top-level agent.`);
      }

      let msg = `👤 *Your Reporting Chain*\n🏷️ ${agent.name} (${roleLabels[agent.role] || agent.role})\n`;
      for (const h of hierarchy) {
        msg += `\n⬆️ *${roleLabels[h.role] || h.role}*\n   ${h.name}\n   📞 ${h.mobile}`;
      }

      return twiml(msg);
    }

    // --- COMMAND: 3 ? or 3 alone = check complaint status ---
    const isStatusCheck = command === "3" || /^3\s*\?$/i.test(command);

    if (!isStatusCheck) {
      // --- COMMAND: 3 <text> = register complaint ---
      const complaintMatch = body.match(/^3\s+(.+)/is);
      if (complaintMatch) {
        const complaintText = complaintMatch[1].trim();

        if (!complaintText) {
          return twiml(`⚠️ Please include your complaint details after *3*.\n\nExample: _3 Delivery not received for order #123_`);
        }

        const { error } = await supabase
          .from("agent_complaints")
          .insert({
            agent_id: agent.id,
            complaint_text: complaintText,
          });

        if (error) {
          console.error("Complaint insert error:", error);
          return twiml("❌ Failed to register complaint. Please try again.");
        }

        return twiml(`✅ Complaint registered, ${agent.name}!\n\n📝 ${complaintText}\n\nYour complaint has been submitted and will be reviewed by the admin team.\n\nSend *3 ?* to check your complaint status.`);
      }
    }

    if (isStatusCheck) {
      // Show complaint status
      const { data: myComplaints, error: cErr } = await supabase
        .from("agent_complaints")
        .select("complaint_text, status, admin_remarks, created_at, updated_at")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (cErr) {
        console.error("Complaint fetch error:", cErr);
        return twiml("❌ Failed to fetch complaints. Please try again.");
      }

      if (!myComplaints || myComplaints.length === 0) {
        return twiml(`📋 *Complaint Status*\n\nNo complaints found, ${agent.name}.\n\nTo register a new complaint, send:\n_3 <your complaint>_`);
      }

      const statusEmoji: Record<string, string> = { pending: "⏳", resolved: "✅", dismissed: "❌" };
      let msg = `📋 *Your Recent Complaints*\n👤 ${agent.name}\n`;

      for (const c of myComplaints) {
        const date = new Date(c.created_at).toLocaleDateString("en-IN");
        const emoji = statusEmoji[c.status] || "❓";
        msg += `\n${emoji} *${c.status.toUpperCase()}* — ${date}`;
        msg += `\n   📝 ${c.complaint_text.substring(0, 80)}${c.complaint_text.length > 80 ? "..." : ""}`;
        if (c.admin_remarks) {
          msg += `\n   💬 _${c.admin_remarks}_`;
        }
      }

      msg += `\n\n📌 To register a new complaint:\n_3 <your complaint>_`;
      return twiml(msg);
    }

    // --- COMMAND: 1 = report ---
    const reportMatch = body.match(/^1\s+(.+)/is);
    if (reportMatch) {
      const workDetails = reportMatch[1].trim();

      if (!workDetails) {
        return twiml(`⚠️ Please include your work details after *1*.\n\nExample: _1 Visited 5 shops, collected 3 orders_`);
      }

      const { data: existingLog } = await supabase
        .from("agent_work_logs")
        .select("id, work_details")
        .eq("agent_id", agent.id)
        .eq("work_date", today)
        .maybeSingle();

      if (existingLog) {
        const updatedDetails = `${existingLog.work_details}\n${workDetails}`;
        const { error } = await supabase
          .from("agent_work_logs")
          .update({ work_details: updatedDetails })
          .eq("id", existingLog.id);

        if (error) {
          return twiml("❌ Failed to update work log. Please try again.");
        }

        return twiml(`✅ Work log updated, ${agent.name}!\n\n📅 ${today}\n📝 Today's full log:\n${updatedDetails}`);
      } else {
        const { error } = await supabase
          .from("agent_work_logs")
          .insert({
            agent_id: agent.id,
            work_details: workDetails,
            work_date: today,
          });

        if (error) {
          return twiml("❌ Failed to save work log. Please try again.");
        }

        return twiml(`✅ Work log saved, ${agent.name}!\n\n📅 ${today}\n📝 ${workDetails}`);
      }
    }

    // --- COMMAND: 4 = wallet balance ---
    if (command === "4" || command.toLowerCase() === "balance") {
      const { data: transactions, error: walletError } = await supabase
        .from("agent_wallet_transactions")
        .select("amount")
        .eq("agent_id", agent.id);

      if (walletError) {
        return twiml("❌ Failed to fetch wallet balance. Please try again.");
      }

      const balance = (transactions || []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
      const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(balance);

      return twiml(`💰 *Wallet Balance*\n👤 ${agent.name}\n💳 Available Balance: ${formatted}`);
    }

    // --- COMMAND: 5 = admin work log absence report (all agents) ---
    if (command === "5") {
      try {
        const report = await buildAbsenceReport(supabase, today);
        return twiml(report);
      } catch (err) {
        console.error("Command 5 error:", err);
        return twiml("❌ Failed to generate absence report. Please try again.");
      }
    }

    // --- Helper: get panchayaths that have agents of a given role ---
    async function getPanchayathsWithRole(role: string) {
      const { data: agents } = await supabase
        .from("pennyekart_agents")
        .select("panchayath_id")
        .eq("role", role)
        .eq("is_active", true);
      if (!agents || agents.length === 0) return [];
      const uniqueIds = [...new Set(agents.map((a: any) => a.panchayath_id))];
      const { data: panchayaths } = await supabase
        .from("panchayaths")
        .select("id, name")
        .in("id", uniqueIds)
        .eq("is_active", true)
        .order("name", { ascending: true });
      return panchayaths || [];
    }

    // --- COMMAND: 6 = coordinator absence report (panchayath selection) ---
    const cmd6Match = command.match(/^6\s+(\d+)$/);
    if (command === "6") {
      const panchayaths = await getPanchayathsWithRole("coordinator");
      if (panchayaths.length === 0) {
        return twiml("No panchayaths with coordinators found.");
      }
      let msg = `📍 *Coordinator Report*\nSend *6 <number>*:\n`;
      panchayaths.forEach((p: any, i: number) => {
        msg += `\n${i + 1}. ${p.name}`;
      });
      return twiml(msg);
    }
    if (cmd6Match) {
      const num = parseInt(cmd6Match[1], 10);
      const panchayaths = await getPanchayathsWithRole("coordinator");
      if (num < 1 || num > panchayaths.length) {
        return twiml(`❌ Invalid. Send *6* to see list.`);
      }
      try {
        const report = await buildAbsenceReport(supabase, today, "coordinator", panchayaths[num - 1].id);
        return twiml(report);
      } catch (err) {
        console.error("Command 6 error:", err);
        return twiml("❌ Failed to generate coordinator report.");
      }
    }

    // --- COMMAND: 7 = group leader absence report (panchayath selection) ---
    const cmd7Match = command.match(/^7\s+(\d+)$/);
    if (command === "7") {
      const panchayaths = await getPanchayathsWithRole("group_leader");
      if (panchayaths.length === 0) {
        return twiml("No panchayaths with group leaders found.");
      }
      let msg = `📍 *Group Leader Report*\nSend *7 <number>*:\n`;
      panchayaths.forEach((p: any, i: number) => {
        msg += `\n${i + 1}. ${p.name}`;
      });
      return twiml(msg);
    }
    if (cmd7Match) {
      const num = parseInt(cmd7Match[1], 10);
      const panchayaths = await getPanchayathsWithRole("group_leader");
      if (num < 1 || num > panchayaths.length) {
        return twiml(`❌ Invalid. Send *7* to see list.`);
      }
      try {
        const report = await buildAbsenceReport(supabase, today, "group_leader", panchayaths[num - 1].id);
        return twiml(report);
      } catch (err) {
        console.error("Command 7 error:", err);
        return twiml("❌ Failed to generate group leader report.");
      }
    }

    // --- DYNAMIC CUSTOM COMMANDS ---
    const cmdLower = command.toLowerCase();
    for (const cc of activeCustom) {
      if (cmdLower === cc.keyword.toLowerCase() || (cc.alt_keyword && cmdLower === cc.alt_keyword.toLowerCase())) {
        return twiml(cc.response_text);
      }
    }

    // --- UNRECOGNIZED COMMAND ---
    let fallback = `🤔 Sorry ${agent.name}, I didn't understand that.\n\n*Commands:*\n1️⃣ *1* <work details> — Submit work log\n2️⃣ *2* — Reporting person details\n3️⃣ *3* <complaint> — Register complaint\n4️⃣ *4* — Wallet balance\n5️⃣ *5* — Absence report\n6️⃣ *6* — Coordinator report\n7️⃣ *7* — Group Leader report\n8️⃣ *8* — Help`;
    for (const cc of activeCustom) {
      fallback += `\n${cc.keyword}️⃣ *${cc.keyword}* — ${cc.label}`;
    }
    fallback += `\n\nExample: _1 Visited 5 shops today_`;

    return twiml(fallback);
  } catch (err) {
    console.error("Webhook error:", err);
    return twiml("Something went wrong. Please try again later.\n\nType *3* for help.");
  }
});
