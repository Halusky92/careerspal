"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { JOBS_RETURN_KEY, readJobsReturnPlace } from "../lib/jobsReturn";

export default function BackToBoard({
  jobId,
  className,
  children,
}: {
  jobId: string;
  className?: string;
  children: ReactNode;
}) {
  const href = `/jobs?jobId=${encodeURIComponent(jobId)}`;
  return (
    <Link
      href={href}
      scroll={false}
      className={className}
      onClick={(event) => {
        try {
          const place = readJobsReturnPlace(window.sessionStorage.getItem(JOBS_RETURN_KEY));
          if (!place || window.history.length < 2) return;
          event.preventDefault();
          window.history.back();
        } catch {
          // the link still returns to the board
        }
      }}
    >
      {children}
    </Link>
  );
}
