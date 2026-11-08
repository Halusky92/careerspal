const BOT =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless|pingdom|uptimerobot|ahrefs|semrush|googlebot|gptbot|claudebot|bytespider|yandex|duckduckbot|ia_archiver/i;

export function isLikelyBot(userAgent?: string | null) {
  const ua = (userAgent || "").trim();
  if (ua.length < 12) return true;
  return BOT.test(ua);
}
