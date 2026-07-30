import React, { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../components/ui/ToastContainer'
import {
  Droplet, Check, Sun, Moon, Globe, HelpCircle, ExternalLink
} from 'lucide-react'
import { useThemeStore } from '../store/useThemeStore'

export const AuthLayout: React.FC = () => {
  const location = useLocation()
  const { theme, toggleTheme, initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [])

  // Page-specific Water Manufacturing Abstract SVG Vector Backgrounds (Edge-positioned, 3-6% opacity)
  const renderWaterBackground = () => {
    switch (location.pathname) {
      case '/register':
        return (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
            {/* Top-Right Abstract Manufacturing Fluid Ribbon (Opacity 4%) */}
            <svg className="absolute -top-16 -right-16 w-[550px] h-[550px] opacity-100 text-blue-500" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 0 C 250 150, 450 100, 600 300 C 600 450, 400 550, 600 600 L 600 0 Z" fill="url(#blue-gradient-top)" fillOpacity="0.08" />
              <path d="M150 0 C 300 200, 500 150, 600 380" stroke="url(#blue-line-grad)" strokeWidth="1.5" strokeOpacity="0.12" />
              <path d="M200 0 C 350 250, 550 200, 600 450" stroke="url(#blue-line-grad)" strokeWidth="1" strokeOpacity="0.08" />
              <defs>
                <linearGradient id="blue-gradient-top" x1="0" y1="0" x2="600" y2="600" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563EB" />
                  <stop offset="1" stopColor="#0EA5E9" />
                </linearGradient>
                <linearGradient id="blue-line-grad" x1="0" y1="0" x2="600" y2="600" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563EB" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>

            {/* Bottom-Left Fluid Growth Curve (Opacity 3.5%) */}
            <svg className="absolute -bottom-20 -left-20 w-[550px] h-[550px] opacity-85 text-cyan-500" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 600 C 200 400, 300 500, 500 350 C 550 250, 450 100, 600 0 L 0 0 Z" fill="url(#cyan-gradient-bottom)" fillOpacity="0.06" />
              <path d="M0 500 C 250 350, 350 450, 550 250" stroke="#06B6D4" strokeWidth="1.5" strokeOpacity="0.1" />
              <defs>
                <linearGradient id="cyan-gradient-bottom" x1="0" y1="600" x2="600" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#06B6D4" />
                  <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )
      case '/verify-otp':
        return (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
            {/* Top-Right Concentric Fluid Ripple Rings (Opacity 4%) */}
            <svg className="absolute -top-24 -right-24 w-[600px] h-[600px] opacity-40 text-blue-500" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="500" cy="100" r="120" stroke="#2563EB" strokeWidth="1.5" strokeOpacity="0.1" />
              <circle cx="500" cy="100" r="220" stroke="#0EA5E9" strokeWidth="1.5" strokeOpacity="0.08" />
              <circle cx="500" cy="100" r="320" stroke="#06B6D4" strokeWidth="1.5" strokeOpacity="0.06" strokeDasharray="6 6" />
              <circle cx="500" cy="100" r="420" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.04" />
            </svg>

            {/* Bottom-Left Particle Nodes */}
            <svg className="absolute -bottom-20 -left-20 w-[500px] h-[500px] opacity-35" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="400" r="160" stroke="#0EA5E9" strokeWidth="1" strokeOpacity="0.08" />
              <circle cx="100" cy="400" r="260" stroke="#2563EB" strokeWidth="1" strokeOpacity="0.06" strokeDasharray="4 4" />
            </svg>
          </div>
        )
      case '/login':
      default:
        return (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
            {/* Top-Right Flowing Water Wave Vector (Opacity 4%) */}
            <svg className="absolute -top-20 -right-20 w-[620px] h-[620px] opacity-40 text-blue-600" viewBox="0 0 650 650" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M150 0 C 300 180, 480 120, 650 320 C 650 480, 450 580, 650 650 L 650 0 Z" fill="url(#water-wave-top)" fillOpacity="0.07" />
              <path d="M220 0 C 360 220, 520 160, 650 400" stroke="url(#water-line-top)" strokeWidth="1.5" strokeOpacity="0.12" />
              <path d="M290 0 C 420 260, 560 200, 650 480" stroke="url(#water-line-top)" strokeWidth="1" strokeOpacity="0.08" />
              <defs>
                <linearGradient id="water-wave-top" x1="0" y1="0" x2="650" y2="650" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563EB" />
                  <stop offset="0.6" stopColor="#0EA5E9" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
                <linearGradient id="water-line-top" x1="0" y1="0" x2="650" y2="650" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563EB" />
                  <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>

            {/* Bottom-Left Fluid Water Ripple Vector (Opacity 3.5%) */}
            <svg className="absolute -bottom-24 -left-24 w-[600px] h-[600px] opacity-35 text-cyan-500" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 600 C 180 420, 320 520, 520 380 C 580 280, 480 140, 600 0 L 0 0 Z" fill="url(#water-wave-bottom)" fillOpacity="0.05" />
              <path d="M0 520 C 220 360, 360 460, 560 300" stroke="#0EA5E9" strokeWidth="1.5" strokeOpacity="0.1" />
              <path d="M0 440 C 260 300, 400 400, 600 220" stroke="#06B6D4" strokeWidth="1" strokeOpacity="0.07" />
              <defs>
                <linearGradient id="water-wave-bottom" x1="0" y1="600" x2="600" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#06B6D4" />
                  <stop offset="1" stopColor="#0EA5E9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )
    }
  }

  // Page-specific Flat Monochrome SVG Illustrations for Left Panel
  const renderLeftIllustration = () => {
    switch (location.pathname) {
      case '/register':
        return (
          <div className="w-full p-4 rounded-xl bg-white border border-[#E5E7EB] shadow-xs">
            <svg className="w-full h-20 text-slate-400" viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="24" y="20" width="64" height="40" rx="6" className="stroke-slate-400 fill-slate-50" strokeWidth="1.5" />
              <path d="M36 40 H76 M36 48 H60" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M88 40 H136" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="136" y="20" width="64" height="40" rx="6" className="stroke-blue-600 fill-blue-50/50" strokeWidth="1.5" />
              <circle cx="168" cy="40" r="8" className="stroke-blue-600" strokeWidth="1.5" />
              <path d="M200 40 H248" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="248" y="20" width="48" height="40" rx="6" className="stroke-slate-400 fill-slate-50" strokeWidth="1.5" />
            </svg>
          </div>
        )
      case '/verify-otp':
        return (
          <div className="w-full p-4 rounded-xl bg-white border border-[#E5E7EB] shadow-xs">
            <svg className="w-full h-20 text-slate-400" viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="160" cy="40" r="28" className="stroke-blue-600 fill-blue-50/40" strokeWidth="1.5" />
              <circle cx="160" cy="40" r="18" className="stroke-blue-600" strokeWidth="1.5" strokeDasharray="3 3" />
              <path d="M154 40 L158 44 L168 34" className="stroke-blue-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="40" y1="40" x2="132" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="188" y1="40" x2="280" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>
          </div>
        )
      case '/login':
      default:
        return (
          <div className="w-full p-4 rounded-xl bg-white border border-[#E5E7EB] shadow-xs">
            <svg className="w-full h-20 text-slate-400" viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="14" className="stroke-blue-600 fill-blue-50" strokeWidth="1.5" />
              <path d="M40 33 V47 M33 40 H47" className="stroke-blue-600" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="54" y1="40" x2="116" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx="130" cy="40" r="14" className="stroke-slate-400 fill-slate-50" strokeWidth="1.5" />
              <rect x="124" y="34" width="12" height="12" rx="2" className="fill-slate-400" />
              <line x1="144" y1="40" x2="206" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx="220" cy="40" r="14" className="stroke-emerald-600 fill-emerald-50" strokeWidth="1.5" />
              <path d="M214 40 L218 44 L226 34" className="stroke-emerald-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="234" y1="40" x2="290" y2="40" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="290" cy="40" r="3" className="fill-blue-600" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col justify-between font-sans bg-[#FAFBFC] text-[#111827] select-none relative">

      {/* ENTERPRISE WATER MANUFACTURING ABSTRACT BACKGROUND ARTWORK */}
      {renderWaterBackground()}

      {/* HEADER BAR */}
      <header className="px-6 lg:px-12 py-4 flex items-center justify-between z-20 shrink-0 border-b border-[#E5E7EB] bg-[#FAFBFC]/90 backdrop-blur-md">

        {/* Brand Mark */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#2563EB] rounded-xl flex items-center justify-center shadow-xs">
            <Droplet className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-base font-extrabold tracking-wider uppercase text-[#111827]">
            Aquora ERP
          </span>
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#6B7280]">
          {location.pathname === '/register' && (
            <Link to="/login" className="font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              Sign In
            </Link>
          )}
          {location.pathname === '/login' && (
            <Link to="/register" className="font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              Create Account
            </Link>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            title="Toggle theme"
          >
            {/* {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />} */}
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] hidden sm:block" />

          <button className="hidden sm:flex items-center gap-1.5 hover:text-[#111827] transition-colors cursor-pointer">
            <Globe className="w-3.5 h-3.5" />
            <span>EN</span>
          </button>
          <button className="hidden sm:flex items-center gap-1.5 hover:text-[#111827] transition-colors cursor-pointer">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Support</span>
          </button>
        </div>
      </header>

      {/* VIEWPORT: 42% LEFT / 58% RIGHT SPLIT (FIXED 100VH, NO SCROLLBAR) */}
      <main className="flex-1 flex items-center justify-center px-6 lg:px-12 py-2 overflow-hidden z-10">
        <div className="w-full max-w-6xl h-full flex items-center justify-between gap-8 lg:gap-12 my-auto">

          {/* LEFT SIDE PANEL (42% Width Desktop/Tablet, Hidden Mobile) */}
          <div className="hidden md:flex flex-col justify-center w-[42%] space-y-6 shrink-0">

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB]">
                Aquora ERP
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-[#111827] tracking-tight leading-tight">
                Enterprise Manufacturing Platform
              </h1>
              <p className="text-xs lg:text-sm text-[#6B7280] leading-relaxed max-w-md">
                One platform for production, inventory, quality assurance and operations.
              </p>
            </div>

            {/* Benefit Checkmarks */}
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-[#111827]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] shrink-0 stroke-[2.5]" />
                <span>Production Tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] shrink-0 stroke-[2.5]" />
                <span>Inventory</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] shrink-0 stroke-[2.5]" />
                <span>Quality Control</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] shrink-0 stroke-[2.5]" />
                <span>Multi-Plant Operations</span>
              </div>
            </div>

            {/* Route Flat SVG Illustration */}
            <div className="pt-2">
              {renderLeftIllustration()}
            </div>

          </div>

          {/* RIGHT AUTH SURFACE (58% Width Desktop/Tablet, 100% Mobile) */}
          <div className="w-full md:w-[58%] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="w-full flex justify-center"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </main>

      {/* SINGLE LINE FOOTER */}
      <footer className="px-6 lg:px-12 py-3 shrink-0 border-t border-[#E5E7EB] text-[11px] text-[#6B7280] flex items-center justify-between bg-[#FAFBFC]">
        <span>© {new Date().getFullYear()} Aquora ERP Platform</span>
        <div className="flex gap-5 font-medium">
          <a href="#" className="hover:text-[#2563EB] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#2563EB] transition-colors">Terms</a>
          <a href="#" className="hover:text-[#2563EB] transition-colors">Security</a>
          <a href="#" className="hover:text-[#2563EB] transition-colors flex items-center gap-0.5">Status <ExternalLink className="w-3 h-3" /></a>
        </div>
      </footer>

      <ToastContainer />
    </div>
  )
}

export default AuthLayout
