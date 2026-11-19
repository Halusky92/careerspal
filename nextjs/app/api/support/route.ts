import { NextResponse } from "next/server";
import { Resend } from "resend";
import { publicOperator } from "../../../lib/operator";
import { getResendFrom } from "../../../lib/resendFrom";

export const runtime = "nodejs";

const TOPICS = ["Looking for a role", "Hiring", "Billing", "Something else"] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    topic?: string;
    message?: string;
    companyUrl?: string;
  };

  if ((body.companyUrl || "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email || "").trim().toLowerCase();
  const topic = TOPICS.find((item) => item === body.topic) ?? "Something else";
  const message = (body.message || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json({ error: "Write a short message, at least a sentence." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: `Email ${publicOperator().email} directly. The form is not sending right now.` }, { status: 503 });
  }

  try {
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({
      from: getResendFrom(),
      to: publicOperator().email,
      replyTo: email,
      subject: `CareersPal support — ${topic}`,
      html: `<p><strong>${escapeHtml(topic)}</strong></p>
        <p>From ${escapeHtml(email)}</p>
        <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>`,
    });
    if (sent.error) {
      return NextResponse.json({ error: `The message did not send. Email ${publicOperator().email}.` }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: `The message did not send. Email ${publicOperator().email}.` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
