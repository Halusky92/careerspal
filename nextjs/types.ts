
export type PlanType = 'Standard' | 'Featured Pro' | 'Elite Managed';

export type View =
  | 'home'
  | 'find'
  | 'post'
  | 'hire'
  | 'terms'
  | 'pricing'
  | 'privacy'
  | 'contact'
  | 'about'
  | 'accessibility'
  | 'manage'
  | 'auth'
  | 'checkout'
  | 'job-detail'
  | 'company-profile'
  | 'salaries'
  | 'admin';

export interface Job {
  id: string;
  title: string;
  company: string;
  logo: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Part-time';
  salary: string;
  postedAt: string;
  category: string;
  description: string;
  tags: string[];
  tools?: string[]; // Pridané pre technický stack (Notion, Zapier, atď.)
  isFeatured?: boolean;
  planType?: PlanType; // Nové pole pre vizuálne rozlíšenie
  plan?: { type: PlanType; price: number };
  remotePolicy: string;
  applyUrl: string;
  companyDescription?: string;
  benefits?: string[];
  matchScore?: number; // Simulované AI skóre
  timestamp?: number;
  status?: string;
  views?: number;
  matches?: number;
  companyWebsite?: string;
  keywords?: string;
  stripePaymentStatus?: string;
  stripeSessionId?: string;
}

export interface RemoteDNA {
  asyncLevel: 'Sync-Heavy' | 'Hybrid' | 'Async-First' | 'Deep Work';
  meetingsPerWeek: string; // e.g. "Low (<5h)"
  cameraPolicy: 'Always On' | 'Optional' | 'Off';
  retreats: 'None' | 'Annual' | 'Quarterly';
  communicationStyle: 'Text-heavy' | 'Video-heavy' | 'Call-heavy';
  onboarding: 'Self-paced' | 'Shadowing' | 'Structured Bootcamp';
}

export interface Company {
  name: string;
  logo: string;
  website: string;
  description: string;
  longDescription: string;
  foundedYear: string;
  employeeCount: string;
  headquarters: string;
  images: string[]; // Fotky kancelárií/kultúry
  techStack: string[];
  remoteDNA?: RemoteDNA; // Nové pole
  socialLinks: {
    linkedin?: string;
    twitter?: string;
  };
}

export interface UserProfile {
  name: string;
  role: string;
  skills: string[];
  bio: string;
}

export interface UserSession {
  email: string;
  role: 'candidate' | 'employer';
  savedJobIds?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Candidate {
  id: string;
  title: string;
  level: 'Mid' | 'Senior' | 'Lead' | 'Architect';
  location: string;
  rate: string;
  skills: string[];
  bio: string;
  availability: 'Immediate' | '2 weeks' | '1 month';
  verified: boolean; // Elite Verified Badge
  featured?: boolean;
  exCompanies?: string[]; // e.g. ["Ex-Uber", "Ex-Notion"]
}

export interface ResumeAudit {
  score: number;
  headline: string;
  strengths: string[];
  missingKeywords: string[];
  actionPlan: string;
}

export interface SalaryStat {
  role: string;
  category: string;
  min: number;
  median: number;
  max: number;
  hourlyMin: number;
  hourlyMax: number;
  demand: 'Low' | 'Medium' | 'High' | 'Very High';
  trend: 'Up' | 'Stable' | 'Down';
}
