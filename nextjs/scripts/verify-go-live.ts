import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });
config({ path: ".env" });

const WEBHOOK_PATH = "/api/stripe/webhook";
const WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.expired"] as const;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.careerspal.com").replace(/\/+$/, "");
}

function webhookUrl() {
  return `${siteUrl()}${WEBHOOK_PATH}`;
}

function stripeMode(key: string) {
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const resendKey = process.env.RESEND_API_KEY || "";
  const resendFrom = process.env.RESEND_FROM || "";
  const report = {
    stripeMode: stripeMode(stripeKey),
    stripeConfigured: Boolean(stripeKey),
    webhookSecretConfigured: Boolean(webhookSecret),
    resendConfigured: Boolean(resendKey),
    resendFrom: resendFrom || null,
    siteUrl: siteUrl(),
    expectedWebhookUrl: webhookUrl(),
    webhookEndpoints: [] as Array<{ id: string; url: string; status: string }>,
    webhookCreated: false as boolean | string,
    checkoutSessionOk: false,
    notes: [] as string[],
  };

  if (!stripeKey) {
    report.notes.push("STRIPE_SECRET_KEY missing.");
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  if (report.stripeMode !== "test") {
    report.notes.push("Refusing to mutate Stripe: key is not sk_test_. Use test mode.");
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
  const list = await stripe.webhookEndpoints.list({ limit: 20 });
  report.webhookEndpoints = list.data.map((e) => ({ id: e.id, url: e.url, status: e.status }));

  const expected = webhookUrl();
  const already = list.data.find((e) => e.url === expected);
  if (already) {
    report.notes.push("Test-mode webhook already points at this app URL.");
  } else {
    const created = await stripe.webhookEndpoints.create({
      url: expected,
      enabled_events: [...WEBHOOK_EVENTS],
      description: "CareersPal job listing checkout (test)",
    });
    report.webhookCreated = created.id;
    report.webhookEndpoints.push({ id: created.id, url: created.url, status: created.status });
    report.notes.push(
      "Created a TEST-mode webhook. Copy its signing secret into STRIPE_WEBHOOK_SECRET (Vercel + .env.local). The Dashboard secret is shown once.",
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "CareersPal test listing (do not complete with a real card)" },
          unit_amount: 100,
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/checkout`,
  });
  report.checkoutSessionOk = Boolean(session.id);
  report.notes.push("Created an unpaid TEST checkout session ($1.00). No card was charged.");

  if (!resendFrom.toLowerCase().includes("careerspal")) {
    report.notes.push("RESEND_FROM should use a verified CareersPal domain.");
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
