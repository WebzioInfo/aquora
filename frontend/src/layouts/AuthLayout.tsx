import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import ToastContainer from '../components/ui/ToastContainer'
import { Droplet, HelpCircle, Globe } from 'lucide-react'

export const AuthLayout: React.FC = () => {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#111827] flex flex-col font-sans relative overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        {/* Soft background blue tint */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
      </div>

      {/* Header */}
      <header className="z-10 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] flex justify-between items-center px-6 md:px-12 py-4 w-full">
        <div className="flex items-center gap-3 select-none">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <Droplet className="w-5 h-5 text-white fill-white animate-pulse" />
          </div>
          <span className="text-base font-extrabold tracking-wider uppercase text-slate-800">
            Aquora ERP
          </span>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          {location.pathname === '/register' && (
            <Link
              to="/login"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider cursor-pointer"
            >
              Sign In
            </Link>
          )}
          {location.pathname === '/login' && (
            <Link
              to="/register"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider cursor-pointer"
            >
              Register
            </Link>
          )}
          <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-850 transition-colors select-none cursor-pointer">
            <Globe className="w-3.5 h-3.5" />
            <span>EN</span>
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-850 transition-colors select-none cursor-pointer">
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Support</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow z-10 flex items-center justify-center px-4 relative py-12 md:py-20">
        {/* Auth Card Panel (Light theme, White bg, subtle shadow) */}
        <div className="w-full max-w-[460px] bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 md:p-10 flex flex-col gap-6">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="z-10 bg-white/80 backdrop-blur-md border-t border-[#E5E7EB] text-slate-500 text-[11px] flex flex-col sm:flex-row justify-between items-center px-6 md:px-12 py-5 w-full select-none gap-3 sm:gap-0">
        <div className="flex items-center gap-2 opacity-80">
          <span>© {new Date().getFullYear()} Aquora ERP. Industrial Water Plant MES.</span>
        </div>
        <div className="flex gap-6 font-semibold">
          <a className="hover:text-blue-600 transition-colors" href="#">Legal Compliance</a>
          <a className="hover:text-blue-600 transition-colors" href="#">Data Governance</a>
          <a className="hover:text-blue-600 transition-colors" href="#">System Status</a>
        </div>
      </footer>
      <ToastContainer />
    </div>
  )
}
export default AuthLayout
