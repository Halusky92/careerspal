"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyProfile from "../../../components/CompanyProfile";
import type { Company, Job } from "../../../types";

interface CompanyProfilePageProps {
  params: { slug: string };
}

const CompanyProfilePage = ({ params }: CompanyProfilePageProps) => {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [companyJobs, setCompanyJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const response = await fetch(`/api/companies/${params.slug}`);
        if (!response.ok) {
          setCompany(null);
          setCompanyJobs([]);
          return;
        }
        const data = (await response.json()) as { company?: Company | null; jobs?: Job[] };
        setCompany(data.company ?? null);
        setCompanyJobs(Array.isArray(data.jobs) ? data.jobs : []);
      } catch {
        setCompany(null);
        setCompanyJobs([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCompany();
  }, [params.slug]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Loading company...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-black text-slate-900 mb-4">Company not found</h1>
        <p className="text-slate-500 font-medium mb-10">
          The company profile you are looking for is unavailable.
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

  return (
    <div className="pt-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <CompanyProfile
        company={company}
        companyJobs={companyJobs}
        onBack={() => router.back()}
        onSelectJob={(job) => router.push(`/jobs?jobId=${encodeURIComponent(job.id)}`)}
      />
    </div>
  );
};

export default CompanyProfilePage;
