import { createHmac, timingSafeEqual } from "crypto";
import { type ListingFields } from "./listingFieldChecks";

const secret = () =>
  process.env.SCREEN_PASS_SECRET || process.env.API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "careerspal-dev";

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");

export function nicheFingerprint(fields: ListingFields) {
  return `${String(fields.title || "").trim()}\u001f${String(fields.description || "").trim()}`;
}

export function signScreenPass(fields: ListingFields) {
  const fingerprint = nicheFingerprint(fields);
  const exp = Date.now() + 2 * 60 * 60 * 1000;
  const payload = `${Buffer.from(fingerprint, "utf8").toString("base64url")}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyScreenPass(token: string | null | undefined, fields: ListingFields) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encoded, expRaw, sig] = parts;
  const payload = `${encoded}.${expRaw}`;
  const expected = sign(payload);
  try {
    if (expected.length !== sig.length) return false;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  } catch {
    return false;
  }
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  let fingerprint = "";
  try {
    fingerprint = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return false;
  }
  return fingerprint === nicheFingerprint(fields);
}
