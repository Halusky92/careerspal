
import React from 'react';

const Testimonials: React.FC = () => {
  const reviews = [
    {
      name: "Sarah Jenkins",
      role: "Notion Ops Manager",
      text: "Finally, a job board that respects the importance of data. The salary comparison charts helped me negotiate a 20% raise.",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      visualType: "chart"
    },
    {
      name: "David Chen",
      role: "Systems Architect",
      text: "The 'Operational DNA' tables are genius. I knew exactly which companies had the async culture I was looking for. Zero wasted interviews.",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      visualType: "table"
    },
    {
      name: "Elena Rodriguez",
      role: "Head of Remote",
      text: "Thank you for the seamless hiring process. We filled our Lead Consultant role in 4 days thanks to the elite filtering.",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
      visualType: "success"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Community Feedback</h2>
        <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Built for <span className="text-gradient">Data Lovers.</span></h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reviews.map((review, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
            
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
              "{review.text}"
            </p>

            <div className="flex items-center gap-4 border-t border-slate-50 pt-6">
              <img src={review.image} alt={review.name} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
              <div>
                <h4 className="font-black text-slate-900 text-sm">{review.name}</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{review.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Testimonials;
