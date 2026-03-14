export function getSourcingAutoPublishMinScore(): number {
  const raw = Number.parseInt(process.env.SOURCING_AUTO_PUBLISH_SCORE || "78", 10);
  const n = Number.isFinite(raw) ? raw : 78;
  return Math.min(100, Math.max(0, n));
}

export function getSourcingAutoPublishSupportedSourceTypes(): Set<string> {
  const list = (process.env.SOURCING_AUTO_PUBLISH_SOURCES || "greenhouse")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

export function getSourcingCronSecret(): string | null {
  const s = (process.env.SOURCING_CRON_SECRET || "").trim();
  return s ? s : null;
}

