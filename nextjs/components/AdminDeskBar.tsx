"use client";

import Link from "next/link";

const deskLinks = [
  { href: "/dashboard/admin?tab=review", label: "Confirm jobs" },
  { href: "/dashboard/admin?tab=jobs", label: "All jobs" },
  { href: "/dashboard/admin?tab=people", label: "People" },
  { href: "/dashboard/admin?tab=sourcing", label: "Pipeline" },
  { href: "/dashboard/admin?tab=more", label: "Traffic" },
  { href: "/dashboard/employer", label: "My listings" },
];

type AdminDeskBarProps = {
  pendingCount?: number;
  onAutoCheck?: () => void;
  autoCheckBusy?: boolean;
};

const AdminDeskBar = ({ pendingCount, onAutoCheck, autoCheckBusy }: AdminDeskBarProps) => {
  return (
    <div className="mb-6 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Admin desk</p>
          <p className="text-xs text-slate-500">
            Confirm, pipeline, traffic, and your listings. {typeof pendingCount === "number" ? `${pendingCount} waiting.` : ""}
          </p>
        </div>
        <Link
          href="/dashboard/admin?tab=review"
          className="inline-flex h-9 items-center px-3 rounded-lg bg-slate-800 text-white text-sm font-medium"
        >
          Open desk
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {deskLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="h-8 px-3 inline-flex items-center rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:border-slate-400"
          >
            {item.label}
          </Link>
        ))}
        {onAutoCheck ? (
          <button
            type="button"
            onClick={onAutoCheck}
            disabled={autoCheckBusy}
            className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            {autoCheckBusy ? "Checking…" : "Auto-check queue"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default AdminDeskBar;
