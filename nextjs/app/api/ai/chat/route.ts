import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Job } from "../../../../types";

export const runtime = "nodejs";

const isDetailedRequest = (query: string) => {
  const q = query.toLowerCase();
  return (
    q.includes("step") ||
    q.includes("step-by-step") ||
    q.includes("krok") ||
    q.includes("podrob") ||
    q.includes("detail") ||
    q.includes("dlhs") ||
    q.includes("viac") ||
    q.includes("explain") ||
    q.includes("vysvetli") ||
    q.includes("guide") ||
    q.includes("navod") ||
    q.includes("návod")
  );
};

const trimToSentences = (text: string, maxSentences: number) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const parts = cleaned.split(/(?<=[.!?])\s+/g);
  return parts.slice(0, maxSentences).join(" ").trim();
};

export async function POST(request: Request) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 500 });
  }

  const body = (await request.json()) as { query?: string; jobs?: Job[] };
  if (!body?.query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const jobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 30) : [];
  const jobContext = jobs
    .map((j) => `${j.title} at ${j.company} (${j.tags?.join(", ") || ""})`)
    .join("\n");

  const wantsDetail = isDetailedRequest(body.query);
  const brevityRule = wantsDetail
    ? "You may be detailed if necessary. Use up to 6 bullet points max."
    : "Be extremely concise: answer in 1–2 short sentences. No preamble. No bullets unless explicitly requested. If suggesting jobs, mention at most 1 role.";

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are CareersPal AI, an elite career coach.

IMPORTANT: Always respond in professional English.
${brevityRule}

User query: "${body.query}"

Available job listings:
${jobContext}

Provide professional, elite, and actionable advice. If relevant, suggest 1-2 jobs from the list. Keep it concise.`,
    config: { temperature: 0.7 },
  });

  return NextResponse.json({
    text: response.text
      ? wantsDetail
        ? response.text
        : trimToSentences(response.text, 2) || response.text
      : "I'm sorry, I couldn't generate advice right now.",
  });
}
