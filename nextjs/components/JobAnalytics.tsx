"use client";

import { useEffect, type ReactNode } from "react";
import { trackJobApply, trackJobView } from "../lib/trackJobEvent";

export function JobViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    if (!jobId) return;
    trackJobView(jobId);
  }, [jobId]);
  return null;
}

export function ApplyClickLink({
  jobId,
  href,
  className,
  children,
  external,
}: {
  jobId: string;
  href: string;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const onClick = () => {
    trackJobApply(jobId);
  };
  return (
    <a
      href={href}
      onClick={onClick}
      className={className}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer nofollow" : undefined}
    >
      {children}
    </a>
  );
}
