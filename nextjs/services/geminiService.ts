
import { Job, ResumeAudit } from "../types";

export const getCareerAdvice = async (query: string, jobs: Job[]) => {
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, jobs }),
    });
    const data = (await response.json()) as { text?: string; error?: string };
    return data.text || data.error || "I'm sorry, I couldn't generate advice right now.";
  } catch {
    return "I'm sorry, I couldn't generate advice right now.";
  }
};

export const generateJobDescription = async (title: string, keywords: string) => {
  const response = await fetch("/api/ai/job-description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, keywords }),
  });
  const data = (await response.json()) as { text?: string; error?: string };
  return data.text || data.error || "";
};

export const auditCandidateProfile = async (text: string): Promise<ResumeAudit> => {
  try {
    const response = await fetch("/api/ai/resume-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await response.json()) as ResumeAudit & { error?: string };
    if (data?.score !== undefined) return data;
  } catch {
    // fall through
  }
  return {
    score: 50,
    headline: "Analysis Failed",
    strengths: [],
    missingKeywords: [],
    actionPlan: "Please try again later.",
  };
};
