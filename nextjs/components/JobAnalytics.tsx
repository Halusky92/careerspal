"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { trackJobView } from "../lib/trackJobEvent";
import { useSupabaseAuth } from "./Providers";
import { startApply } from "../lib/startApply";

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
  const router = useRouter();
  const { accessToken } = useSupabaseAuth();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const result = startApply({ accessToken, jobId, applyUrl: href });
    if (result.href) router.push(result.href);
  };
  return (
    <a
      href={href}
      onClick={onClick}
      className={className}
      rel={external ? "noopener noreferrer nofollow" : undefined}
    >
      {children}
    </a>
  );
}
