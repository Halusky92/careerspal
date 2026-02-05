import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
    contents: `Write a compelling, professional remote job description in English for the role: "${body.title}".
Incorporate these keywords: ${body.keywords || ""}.
Include sections: About the Role, Key Responsibilities, Requirements, and Benefits.
Maintain an elite brand voice.`,
  });

  return NextResponse.json({ text: response.text || "" });
}
