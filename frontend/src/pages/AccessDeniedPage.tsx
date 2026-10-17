import React, { useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/useAuthStore'
import { ShieldAlert, Clock, LockKeyhole, ArrowRight, ArrowLeft } from 'lucide-react'

export const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, clearAuth } = useAuthStore()

  const reason = searchParams.get('reason') || 'denied'

  useEffect(() => {
    if (reason === 'expired') {
      document.title = 'Session expired · Aquzio'
    } else {
      document.title = 'Access restricted · Aquzio'
    }
  }, [reason])

  const handleAction = () => {
    if (reason === 'expired') {
      clearAuth()
      navigate('/login', { replace: true })
      return
    }

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    const roles = user.roles || []
    if (roles.includes('SuperAdmin') || roles.includes('PlatformAdmin')) {
      navigate('/platform/dashboard', { replace: true })
    } else if (roles.includes('Operator')) {
      navigate('/operator', { replace: true })
    } else {
      navigate('/company/dashboard', { replace: true })
    }
  }

  const getScreenConfig = () => {
    switch (reason) {
      case 'unauthorized':
        return {
          icon: <ShieldAlert className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-50 border-amber-200',
          title: 'Permission required',
          description: "You don't have permission to access this area. If you believe this is a mistake, contact your administrator.",
          buttonText: 'Return to dashboard',
        }
      case 'expired':
        return {
          icon: <Clock className="w-6 h-6 text-[#12A89A]" />,
          iconBg: 'bg-[#12A89A]/10 border-[#12A89A]/30',
          title: 'Session expired',
          description: 'Your session has expired due to inactivity. Please sign in again to continue working.',
          buttonText: 'Sign in again',
        }
      case 'locked':
        return {
          icon: <LockKeyhole className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-50 border-red-200',
          title: 'Account locked',
          description: 'This account has been temporarily locked after multiple failed sign-in attempts. Please contact support to unlock it.',
          buttonText: 'Contact support',
          isSupport: true,
        }
      case 'denied':
      default:
        return {
          icon: <ShieldAlert className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-50 border-red-200',
          title: 'Access restricted',
          description: "You don't have access to this page. Check with your administrator to request the necessary permissions.",
          buttonText: 'Return to dashboard',
        }
    }
  }

  const config = getScreenConfig()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="auth-card"
    >
      {/* Centered Icon Header */}
      <div className="flex flex-col items-center text-center select-none mb-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border mb-3 ${config.iconBg}`}>
          {config.icon}
        </div>
        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          {config.title}
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1.5 leading-normal max-w-sm">
          {config.description}
        </p>
      </div>

      {/* Action Button */}
      <div className="space-y-3">
        {config.isSupport ? (
          <a
            href="mailto:support@aquzio.com?subject=Account Access Assistance"
            className="auth-button-primary no-underline text-center"
          >
            <span>{config.buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <button
            type="button"
            onClick={handleAction}
            className="auth-button-primary"
          >
            <span>{config.buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {reason !== 'expired' && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                clearAuth()
                navigate('/login', { replace: true })
              }}
              className="auth-link text-xs"
            >
              Sign in with a different account
            </button>
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="border-t border-[#E8EDF0] pt-4 mt-6 text-center text-[13px] text-[#5B6B75] select-none">
        Need assistance?{' '}
        <a href="mailto:support@aquzio.com" className="auth-link font-medium">
          Contact support
        </a>
      </div>
    </motion.div>
  )
}

export default AccessDeniedPage
