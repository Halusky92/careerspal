import { createHash } from "crypto";

export type UniqueViewer = {
  viewerId: string | null;
  fingerprint: string | null;
};

export function hashViewerFingerprint(value: string, jobId: string) {
  return createHash("sha256").update(`${value}:${jobId}`).digest("hex").slice(0, 32);
}

export function uniqueViewerFromRequest(input: {
  jobId: string;
  userId?: string | null;
  sessionId?: string | null;
  ip?: string | null;
}): UniqueViewer {
  const jobId = (input.jobId || "").trim();
  const userId = (input.userId || "").trim();
  if (userId) {
    return { viewerId: userId, fingerprint: `u:${hashViewerFingerprint(userId, jobId)}` };
  }
  const sessionId = (input.sessionId || "").trim();
  if (sessionId) {
    return { viewerId: null, fingerprint: `s:${hashViewerFingerprint(sessionId, jobId)}` };
  }
  const ip = (input.ip || "").trim();
  if (ip) {
    return { viewerId: null, fingerprint: hashViewerFingerprint(ip, jobId) };
  }
  return { viewerId: null, fingerprint: null };
}
