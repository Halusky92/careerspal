"use client";

import { useEffect, type ReactNode } from "react";

export function JobViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/jobs/${jobId}/view`, { method: "POST" }).catch(() => undefined);
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
    fetch(`/api/jobs/${jobId}/match`, { method: "POST" }).catch(() => undefined);
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
