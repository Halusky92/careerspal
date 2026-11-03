import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { toPlainJobDescription } from "../../../../lib/plainJobDescription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 500 });
  }

  const body = (await request.json()) as { title?: string; keywords?: string };
  if (!body?.title) {
    return NextResponse.json({ error: "Missing title." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write a professional remote job description in English for the role: "${body.title}".
Keywords to include if natural: ${body.keywords || "none"}.
Use these section titles on their own lines, without markdown: About the role, Responsibilities, Requirements, Benefits.
Rules: plain text only. No markdown. No asterisks. No # headings. No **bold**. No bullet symbols other than a simple hyphen. Short paragraphs. Do not invent salary, company name, or fake perks.`,
  });

  return NextResponse.json({ text: toPlainJobDescription(response.text || "") });
}
