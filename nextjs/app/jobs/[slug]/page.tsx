"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobDetail from "../../../components/JobDetail";
import { getAllJobs, getJobBySlug, createJobSlug, createCompanySlug, getJobIdFromSlug } from "../../../lib/jobs";

interface JobDetailPageProps {
  params: { slug: string };
}

const JobDetailPage = ({ params }: JobDetailPageProps) => {
  const router = useRouter();
  const [allJobs, setAllJobs] = useState(getAllJobs());
  const [job, setJob] = useState(() => getJobBySlug(params.slug));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const jobId = getJobIdFromSlug(params.slug);
        const response = await fetch(`/api/jobs/${jobId}`);
        if (response.ok) {
          const data = (await response.json()) as { job?: (typeof job) | null };
          if (data.job) {
            setJob(data.job);
          } else {
            setJob(null);
          }
        } else if (response.status === 404) {
          setJob(null);
        }
      } catch {
        // fallback stays
      } finally {
        setIsLoading(false);
      }
    };
    const loadJobs = async () => {
      try {
        const response = await fetch("/api/jobs");
        const data = (await response.json()) as { jobs?: typeof allJobs };
        if (Array.isArray(data.jobs)) {
          setAllJobs(data.jobs);
        }
      } catch {
        // fallback stays
      }
    };
    loadJob();
    loadJobs();
  }, [params.slug]);

  if (isLoading && !job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Loading role...
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-black text-slate-900 mb-4">Job not found</h1>
        <p className="text-slate-500 font-medium mb-10">
          The role you are looking for is no longer available or the link is invalid.
        </p>
        <Link
          href="/jobs"
          className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
        >
          Back to Jobs
        </Link>
      </div>
    );
  }

  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.timestamp ? new Date(job.timestamp).toISOString() : new Date().toISOString(),
    employmentType: job.type,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      logo: job.logo,
    },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: job.remotePolicy,
    baseSalary: job.salary,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />
      <JobDetail
        job={job}
        allJobs={allJobs}
        onBack={() => router.back()}
        onSelectJob={(nextJob) => router.push(`/jobs/${createJobSlug(nextJob)}`)}
        onSelectCompany={(companyName) =>
          router.push(`/companies/${createCompanySlug({ name: companyName })}`)
        }
      />
    </>
  );
};

export default JobDetailPage;
