import type { Metadata } from "next";
import AlertsClient from "./AlertsClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

const getParam = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/alerts`;
  const title = "Job alerts — CareersPal";
  const description =
    "Create an email alert for new published roles in Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.";

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function AlertsPage({ searchParams }: PageProps) {
  const initialCategory = getParam(searchParams?.category) || null;

  return (
    <div className="bg-[#F8F9FD] pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <AlertsClient initialCategory={initialCategory} />
      </div>
    </div>
  );
}

