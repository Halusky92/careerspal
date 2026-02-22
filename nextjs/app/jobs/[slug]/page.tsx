"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getJobIdFromSlug } from "../../../lib/jobs";

interface JobDetailPageProps {
  params: { slug: string };
}

const JobDetailPage = ({ params }: JobDetailPageProps) => {
  const router = useRouter();

  useEffect(() => {
    const jobId = getJobIdFromSlug(params.slug);
    router.replace(`/jobs?jobId=${encodeURIComponent(jobId)}`);
  }, [params.slug, router]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
        <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
        Redirecting...
      </div>
    </div>
  );
};

export default JobDetailPage;
