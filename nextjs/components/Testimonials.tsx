
import React from 'react';

const Testimonials: React.FC = () => {
  const reviews = [
    {
      name: "Ops Lead",
      role: "EU • Systems & Operations",
      text: "The listings feel edited. Salary ranges + clear scope saved me time compared to generic boards.",
      visualType: "chart"
    },
    {
      name: "Automation Specialist",
      role: "Remote • No-code / Ops",
      text: "Filters by stack (Notion, Zapier, Make) make it fast to spot the roles that match how I actually work.",
      visualType: "table"
    },
    {
      name: "Hiring Manager",
      role: "B2B • Operations",
      text: "The review step caught missing details before going live. Fewer mismatched applicants, better signal.",
      visualType: "success"
    }
  ];

  return (
    <div className="relative overflow-hidden py-24">
      <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[140px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="text-center mb-16">
        <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Community Feedback</h2>
        <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">What members <span className="text-gradient">actually say.</span></h3>
        <p className="text-slate-500 font-medium mt-4 max-w-2xl mx-auto">
          Early feedback from operators and hiring teams using CareersPal in real searches and postings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reviews.map((review, idx) => (
          <div key={idx} className="bg-white/85 backdrop-blur p-8 rounded-[2.5rem] border border-slate-200/60 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
            
            {/* Visual Element (Chart/Table Simulation) */}
            <div className="h-32 bg-slate-50 rounded-2xl mb-8 overflow-hidden relative border border-slate-100 p-4 flex flex-col justify-center">
              {review.visualType === 'chart' && (
                <div className="flex items-end gap-2 h-full justify-center pb-2 px-4 opacity-70">
                   <div className="w-4 bg-indigo-200 rounded-t-md h-[40%] group-hover:h-[50%] transition-all duration-700"></div>
                   <div className="w-4 bg-indigo-300 rounded-t-md h-[60%] group-hover:h-[70%] transition-all duration-700 delay-75"></div>
                   <div className="w-4 bg-indigo-400 rounded-t-md h-[30%] group-hover:h-[45%] transition-all duration-700 delay-100"></div>
                   <div className="w-4 bg-indigo-600 rounded-t-md h-[80%] group-hover:h-[95%] transition-all duration-700 delay-150 shadow-lg shadow-indigo-200"></div>
                </div>
              )}
              {review.visualType === 'table' && (
                <div className="space-y-2 opacity-70">
                   <div className="flex gap-2">
                      <div className="h-2 w-1/3 bg-slate-200 rounded-full"></div>
                      <div className="h-2 w-2/3 bg-slate-200 rounded-full"></div>
                   </div>
                   <div className="flex gap-2">
                      <div className="h-2 w-1/4 bg-slate-200 rounded-full"></div>
                      <div className="h-2 w-3/4 bg-indigo-100 rounded-full"></div>
                   </div>
                   <div className="flex gap-2">
                      <div className="h-2 w-1/2 bg-slate-200 rounded-full"></div>
                      <div className="h-2 w-1/2 bg-emerald-100 rounded-full"></div>
                   </div>
                </div>
              )}
              {review.visualType === 'success' && (
                <div className="flex items-center justify-center h-full">
                   <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl animate-bounce">
                      👋
                   </div>
                </div>
              )}
            </div>

            <p className="text-slate-600 font-medium leading-relaxed mb-8 italic">
              &quot;{review.text}&quot;
            </p>

            <div className="flex items-center gap-4 border-t border-slate-50 pt-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-600">
                {review.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">{review.name}</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{review.role}</p>
              </div>
              <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">
                Member
              </span>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

export default Testimonials;
