
import { GoogleGenAI, Type } from "@google/genai";
import { Job, ResumeAudit } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getCareerAdvice = async (query: string, jobs: Job[]) => {
  const ai = getAI();
  const jobContext = jobs.map(j => `${j.title} at ${j.company} (${j.tags.join(', ')})`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are CareersPal AI, an elite career coach. 
    
    IMPORTANT: Always respond in professional English.
    
    User query: "${query}"
    
    Available job listings:
    ${jobContext}
    
    Provide professional, elite, and actionable advice. If relevant, suggest 1-2 jobs from the list. Keep it concise.`,
    config: {
      temperature: 0.7,
    }
  });

  return response.text || "I'm sorry, I couldn't generate advice right now.";
};

export const generateJobDescription = async (title: string, keywords: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a compelling, professional remote job description in English for the role: "${title}". 
    Incorporate these keywords: ${keywords}. 
    Include sections: About the Role, Key Responsibilities, Requirements, and Benefits. 
    Maintain an elite brand voice.`,
  });
  return response.text;
};

export const analyzeResumeForJobs = async (resumeText: string, jobs: Job[]) => {
  const ai = getAI();
  const jobData = jobs.map(j => ({ id: j.id, title: j.title, company: j.company, tags: j.tags }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this resume and match it to the 3 best jobs.
    Respond exclusively in English.
    
    Resume: ${resumeText}
    Jobs: ${JSON.stringify(jobData)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                jobId: { type: Type.STRING },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING }
              },
              required: ["jobId", "score", "reason"]
            }
          }
        },
        required: ["matches"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{"matches":[]}');
  } catch (e) {
    return { matches: [] };
  }
};

export const auditCandidateProfile = async (text: string): Promise<ResumeAudit> => {
  const ai = getAI();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Act as an elite executive recruiter for tech startups (Notion, Automation, Ops roles).
    Analyze this professional bio/resume text. Give a strict score from 0-100 based on clarity, impact, and keywords.
    Identify missing high-value keywords (like 'System Architecture', 'Make.com', 'API', 'Stakeholder Management').
    
    Text to analyze: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Score from 0-100" },
          headline: { type: Type.STRING, description: "A punchy 1-line summary of the candidate's vibe" },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionPlan: { type: Type.STRING, description: "1 sentence on how to improve immediately" }
        },
        required: ["score", "headline", "strengths", "missingKeywords", "actionPlan"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}') as ResumeAudit;
  } catch (e) {
    return {
      score: 50,
      headline: "Analysis Failed",
      strengths: [],
      missingKeywords: [],
      actionPlan: "Please try again later."
    };
  }
};
