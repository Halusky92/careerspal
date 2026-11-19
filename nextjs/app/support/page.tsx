import type { Metadata } from "next";
import SupportForm from "./SupportForm";
import { getCanonicalSiteUrl } from "../../lib/alerts/siteUrl";
import { publicOperator } from "../../lib/operator";

export async function generateMetadata(): Promise<Metadata> {
  const canonicalUrl = `${getCanonicalSiteUrl()}/support`;
  const title = "Support — CareersPal";
  const description = "Questions about a role, a listing, billing, or the board. Write to CareersPal and the reply goes to your email.";
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: "website" },
  };
}

export default function SupportPage() {
  const operator = publicOperator();
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Support</p>
      <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Write to us</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        A role, a listing, billing, or the board. The reply goes to the email you enter. You can also write{" "}
        <a href={`mailto:${operator.email}`} className="font-medium text-indigo-700 hover:text-indigo-800">
          {operator.email}
        </a>
        .
      </p>
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <SupportForm />
      </div>
    </div>
  );
}
