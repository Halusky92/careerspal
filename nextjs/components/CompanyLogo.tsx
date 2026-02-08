import React, { useMemo, useState } from "react";

type CompanyLogoProps = {
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

const COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-teal-500",
];
const KNOWN_LOGOS: Record<string, string> = {
  linear: "https://logo.clearbit.com/linear.app",
  canva: "https://logo.clearbit.com/canva.com",
  webflow: "https://logo.clearbit.com/webflow.com",
  ramp: "https://logo.clearbit.com/ramp.com",
};

const getInitials = (value: string) => {
  const words = value
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length === 0) return "CO";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getDomainLogo = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw || raw.startsWith("mailto:") || raw === "#") return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const hostname = url.hostname.replace(/^www\./, "");
    return hostname ? `https://logo.clearbit.com/${hostname}` : "";
  } catch {
    return "";
  }
};

const CompanyLogo: React.FC<CompanyLogoProps> = ({
  name,
  logoUrl,
  website,
  className,
  imageClassName,
  fallbackClassName,
}) => {
  const [failed, setFailed] = useState(false);
  const fallback = useMemo(() => getInitials(name || "Company"), [name]);
  const fallbackColor = useMemo(() => COLORS[hashString(name || "Company") % COLORS.length], [name]);
  const nameLogo = useMemo(() => KNOWN_LOGOS[(name || "").trim().toLowerCase()] || "", [name]);
  const domainLogo = useMemo(() => getDomainLogo(website || logoUrl), [website, logoUrl]);
  const src = !failed ? (logoUrl || nameLogo || domainLogo) : "";
  const shouldShowImage = Boolean(src);

  return (
    <div className={className}>
      {shouldShowImage ? (
        <img
          src={src}
          alt={name}
          className={imageClassName}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${fallbackColor} ${fallbackClassName || ""}`.trim()}>
          <span className="font-black text-white">{fallback}</span>
        </div>
      )}
    </div>
  );
};

export default CompanyLogo;
