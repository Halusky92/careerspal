import Link from "next/link";

export default function JobNotFound() {
  return (
    <div className="bg-[#F8F9FD] min-h-screen">
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <div className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-10 text-center">
          <h1 className="text-4xl font-black text-slate-900 mb-4">Role not found</h1>
          <p className="text-slate-500 font-medium mb-10">
            This role may have expired or is no longer publicly available.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
            >
              Back to jobs
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black hover:border-indigo-200 hover:text-indigo-700 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

