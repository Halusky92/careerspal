import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 500 });
  }

  const body = (await request.json()) as { text?: string };
  if (!body?.text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Act as an elite executive recruiter for tech startups (Notion, Automation, Ops roles).
Analyze this professional bio/resume text. Give a strict score from 0-100 based on clarity, impact, and keywords.
Identify missing high-value keywords (like 'System Architecture', 'Make.com', 'API', 'Stakeholder Management').

Text to analyze: "${body.text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Score from 0-100" },
          headline: { type: Type.STRING, description: "A punchy 1-line summary of the candidate's vibe" },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionPlan: { type: Type.STRING, description: "1 sentence on how to improve immediately" },
        },
        required: ["score", "headline", "strengths", "missingKeywords", "actionPlan"],
      },
    },
  });

  try {
    return NextResponse.json(JSON.parse(response.text || "{}"));
  } catch {
    return NextResponse.json({ error: "Invalid AI response." }, { status: 500 });
  }
}
