const SCOPE = "https://www.googleapis.com/auth/indexing";

export function indexingScope(): string {
  return SCOPE;
}

type Env = Record<string, string | undefined>;

/** Server-only. Never log the return value. */
export function indexingCredentials(env: Env = process.env): { email: string; privateKey: string } | null {
  if (typeof window !== "undefined") return null;
  const email = (env.GOOGLE_INDEXING_CLIENT_EMAIL || "").trim();
  const raw = (env.GOOGLE_INDEXING_PRIVATE_KEY || "").trim();
  if (!email || !raw) return null;
  const privateKey = raw.replace(/\\n/g, "\n");
  if (!privateKey.includes("PRIVATE KEY")) return null;
  return { email, privateKey };
}

export function indexingLiveEnabled(env: Env = process.env): boolean {
  return (env.GOOGLE_INDEXING_LIVE || "").trim() === "1";
}
