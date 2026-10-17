import React, { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import ToastContainer from '../components/ui/ToastContainer'
import { Globe } from 'lucide-react'
import { useThemeStore } from '../store/useThemeStore'

export const AuthLayout: React.FC = () => {
  const location = useLocation()
  const { initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  const isLoginPage = location.pathname === '/login'
  const isRegisterPage = location.pathname === '/register'

  return (
    <div className="relative min-h-screen h-screen w-full flex flex-col justify-between overflow-x-hidden overflow-y-auto font-sans text-slate-900 select-none">

      {/* 1. FACTORY TEXTURE BACKGROUND WITH FLAT BRAND-INK OVERLAY (NO BLUR) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/assets/images/aquzio-login-water-bottling-4k.png"
          alt=""
          aria-hidden="true"
          decoding="async"
          className="w-full h-full object-cover"
        />
        {/* Flat brand ink overlay at 83% opacity */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(5, 48, 59, 0.83)' }}
          aria-hidden="true"
        />
      </div>

      {/* 2. TRANSPARENT TOP BAR (NO BLUR) */}
      <header className="relative z-10 w-full px-5 sm:px-8 lg:px-12 h-16 shrink-0 flex items-center justify-between">
        {/* Full Aquzio Logo (white variant on dark overlay) */}
        <Link to="/" className="flex items-center gap-2 focus:outline-none" aria-label="Aquzio Home">
          <img
            src="/brand/aquzio-logo-white.png"
            alt="Aquzio"
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </Link>

        {/* Quiet text links on right */}
        <nav className="flex items-center gap-5 sm:gap-6 text-[13px] font-medium" aria-label="Secondary navigation">
          {isLoginPage && (
            <Link
              to="/register"
              className="hidden sm:inline-block text-white/80 hover:text-white transition-colors duration-150"
            >
              Create account
            </Link>
          )}

          {isRegisterPage && (
            <Link
              to="/login"
              className="hidden sm:inline-block text-white/80 hover:text-white transition-colors duration-150"
            >
              Sign in
            </Link>
          )}

          <a
            href="mailto:support@aquzio.com"
            className="text-white/70 hover:text-white transition-colors duration-150"
          >
            Support
          </a>

          <span className="text-white/60 text-[11px] font-semibold px-2 py-0.5 rounded border border-white/20 select-none">
            EN
          </span>
        </nav>
      </header>

      {/* 3. MAIN CENTERED CONTENT CONTAINER */}
      <main className="relative z-10 w-full flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full flex justify-center items-center">
          <Outlet />
        </div>
      </main>

      {/* 4. TRANSPARENT FOOTER */}
      <footer className="relative z-10 w-full px-5 sm:px-8 lg:px-12 py-3.5 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[12px] text-white/70 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span>© 2026 Aquzio</span>
          <span className="text-white/30 hidden sm:inline">·</span>
          <span className="text-white/50 text-[11px] sm:text-[12px]">A product of Webzio Technology</span>
        </div>

        <div className="flex items-center gap-4 text-[12px]">
          <a href="#" className="hover:text-white transition-colors duration-150">Privacy</a>
          <a href="#" className="hover:text-white transition-colors duration-150">Terms</a>
          <a href="#" className="hover:text-white transition-colors duration-150">Security</a>
          <a href="#" className="hover:text-white transition-colors duration-150">Status</a>
        </div>
      </footer>

      <ToastContainer />
    </div>
  )
}

export default AuthLayout
