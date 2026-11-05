import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const marker = `Walk Circuit ${Date.now()}`;

const step = (label: string, extra?: Record<string, unknown>) => {
  console.log(JSON.stringify({ step: label, ...extra }));
};

const assertStatus = (actual: string | null | undefined, expected: string) => {
  if (actual !== expected) {
    throw new Error(`Expected status ${expected}, got ${actual}`);
  }
};

const run = async () => {
  const { data: admin } = await supabase.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  const ownerId = admin?.id || null;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .upsert(
      {
        name: marker,
        website: "https://walkcircuit.example",
        description: "Ops studio used only for a publish/unpublish walk.",
        created_by: ownerId,
        verified: false,
      },
      { onConflict: "name" },
    )
    .select("id,name")
    .single();
  if (companyError || !company) throw new Error(companyError?.message || "company create failed");
  step("company_ready", { id: company.id, name: company.name });

  const insertJob = async () => {
    const payload = {
      title: "Workflow Automation Specialist",
      description:
        "Who we are\nWalk Circuit is a small ops studio.\n\nWho you are\nYou ship Zapier and Make scenarios.\n\nThe work\nRebuild ticket-to-Slack workflows with error handling.",
      location: "Remote",
      remote_policy: "Remote (Global)",
      type: "Full-time",
      salary: "$100k-$130k",
      posted_at_text: "Pending review",
      timestamp: Date.now(),
      category: "Automation",
      apply_url: "https://walkcircuit.example/careers",
      company_description: marker,
      company_website: "https://walkcircuit.example",
      tags: ["Automation"],
      tools: ["Zapier", "Make"],
      benefits: [],
      is_featured: false,
      status: "pending_review",
      plan_type: "Standard",
      plan_price: 0,
      plan_currency: "USD",
      views: 0,
      matches: 0,
      created_by: ownerId,
      company_id: company.id,
      stripe_payment_status: "paid",
      origin: "employer",
    };
    let { data, error } = await supabase.from("jobs").insert(payload).select("id,status,title").single();
    if (error) {
      const { origin: _origin, ...withoutOrigin } = payload;
      const retry = await supabase.from("jobs").insert(withoutOrigin).select("id,status,title").single();
      data = retry.data;
      error = retry.error;
    }
    if (error || !data) throw new Error(error?.message || "job create failed");
    return data;
  };

  const pending = await insertJob();
  assertStatus(pending.status, "pending_review");
  step("created_pending", pending);

  const publishedAt = new Date().toISOString();
  const { data: live, error: liveError } = await supabase
    .from("jobs")
    .update({
      status: "published",
      published_at: publishedAt,
      posted_at_text: "Just now",
      timestamp: Date.now(),
    })
    .eq("id", pending.id)
    .select("id,status")
    .single();
  if (liveError || !live) throw new Error(liveError?.message || "publish failed");
  assertStatus(live.status, "published");
  step("published", live);

  const { data: paused, error: pauseError } = await supabase
    .from("jobs")
    .update({ status: "paused", posted_at_text: "Paused" })
    .eq("id", pending.id)
    .select("id,status")
    .single();
  if (pauseError || !paused) throw new Error(pauseError?.message || "unpublish failed");
  assertStatus(paused.status, "paused");
  step("unpublished", paused);

  const { error: deleteError } = await supabase.from("jobs").delete().eq("id", pending.id);
  if (deleteError) throw new Error(deleteError.message);
  const { data: gone } = await supabase.from("jobs").select("id").eq("id", pending.id).maybeSingle();
  if (gone) throw new Error("delete failed, row still exists");
  step("deleted", { id: pending.id });

  await supabase.from("companies").delete().eq("id", company.id);
  step("company_removed", { id: company.id });
  step("ok");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
