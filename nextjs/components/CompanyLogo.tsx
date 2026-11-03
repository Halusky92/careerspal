"use client";

import React, { useMemo, useState } from "react";
import { publicLogoFallbacks } from "../lib/companyLogoUrl";

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

const CompanyLogo: React.FC<CompanyLogoProps> = ({
  name,
  logoUrl,
  website,
  className,
  imageClassName,
  fallbackClassName,
}) => {
  const [index, setIndex] = useState(0);
  const fallback = useMemo(() => getInitials(name || "Company"), [name]);
  const fallbackColor = useMemo(() => COLORS[hashString(name || "Company") % COLORS.length], [name]);
  const candidates = useMemo(() => {
    const nameLogo = KNOWN_LOGOS[(name || "").trim().toLowerCase()] || "";
    const list = [logoUrl, nameLogo, ...publicLogoFallbacks(website || logoUrl)].filter(
      (value): value is string => Boolean(value && value.trim()),
    );
    return Array.from(new Set(list));
  }, [logoUrl, name, website]);
  const src = candidates[index] || "";
  const shouldShowImage = Boolean(src);

  return (
    <div className={className}>
      {shouldShowImage ? (
        <img
          src={src}
          alt={name}
          className={imageClassName}
          onError={() => setIndex((current) => current + 1)}
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
