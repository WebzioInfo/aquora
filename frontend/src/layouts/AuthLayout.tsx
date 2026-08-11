import React, { useEffect, useMemo } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../components/ui/ToastContainer'
import BRAND from '../config/brand'
import { Globe, HelpCircle } from 'lucide-react'
import { useThemeStore } from '../store/useThemeStore'

export const AuthLayout: React.FC = () => {
  const location = useLocation()
  const { initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [])

  // Determine which background image to use based on the route
  const getBackgroundImage = () => {
    if (location.pathname === '/register') {
      return '/assets/images/aquzio-register-water-packaging-4k.png'
    }
    return '/assets/images/aquzio-login-water-bottling-4k.png'
  }

  const bgImage = useMemo(() => getBackgroundImage(), [location.pathname])

  return (
    <div className="relative h-screen max-h-screen w-full overflow-hidden flex flex-col font-sans text-[#111827] select-none">
      
      {/* 1. FULL-SCREEN IMMERSIVE BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={bgImage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        </AnimatePresence>

        {/* SOFT WHITE TRANSPARENT GRADIENT (PRECISION OVERLAY) */}
        <div 
          className="absolute inset-0 pointer-events-none hidden md:block"
          style={{
            background: `linear-gradient(
              90deg,
              rgba(255,255,255,0) 48%,
              rgba(255,255,255,0.06) 56%,
              rgba(255,255,255,0.20) 64%,
              rgba(255,255,255,0.45) 70%,
              rgba(255,255,255,0.72) 76%,
              rgba(255,255,255,0.90) 82%,
              rgba(255,255,255,0.97) 88%,
              #fff 96%
            )`
          }}
        />

        {/* MOBILE FALLBACK GRADIENT (Centers the fade) */}
        <div 
          className="absolute inset-0 pointer-events-none block md:hidden"
          style={{
            background: `linear-gradient(
              180deg,
              rgba(255,255,255,0.2) 0%,
              rgba(255,255,255,0.8) 40%,
              rgba(255,255,255,0.95) 100%
            )`
          }}
        />
      </div>

      {/* 2. TRANSLUCENT HEADER */}
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between z-20 shrink-0"
        style={{ 
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)'
        }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <img src={BRAND.logo} alt={BRAND.name} className="h-9 w-auto object-contain drop-shadow-sm" />
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-4 text-xs font-semibold text-[#111827] drop-shadow-sm">
          {location.pathname === '/register' && (
            <Link to="/login" className="px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white/90 backdrop-blur-md transition-colors text-[#2563EB]">
              Sign In
            </Link>
          )}
          {location.pathname === '/login' && (
            <Link to="/register" className="px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white/90 backdrop-blur-md transition-colors text-[#2563EB]">
              Create Account
            </Link>
          )}
          <div className="h-4 w-px bg-white/40 hidden sm:block" />
          <button className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
            <Globe className="w-4 h-4" />
            <span>EN</span>
          </button>
          <button className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
            <HelpCircle className="w-4 h-4" />
            <span>Support</span>
          </button>
        </div>
      </header>

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 relative z-10 w-full flex">
        
        {/* The Left Side is open cinematic space (Empty space) */}
        <div className="hidden md:flex flex-1" />

        {/* The Right Side holds the form */}
        <div className="w-full md:w-auto flex-shrink-0 flex items-center justify-center px-6 py-6 md:pr-[8%] lg:pr-[10%] xl:pr-[12%]">
          <div className="w-full max-w-[420px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* 4. TRANSLUCENT FOOTER */}
      <footer className="px-6 lg:px-12 py-4 shrink-0 text-[11px] font-medium text-[#111827] flex items-center justify-between z-20"
        style={{ 
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)'
        }}
      >
        <span className="drop-shadow-sm">© {new Date().getFullYear()} {BRAND.name} Platform</span>
        <div className="flex gap-5 hidden sm:flex drop-shadow-sm">
          <a href="#" className="hover:text-[#2563EB] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#2563EB] transition-colors">Terms</a>
          <a href="#" className="hover:text-[#2563EB] transition-colors">Security</a>
          <a href="#" className="hover:text-[#2563EB] transition-colors">Status</a>
        </div>
      </footer>

      <ToastContainer />
    </div>
  )
}

export default AuthLayout
