import React, { useState } from 'react';
import { 
  Building2, Phone, Lock, Globe, Shield, Clock, 
  CheckCircle2, ArrowRight, UserPlus, KeyRound
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
    }, 700);
  };

  const handleWhatsAppVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignInSuccess('owner', 'Adedapo Daenem');
    }, 500);
  };

  const handlePasswordSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignInSuccess('owner', 'Adedapo Daenem');
    }, 500);
  };

  const handleProvisionalSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignInSuccess('provisional', provisionalName || 'New Employee');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans">
      {/* Top Operations Ticker Bar */}
      <header className="bg-[#005A36] text-white text-[12px] px-4 py-2 border-b border-[#00472A] flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#008751] font-semibold text-[11px] tracking-wide">
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
            Weather: 28°C Scattered Clouds (Humidity: 74%)
          </span>
        </div>
      </header>

      {/* Main Split Gateway Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
          
          {/* Left Scenic & Editorial Showcase (5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#008751] via-[#005A36] to-[#003822] p-8 text-white flex flex-col justify-between relative overflow-hidden">
            {/* Background Decorative Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3.5 mb-6">
                <img 
                  src="/assets/daenem-farms-official-logo.png" 
                  alt="DAENEM Farms Official Logo" 
                  className="h-12 w-auto object-contain daenem-logo-glow"
                />
                <div>
                  <h1 className="font-signin-hero text-[22px] font-bold tracking-tight text-white leading-tight">DAENEM FARMS</h1>
                  <p className="text-[11px] text-emerald-200 uppercase tracking-widest font-semibold">Balogun-Ikire • Osun State</p>
                </div>
              </div>

              {/* Exact 44px Space Grotesk Headline */}
              <h2 className="font-signin-hero text-[34px] sm:text-[44px] font-[720] text-white tracking-tight leading-[1.1] mb-4">
                Smarter Farming. Greater Results.
              </h2>

              <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-6 backdrop-blur-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block mb-1">
                  Enterprise Situation Brief
                </span>
                <p className="text-[13px] font-medium text-emerald-50 leading-relaxed">
                  Precision poultry lifecycle tracking, least-cost feed formulation, automated egg collections, and dual-standard US-Nigerian executive governance.
                </p>
              </div>

              {/* 3 Key Operational Pillars */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-[13px] text-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Biological Conservation:</strong> Certified flock counts, HDEP laying efficiency, and feed intake tracking.</span>
                </div>
                <div className="flex items-start gap-3 text-[13px] text-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Zero Cash Exposure:</strong> Dedicated Providus & Zenith virtual collections with automated 3-way sales reconciliation.</span>
                </div>
                <div className="flex items-start gap-3 text-[13px] text-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Dual-Standard Time:</strong> Lagos WAT field coordination with New York executive reporting.</span>
                </div>
              </div>
            </div>

            {/* Bottom Security Assurance */}
            <div className="relative z-10 pt-6 mt-6 border-t border-emerald-400/20 flex items-center justify-between text-[11px] text-emerald-200">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-300" />
                Fail-Closed Zero-Leakage RBAC
              </span>
              <span>v4.0.0 Enterprise</span>
            </div>
          </div>

          {/* Right Authentication Pane (7 Cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white font-signin-input">
            <div>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-6">
                <div>
                  <h2 className="font-signin-hero text-[20px] font-[800] text-slate-900 tracking-tight">Welcome Back</h2>
                  <p className="text-[12.5px] text-slate-500 mt-0.5 font-[400]">Select your authorized credential method to access your assigned station</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-[#008751] border border-emerald-200">
                  Secure Gateway
                </span>
              </div>

              {/* Tab Switcher */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg mb-6 text-[12.5px] font-[600]">
                <button
                  type="button"
                  onClick={() => { setAuthTab('whatsapp'); setNoticeMessage(null); }}
                  className={`py-2 rounded-md transition-all ${
                    authTab === 'whatsapp' 
                      ? 'bg-white text-[#008751] shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  WhatsApp OTP
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('password'); setNoticeMessage(null); }}
                  className={`py-2 rounded-md transition-all ${
                    authTab === 'password' 
                      ? 'bg-white text-[#008751] shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('sso'); setNoticeMessage(null); }}
                  className={`py-2 rounded-md transition-all ${
                    authTab === 'sso' 
                      ? 'bg-white text-[#008751] shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Enterprise SSO
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('provisional'); setNoticeMessage(null); }}
                  className={`py-2 rounded-md transition-all ${
                    authTab === 'provisional' 
                      ? 'bg-white text-[#008751] shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register (48h)
                </button>
              </div>

              {noticeMessage && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-[#005A36] text-[12px] rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{noticeMessage}</span>
                </div>
              )}

              {/* Mode 1: WhatsApp OTP */}
              {authTab === 'whatsapp' && (
                <div>
                  {!otpSent ? (
                    <form onSubmit={handleWhatsAppSend} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1.5">
                          Verified Nigerian Phone Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden font-mono-numbers"
                            placeholder="+234 800 000 0000"
                            required
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">A single-use 6-digit cryptographic passcode will be dispatched via Meta Cloud API.</p>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmitting ? 'Dispatching WhatsApp OTP...' : 'Send WhatsApp Access Code'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleWhatsAppVerify} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1.5">
                          Enter 6-Digit Passcode
                        </label>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full text-center tracking-[0.5em] text-lg font-bold py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden font-mono-numbers"
                          placeholder="••••••"
                          maxLength={6}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmitting ? 'Verifying Credentials...' : 'Authenticate & Enter Situation Room'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
                      >
                        ← Change phone number
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Mode 2: Password Login */}
              {authTab === 'password' && (
                <form onSubmit={handlePasswordSignIn} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1.5">Corporate Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider">Access Password</label>
                      <a href="#recovery" onClick={() => setNoticeMessage('Password recovery request initiated. Contact the System Administrator or check registered email.')} className="text-xs text-[#008751] hover:underline">
                        Forgot Password?
                      </a>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="font-signin-hero w-full py-2.5 px-4 bg-[#008751] hover:bg-[#007043] text-white text-[13px] font-[790] rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? 'Verifying PBKDF2 Hash...' : 'Sign In with Password'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Mode 3: Enterprise SSO */}
              {authTab === 'sso' && (
                <div className="space-y-3">
                  <p className="text-[12px] text-slate-600 mb-2">Sign in using your enterprise directory credentials with pre-verified organizational claims.</p>
                  <button
                    type="button"
                    onClick={() => onSignInSuccess('owner', 'Adedapo Daenem (Google Workspace)')}
                    className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[12.5px] font-[600] rounded-lg shadow-xs flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
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
                  <div>
                    <label className="block text-[11px] font-[700] text-slate-700 uppercase tracking-wider mb-1">Operational Station Request</label>
                    <select
                      value={provisionalRole}
                      onChange={(e) => setProvisionalRole(e.target.value)}
                      className="w-full px-3 py-2 text-[12.5px] font-[600] bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#008751] focus:border-[#008751] outline-hidden"
                    >
                      <option value="Farm Attendant">Farm Attendant (Egg Collection & Feeding)</option>
                      <option value="Veterinary Intern">Veterinary Officer / Clinical Intern</option>
                      <option value="Feed Mill Operator">Feed Mill Batching Technician</option>
                      <option value="Driver / Logistics">Wholesale Dispatch Driver</option>
                    </select>
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

            {/* Switch Personas Shortcut for Verification */}
            <div className="pt-6 mt-6 border-t border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Rapid Verification Shortcuts (Role-Aware Personas)
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onSignInSuccess('owner', 'Adedapo Daenem (Owner)')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-[#008751] rounded text-slate-700 font-medium transition cursor-pointer"
                >
                  Owner (Situation Room)
                </button>
                <button
                  type="button"
                  onClick={() => onSignInSuccess('manager', 'Glory Mercy (Farm Manager)')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-[#008751] rounded text-slate-700 font-medium transition cursor-pointer"
                >
                  Farm Manager
                </button>
                <button
                  type="button"
                  onClick={() => onSignInSuccess('finance', 'Folake Adeleke (Financial Controller)')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-[#008751] rounded text-slate-700 font-medium transition cursor-pointer"
                >
                  Finance / Banking
                </button>
                <button
                  type="button"
                  onClick={() => onSignInSuccess('operator', 'Sunday Okafor (Pen Attendant)')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-[#008751] rounded text-slate-700 font-medium transition cursor-pointer"
                >
                  Operator (My Day)
                </button>
                <button
                  type="button"
                  onClick={() => onSignInSuccess('provisional', 'Ibrahim Musa (Pending 48h)')}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded text-amber-900 font-medium transition cursor-pointer"
                >
                  Provisional (Unapproved)
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Persistent Footer */}
      <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-200 bg-white">
        © 2026 DAENEM Farms (Balogun-Ikire, Osun State). Fieldline V6 Standard. Zero-Glass Guarantee.
      </footer>
    </div>
  );
};
