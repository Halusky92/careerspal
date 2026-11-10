export type QualifyingApprovalJob = {
  title?: string | null;
  applyUrl?: string | null;
  salary?: string | null;
};

export function discoveryAutoApproveEnabled(flag = process.env.DISCOVERY_AUTO_APPROVE) {
  return flag !== "0";
}

/** New official boards only. An existing source is never switched on. */
export function autoApprovalForNewSource(args: {
  alreadySaved: boolean;
  autoApproveEnabled: boolean;
  decision: string;
  qualifyingJobs?: QualifyingApprovalJob[] | null;
}) {
  if (!args.autoApproveEnabled) return { approve: false as const, reason: "auto_approve_off" };
  if (args.alreadySaved) return { approve: false as const, reason: "existing_source" };
  if (args.decision !== "pending_approval") return { approve: false as const, reason: "not_qualifying" };
  const job = (args.qualifyingJobs || []).find((item) => {
    const applyUrl = (item.applyUrl || "").trim();
    return Boolean((item.title || "").trim() && (item.salary || "").trim() && /^https:\/\//i.test(applyUrl));
  });
  if (!job) return { approve: false as const, reason: "incomplete_job" };
  return {
    approve: true as const,
    title: (job.title || "").trim(),
    applyUrl: (job.applyUrl || "").trim(),
    salary: (job.salary || "").trim(),
  };
}
