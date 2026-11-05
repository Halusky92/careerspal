import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { sendAdminPendingDigest } from "../lib/listingNotify";

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

const listings = [
  {
    company: "Northline Relay",
    website: "https://northlinerelay.example",
    companyDescription: "Remote ops studio for series A SaaS teams.",
    title: "Revenue Operations Analyst",
    category: "Marketing & Growth Ops",
    salary: "$95k-$120k",
    location: "Remote (EU/US overlap)",
    remotePolicy: "Remote (Global)",
    type: "Full-time",
    applyUrl: "mailto:jobs@northlinerelay.example",
    tools: ["Salesforce", "HubSpot", "Looker"],
    tags: ["RevOps", "Salesforce"],
    description: `Who we are
Northline Relay is a 22-person ops studio. We keep pipeline, billing, and reporting in one system for B2B SaaS clients.

Who you are
You have 3+ years in RevOps or sales ops. You can explain a Salesforce object model without a slide deck.

The work
Own weekly funnel reporting, clean CRM hygiene, and the handoff between sales and CS. You will document the process so the next hire can run it.`,
  },
  {
    company: "Harbor Ledger Labs",
    website: "https://harborledger.example",
    companyDescription: "Internal systems team building the company operating stack.",
    title: "Business Systems Analyst",
    category: "Systems Design",
    salary: "$110k-$140k",
    location: "Remote",
    remotePolicy: "Remote (Global)",
    type: "Full-time",
    applyUrl: "https://harborledger.example/careers/bsa",
    tools: ["Notion", "Airtable", "Jira"],
    tags: ["Systems", "Airtable"],
    description: `Who we are
Harbor Ledger Labs runs finance and ops tooling for a mid-market logistics company. The stack is Notion, Airtable, and a thin Jira layer.

Who you are
You map messy processes into objects, fields, and owners. You write for operators, not for a wiki that nobody reads.

The work
Intake requests, design the Airtable schema, and ship a weekly change log. You sit with finance and warehouse leads until the workflow matches how they actually work.`,
  },
  {
    company: "Kite Circuit",
    website: "https://kitecircuit.example",
    companyDescription: "Automation shop for ops teams that are done with copy-paste.",
    title: "Workflow Automation Specialist",
    category: "Automation",
    salary: "$100k-$130k",
    location: "Remote (Americas)",
    remotePolicy: "Remote (Global)",
    type: "Full-time",
    applyUrl: "mailto:hire@kitecircuit.example",
    tools: ["Zapier", "Make", "Slack"],
    tags: ["Automation", "Zapier"],
    description: `Who we are
Kite Circuit builds automations for ops and CS teams. We keep humans on judgment and machines on the repeatable steps.

Who you are
You have shipped Zapier or Make scenarios in production. You can debug a failed run without blaming the tool first.

The work
Take a backlog of ticket-to-Slack-to-sheet workflows, rebuild them with error handling, and document each one so the team can own it after you leave the project.`,
  },
];

const run = async () => {
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const created: Array<{ id: string; title: string; company: string; salary: string; location: string; applyUrl: string }> = [];

  for (const item of listings) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .upsert(
        {
          name: item.company,
          website: item.website,
          description: item.companyDescription,
          created_by: adminProfile?.id || null,
          verified: false,
        },
        { onConflict: "name" },
      )
      .select("id")
      .single();
    if (companyError || !company) {
      throw new Error(companyError?.message || `Failed to upsert ${item.company}`);
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        title: item.title,
        description: item.description,
        location: item.location,
        remote_policy: item.remotePolicy,
        type: item.type,
        salary: item.salary,
        posted_at_text: "Pending review",
        timestamp: Date.now(),
        category: item.category,
        apply_url: item.applyUrl,
        company_description: item.companyDescription,
        company_website: item.website,
        tags: item.tags,
        tools: item.tools,
        benefits: [],
        is_featured: false,
        status: "pending_review",
        plan_type: "Standard",
        plan_price: 0,
        plan_currency: "USD",
        views: 0,
        matches: 0,
        created_by: adminProfile?.id || null,
        company_id: company.id,
        stripe_payment_status: "paid",
        origin: "employer",
      })
      .select("id")
      .single();

    if (jobError || !job) {
      const retry = await supabase
        .from("jobs")
        .insert({
          title: item.title,
          description: item.description,
          location: item.location,
          remote_policy: item.remotePolicy,
          type: item.type,
          salary: item.salary,
          posted_at_text: "Pending review",
          timestamp: Date.now(),
          category: item.category,
          apply_url: item.applyUrl,
          company_description: item.companyDescription,
          company_website: item.website,
          tags: item.tags,
          tools: item.tools,
          benefits: [],
          is_featured: false,
          status: "pending_review",
          plan_type: "Standard",
          plan_price: 0,
          plan_currency: "USD",
          views: 0,
          matches: 0,
          created_by: adminProfile?.id || null,
          company_id: company.id,
          stripe_payment_status: "paid",
        })
        .select("id")
        .single();
      if (retry.error || !retry.data) {
        throw new Error(jobError?.message || retry.error?.message || `Failed to insert ${item.title}`);
      }
      created.push({
        id: retry.data.id,
        title: item.title,
        company: item.company,
        salary: item.salary,
        location: item.location,
        applyUrl: item.applyUrl,
      });
    } else {
      created.push({
        id: job.id,
        title: item.title,
        company: item.company,
        salary: item.salary,
        location: item.location,
        applyUrl: item.applyUrl,
      });
    }
  }

  await sendAdminPendingDigest({ listings: created, extraTo: ["mb.bilek@gmail.com"] });
  console.log(JSON.stringify({ created, emailed: Boolean(process.env.RESEND_API_KEY) }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
