"use client";

import Link from "next/link";

export default function ApplyContinue() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <p className="text-sm font-medium text-slate-900">You can close this tab</p>
      <p className="mt-2 text-sm text-slate-500">
        Sign in stays on your CareersPal tab. After login, the employer apply page opens from there.
      </p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">
        Back to CareersPal
      </Link>
    </div>
  );
}
