import { createSign } from "node:crypto";
import { indexingScope } from "./credentials";
import type { NoticeType } from "./plan";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

export type IndexingFetcher = (url: string, init: RequestInit) => Promise<Response>;

export type PublishResult = {
  ok: boolean;
  status: number;
  attempts: number;
  retryable: boolean;
  error: string | null;
};

type TokenCache = { token: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signIndexingJwt(email: string, privateKey: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: indexingScope(),
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

function safeError(status: number): string {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "google_rejected_credentials";
  if (status >= 500) return "google_unavailable";
  if (status >= 400) return "google_rejected_url";
  return "google_request_failed";
}

function retryable(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  const header = Number(retryAfter);
  if (Number.isFinite(header) && header >= 0) return Math.min(10_000, Math.floor(header * 1000));
  return Math.min(8_000, 500 * 2 ** attempt);
}

async function accessToken(input: {
  email: string;
  privateKey: string;
  fetchImpl: IndexingFetcher;
  now: () => number;
}): Promise<string> {
  const now = input.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  const assertion = signIndexingJwt(input.email, input.privateKey, Math.floor(now / 1000));
  const response = await input.fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(safeError(response.status));
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("google_token_missing");
  tokenCache = {
    token: body.access_token,
    expiresAt: now + Math.max(60, body.expires_in || 3600) * 1000,
  };
  return body.access_token;
}

export function resetIndexingTokenCache(): void {
  tokenCache = null;
}

export async function publishIndexNotification(input: {
  url: string;
  type: NoticeType;
  email: string;
  privateKey: string;
  fetchImpl?: IndexingFetcher;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  canAttempt?: () => boolean;
  noteAttempt?: () => void;
}): Promise<PublishResult> {
  const fetchImpl = input.fetchImpl || fetch;
  const sleep = input.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = input.now || Date.now;
  let attempts = 0;
  let lastStatus = 0;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (input.canAttempt && !input.canAttempt()) {
      return { ok: false, status: lastStatus, attempts, retryable: false, error: "quota_exhausted" };
    }
    attempts += 1;
    input.noteAttempt?.();
    try {
      const token = await accessToken({ email: input.email, privateKey: input.privateKey, fetchImpl, now });
      const response = await fetchImpl(PUBLISH_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: input.url, type: input.type }),
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = response.status;
      if (response.ok) return { ok: true, status: response.status, attempts, retryable: false, error: null };
      lastError = safeError(response.status);
      if (!retryable(response.status) || attempt === 2) {
        return { ok: false, status: response.status, attempts, retryable: retryable(response.status), error: lastError };
      }
      await sleep(retryDelay(attempt, response.headers.get("retry-after")));
    } catch {
      lastError = "google_timeout";
      lastStatus = 0;
      if (attempt === 2) return { ok: false, status: 0, attempts, retryable: true, error: lastError };
      await sleep(retryDelay(attempt, null));
    }
  }
  return { ok: false, status: lastStatus, attempts, retryable: true, error: lastError };
}
