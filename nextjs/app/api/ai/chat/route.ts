import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Job } from "../../../../types";

export const runtime = "nodejs";

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

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are CareersPal AI, an elite career coach.

IMPORTANT: Always respond in professional English.

User query: "${body.query}"

Available job listings:
${jobContext}

Provide professional, elite, and actionable advice. If relevant, suggest 1-2 jobs from the list. Keep it concise.`,
    config: { temperature: 0.7 },
  });

  return NextResponse.json({
    text: response.text || "I'm sorry, I couldn't generate advice right now.",
  });
}
