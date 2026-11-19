import Link from "next/link";
import CompanyLogo from "./CompanyLogo";
import type { HiringEmployer } from "../lib/companyBoard";

const BACK = [
  "border-slate-200 bg-white text-slate-900",
  "border-indigo-200 bg-indigo-50 text-indigo-950",
  "border-indigo-600 bg-indigo-600 text-white",
];

export default function EmployerFlipGrid({ employers }: { employers: HiringEmployer[] }) {
  if (employers.length === 0) return null;
  return (
    <section className="mt-8" aria-label="Most relevant employers">
      <h2 className="text-base font-semibold text-slate-900">Most relevant</h2>
      <p className="mt-1 text-sm text-slate-600">
        Featured Pro comes first, then Standard, then other companies that have a logo. Inside each group, more open roles come first.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {employers.map((employer, index) => {
          const roleLabel = `${employer.roles} open ${employer.roles === 1 ? "role" : "roles"}`;
          return (
            <li key={employer.slug}>
              <Link
                href={`/companies/${employer.slug}`}
                aria-label={`${employer.name}, ${roleLabel}`}
                className="group block h-28 [perspective:800px]"
              >
                <span className="pointer-events-none relative block h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-visible:[transform:rotateY(180deg)] motion-reduce:transition-none motion-reduce:group-hover:[transform:none]">
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white p-4 [backface-visibility:hidden]">
                    <CompanyLogo
                      name={employer.name}
                      logoUrl={employer.logo}
                      className="h-12 w-full"
                      imageClassName="mx-auto h-12 max-w-[7rem] object-contain"
                      fallbackClassName="text-sm"
                    />
                  </span>
                  <span
                    className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border px-3 text-center [transform:rotateY(180deg)] [backface-visibility:hidden] ${BACK[index % BACK.length]}`}
                  >
                    <span className="text-2xl font-semibold tracking-tight">{employer.roles}</span>
                    <span className="mt-0.5 text-xs font-medium">{roleLabel.replace(/^\d+\s/, "")}</span>
                    <span className="mt-1 line-clamp-2 text-[11px] font-medium opacity-80">{employer.name}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
