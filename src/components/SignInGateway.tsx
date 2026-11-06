import React, { useState } from 'react';
import { 
  Building2, Phone, Lock, Globe, Shield, Clock, 
  CheckCircle2, ArrowRight, UserPlus, KeyRound, Sparkles
} from 'lucide-react';
import { formatDualTime } from '../lib/temporal.ts';

interface SignInGatewayProps {
  onSignInSuccess: (role: string, name: string) => void;
}

export const SignInGateway: React.FC<SignInGatewayProps> = ({ onSignInSuccess }) => {
  const [authTab, setAuthTab] = useState<'whatsapp' | 'password' | 'sso' | 'provisional'>('whatsapp');
  const [phone, setPhone] = useState('+234 803 123 4567');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('adedapo@daenem.com');
  const [password, setPassword] = useState('••••••••••••');
  const [provisionalName, setProvisionalName] = useState('');
  const [provisionalRole, setProvisionalRole] = useState('Farm Attendant');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const now = new Date();
  const dualTime = formatDualTime(now);

  const handleWhatsAppSend = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOtpSent(true);
      setNoticeMessage('6-digit verification code dispatched via WhatsApp (Sandbox Test Code: 492018)');
    }, 600);
  };

  const handleWhatsAppVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignInSuccess('owner', 'Adedapo Daenem');
    }, 400);
  };

  const handlePasswordSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignInSuccess('owner', 'Adedapo Daenem');
    }, 400);
  };

  const handleProvisionalSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignInSuccess('provisional', provisionalName || 'New Employee');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans">
      
      {/* Top Operations Ticker Bar */}
      <header className="bg-[#005A36] text-white text-[12px] px-4 py-2 border-b border-[#00472A] flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#008751] font-semibold text-[11px] tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
            DAENEM FARMS BALOGUN-IKIRE
          </span>
          <span className="hidden md:inline text-emerald-100/90 text-[12px]">Facility Unit 1: Commercial Layers & Feed Mill</span>
        </div>

        <div className="flex items-center gap-4 text-emerald-100 font-mono-numbers text-[12px]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-300" />
            <strong className="text-white">Lagos:</strong> {dualTime.watTime}
          </span>
          <span className="hidden sm:inline text-emerald-300/50">|</span>
          <span className="hidden sm:flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <strong className="text-white">New York:</strong> {dualTime.estTime}
          </span>
          <span className="hidden lg:inline text-emerald-300/90 bg-[#00472A] px-2 py-0.5 rounded text-[11px]">
            Weather: 28°C Scattered Clouds (74% Humidity)
          </span>
        </div>
      </header>

      {/* Main Split Gateway Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
          
          {/* Left Scenic & Editorial Showcase (5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#008751] via-[#005A36] to-[#003822] p-8 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <img 
                  src="/assets/daenem-farms-official-logo.png" 
                  alt="DAENEM Farms" 
                  className="h-10 w-auto object-contain daenem-logo-glow" 
                />
                <div>
                  <h2 className="text-base font-bold tracking-tight text-white leading-tight">DAENEM FARMS</h2>
                  <span className="text-[11px] text-emerald-300 tracking-wider uppercase font-semibold">Balogun-Ikire Facility</span>
                </div>
              </div>

              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#00A86B] text-white">
                  <Shield className="w-3.5 h-3.5" />
                  Official Employee Gateway
                </span>
                
                <h1 className="font-signin-hero text-3xl sm:text-[44px] font-[720] leading-[1.12] text-white">
                  Precision Poultry & Agribusiness Intelligence.
                </h1>
                
                <p className="text-xs text-emerald-100/90 leading-relaxed max-w-md">
                  Centralized operational ledger governing commercial egg production, feed formulation, and cold-chain distribution.
                </p>
              </div>
            </div>

            {/* Station Metrics */}
            <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-emerald-700/60 pt-4 mt-6">
              <div>
                <span className="text-[10px] text-emerald-300 block uppercase font-bold">Livestock</span>
                <span className="text-sm font-bold text-white font-mono-numbers">48,210 Birds</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-300 block uppercase font-bold">Cold Room</span>
                <span className="text-sm font-bold text-white font-mono-numbers">3,420 Crates</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-300 block uppercase font-bold">Feed Silos</span>
                <span className="text-sm font-bold text-white font-mono-numbers">9.7d Runway</span>
              </div>
            </div>
          </div>

          {/* Right Interactive Authentication Panel (7 Cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-signin-hero text-[20px] font-[800] text-slate-900 leading-tight">Welcome Back</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Select your verification method to sign in</p>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#008751] bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                  WAT Lagos
                </span>
              </div>

              {noticeMessage && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{noticeMessage}</span>
                </div>
              )}

              {/* Auth Mode Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setAuthTab('whatsapp'); setOtpSent(false); }}
                  className={`py-2 rounded-lg transition cursor-pointer text-center ${
                    authTab === 'whatsapp' ? 'bg-white text-[#008751] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  WhatsApp OTP
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('password')}
                  className={`py-2 rounded-lg transition cursor-pointer text-center ${
                    authTab === 'password' ? 'bg-white text-[#008751] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('sso')}
                  className={`py-2 rounded-lg transition cursor-pointer text-center ${
                    authTab === 'sso' ? 'bg-white text-[#008751] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Enterprise SSO
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('provisional')}
                  className={`py-2 rounded-lg transition cursor-pointer text-center ${
                    authTab === 'provisional' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  48h Signup
                </button>
              </div>

              {/* Mode 1: WhatsApp OTP */}
              {authTab === 'whatsapp' && (
                <div>
                  {!otpSent ? (
                    <form onSubmit={handleWhatsAppSend} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1">
                          Registered WhatsApp Number
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="font-signin-input w-full pl-9 pr-3 py-2 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                            required
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Send WhatsApp Verification Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleWhatsAppVerify} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1">
                          Enter 6-Digit WhatsApp Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="e.g. 492018"
                          className="w-full text-center text-xl tracking-[0.4em] font-mono py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden font-bold"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Verify & Enter IkireFarmPortal</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Mode 2: Password */}
              {authTab === 'password' && (
                <form onSubmit={handlePasswordSignIn} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="font-signin-input w-full px-3 py-2 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="font-signin-input w-full px-3 py-2 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    Sign In with Password
                  </button>
                </form>
              )}

              {/* Mode 3: SSO */}
              {authTab === 'sso' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => onSignInSuccess('owner', 'Adedapo Daenem (Google SSO)')}
                    className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[12.5px] font-[600] rounded-lg shadow-xs flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    Continue with Google Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => onSignInSuccess('owner', 'Adedapo Daenem (Microsoft 365)')}
                    className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[12.5px] font-[600] rounded-lg shadow-xs flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    Continue with Microsoft Entra ID
                  </button>
                </div>
              )}

              {/* Mode 4: 48h Provisional Registration */}
              {authTab === 'provisional' && (
                <form onSubmit={handleProvisionalSignup} className="space-y-3">
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                    <strong>48-Hour Provisional Lifecycle:</strong> Unverified signups expire automatically at 48 hours unless explicitly approved by the Farm Administrator.
                  </div>
                  <div>
                    <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={provisionalName}
                      onChange={(e) => setProvisionalName(e.target.value)}
                      placeholder="e.g. Babatunde Adeleke"
                      className="w-full px-3 py-2 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Submit Provisional Registration
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Floating Persona Quick-Login Testing Dock */}
      <div className="p-3 bg-white border-t border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
            Quick Persona Login (Direct Entry):
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSignInSuccess('owner', 'Adedapo Daenem (Owner)')}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#005A36] border border-emerald-300 rounded-lg font-bold transition cursor-pointer"
            >
              Owner Cockpit
            </button>
            <button
              type="button"
              onClick={() => onSignInSuccess('manager', 'Glory Mercy (Farm Manager)')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition cursor-pointer"
            >
              Farm Manager
            </button>
            <button
              type="button"
              onClick={() => onSignInSuccess('finance', 'Folake Adeleke (Financial Controller)')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition cursor-pointer"
            >
              Finance Controller
            </button>
            <button
              type="button"
              onClick={() => onSignInSuccess('veterinary_lead', 'Dr. Segun Adewale (Lead Vet)')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition cursor-pointer"
            >
              Lead Veterinarian
            </button>
            <button
              type="button"
              onClick={() => onSignInSuccess('operator', 'Sunday Okafor (Pen Attendant)')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition cursor-pointer"
            >
              Pen Attendant (My Day)
            </button>
            <button
              type="button"
              onClick={() => onSignInSuccess('provisional', 'Ibrahim Musa (Pending 48h)')}
              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg font-bold transition cursor-pointer"
            >
              Provisional (48h Lock)
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Footer */}
      <footer className="text-center text-xs text-slate-400 py-3 border-t border-slate-200 bg-slate-50">
        © 2026 DAENEM Farms Balogun-Ikire. Independent Repository & Infrastructure. Fail-Closed Zero-Leakage Architecture.
      </footer>

    </div>
  );
};
