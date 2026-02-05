"use client";

import { useEffect } from "react";

const Error = ({ error, reset }: { error: Error; reset: () => void }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-black text-slate-900 mb-4">Something went wrong</h1>
        <p className="text-slate-500 font-medium mb-10">
          We hit an unexpected issue. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

export default Error;
