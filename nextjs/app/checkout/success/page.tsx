"use client";

import { useRouter } from "next/navigation";

const CheckoutSuccessPage = () => {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center animate-in zoom-in-95 duration-500">
      <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-10 text-4xl shadow-xl">✓</div>
      <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Payment Received</h1>
      <p className="text-lg text-slate-500 mb-2 font-medium">Your listing is now pending review.</p>
      <p className="text-sm text-slate-400 font-bold mb-12">We will publish it as soon as it passes moderation.</p>
      <button
        onClick={() => router.push("/dashboard/employer")}
        className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-xl hover:scale-105 transition-all"
      >
        Go to Dashboard
      </button>
    </div>
  );
};

export default CheckoutSuccessPage;
