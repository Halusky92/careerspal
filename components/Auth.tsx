
import React, { useState, useEffect } from 'react';

interface AuthProps {
  onAuthSuccess: (user: { email: string; role: 'candidate' | 'employer' }) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [role, setRole] = useState<'candidate' | 'employer'>('employer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isGodMode, setIsGodMode] = useState(false);

  // Matrix Effect Detector
  useEffect(() => {
    if (email.toLowerCase() === 'admin@careerspal.com') {
      setIsGodMode(true);
    } else {
      setIsGodMode(false);
    }
  }, [email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = { email, role };
    localStorage.setItem('cp_user', JSON.stringify(user));
    onAuthSuccess(user);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-24 animate-in fade-in slide-in-from-bottom-4">
      <div 
        className={`
          p-10 rounded-[3.5rem] shadow-2xl border transition-all duration-500
          ${isGodMode 
            ? 'bg-[#0F172A] border-indigo-500/50 shadow-indigo-500/20' 
            : 'bg-white border-slate-50 shadow-indigo-100'}
        `}
      >
        <div className="text-center mb-10">
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black shadow-xl transition-all duration-500
            ${isGodMode ? 'bg-indigo-600 text-white rotate-180 scale-110' : 'bg-indigo-600 text-white shadow-indigo-100'}
          `}>
            {isGodMode ? '👁️' : 'C'}
          </div>
          
          <h1 className={`text-3xl font-black tracking-tight transition-colors duration-300 ${isGodMode ? 'text-white' : 'text-slate-900'}`}>
            {isGodMode ? 'Shadow Protocol' : (isRegister ? 'Join the Ecosystem' : 'Welcome Back')}
          </h1>
          
          <p className={`font-medium mt-2 transition-colors duration-300 ${isGodMode ? 'text-indigo-400 font-mono text-xs uppercase tracking-widest' : 'text-slate-500'}`}>
            {isGodMode ? 'Admin Access Detected' : 'Elite access for Notion-first professionals.'}
          </p>
        </div>

        {!isGodMode && (
          <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1 mb-8">
            <button 
              onClick={() => setRole('employer')} 
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${role === 'employer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              I am Hiring
            </button>
            <button 
              onClick={() => setRole('candidate')} 
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${role === 'candidate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              I am a Talent
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isGodMode ? 'text-indigo-500' : 'text-slate-400'}`}>
              Identity
            </label>
            <input 
              type="email" 
              required 
              placeholder="name@company.com" 
              className={`
                w-full px-5 py-4 rounded-2xl outline-none font-bold transition-all duration-300
                ${isGodMode 
                  ? 'bg-slate-900 border border-indigo-500/30 text-indigo-300 focus:ring-2 focus:ring-indigo-500' 
                  : 'bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-indigo-100'}
              `}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isGodMode ? 'text-indigo-500' : 'text-slate-400'}`}>
              {isGodMode ? 'Security Key' : 'Password'}
            </label>
            <input 
              type="password" 
              required 
              placeholder={isGodMode ? "••••••••••••" : "••••••••"} 
              className={`
                w-full px-5 py-4 rounded-2xl outline-none font-bold transition-all duration-300
                ${isGodMode 
                  ? 'bg-slate-900 border border-indigo-500/30 text-indigo-300 focus:ring-2 focus:ring-indigo-500' 
                  : 'bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-indigo-100'}
              `}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button className={`
            w-full font-black py-5 rounded-2xl shadow-xl active:scale-[0.98] transition-all duration-300
            ${isGodMode 
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/40 tracking-[0.2em]' 
              : 'bg-slate-900 text-white hover:bg-black'}
          `}>
            {isGodMode ? 'ENTER SYSTEM' : (isRegister ? 'Create Elite Account' : 'Sign In Now')}
          </button>
        </form>

        <div className={`mt-8 text-center pt-8 border-t transition-colors ${isGodMode ? 'border-slate-800' : 'border-slate-50'}`}>
          <button onClick={() => setIsRegister(!isRegister)} className={`text-xs font-black uppercase tracking-widest hover:underline ${isGodMode ? 'text-slate-600 pointer-events-none' : 'text-slate-400 hover:text-indigo-600'}`}>
            {isGodMode ? 'Encrypted Connection • v2.4.0' : (isRegister ? 'Already have an account? Log In' : 'No account? Join CareersPal Elite')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
