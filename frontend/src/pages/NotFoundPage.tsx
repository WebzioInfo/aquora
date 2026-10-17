import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileQuestion, ArrowRight } from 'lucide-react'

export const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Page not found · Aquzio'
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="auth-card"
    >
      <div className="flex flex-col items-center text-center select-none mb-6">
        <div className="w-12 h-12 rounded-full bg-slate-100 border border-[#E3E8EC] flex items-center justify-center text-[#5B6B75] mb-3">
          <FileQuestion className="w-6 h-6 text-[#05303B]" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          Page not found
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1.5 leading-normal max-w-sm">
          We couldn't find the page you were looking for. It may have been moved or deleted.
        </p>
      </div>

      <div className="space-y-3">
        <Link to="/login" className="auth-button-primary no-underline text-center">
          <span>Return to sign in</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="border-t border-[#E8EDF0] pt-4 mt-6 text-center text-[13px] text-[#5B6B75] select-none">
        Need assistance?{' '}
        <a href="mailto:support@aquzio.com" className="auth-link font-medium">
          Contact support
        </a>
      </div>
    </motion.div>
  )
}

export default NotFoundPage
