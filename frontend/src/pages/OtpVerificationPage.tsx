import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { getDefaultRouteForUser } from '../routes/AppRoutes'
import { RefreshCw, ArrowRight, Loader2, AlertCircle, Mail } from 'lucide-react'
import { getFriendlyError } from '../utils/getFriendlyError'

export const OtpVerificationPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useNotificationStore()
  const { user, isAuthenticated, setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [errorBanner, setErrorBanner] = useState<{ title: string; message: string } | null>(null)

  const initialEmail = (location.state as { email?: string })?.email || user?.email || ''
  const [email] = useState(initialEmail)

  const fromRegistration = (location.state as { fromRegistration?: boolean })?.fromRegistration || false
  const [sendingMsgVisible, setSendingMsgVisible] = useState(fromRegistration)

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    document.title = 'Verify email · Aquzio'
  }, [])

  useEffect(() => {
    if (sendingMsgVisible) {
      const timer = setTimeout(() => setSendingMsgVisible(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [sendingMsgVisible])

  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      const targetRoute = getDefaultRouteForUser(user)
      navigate(targetRoute, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleOtpChange = (value: string, index: number) => {
    setErrorBanner(null)
    const cleanValue = value.replace(/[^0-9]/g, '')
    if (!cleanValue) {
      const newOtp = [...otp]
      newOtp[index] = ''
      setOtp(newOtp)
      return
    }

    const newOtp = [...otp]
    newOtp[index] = cleanValue.substring(cleanValue.length - 1)
    setOtp(newOtp)

    if (index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp]
      newOtp[index - 1] = ''
      setOtp(newOtp)
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    setErrorBanner(null)
    const pastedData = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('')
      setOtp(digits)
      inputRefs.current[5]?.focus()
    } else {
      setErrorBanner({
        title: 'Invalid code format',
        message: 'Please paste a 6-digit numerical verification code.'
      })
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return
    if (!email) {
      setErrorBanner({
        title: 'Missing email',
        message: 'No email address was provided for code dispatch.'
      })
      return
    }

    setResending(true)
    setErrorBanner(null)
    try {
      const response = await authService.sendOtp(email, 'Registration')
      if (response.success) {
        showToast('Verification code sent to your email', 'success')
        setCountdown(60)
      } else {
        const friendly = getFriendlyError(response, 'forgot-password')
        setErrorBanner({
          title: friendly.title,
          message: friendly.message
        })
      }
    } catch (error: any) {
      const friendly = getFriendlyError(error, 'forgot-password')
      setErrorBanner({
        title: friendly.title,
        message: friendly.message
      })
    } finally {
      setResending(false)
    }
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const codeStr = otp.join('')
    if (codeStr.length < 6) {
      setErrorBanner({
        title: 'Incomplete code',
        message: 'Please enter all 6 digits of the verification code.'
      })
      return
    }

    setLoading(true)
    setErrorBanner(null)
    try {
      const response = await authService.verifyOtp({
        email,
        code: codeStr,
        purpose: 'Registration',
      })

      if (response.success) {
        showToast('Email verified successfully', 'success')

        if (response.data && response.data.accessToken) {
          const { accessToken, refreshToken, userId, email, firstName, lastName, tenantId, roles, permissions, isTenantInitialized, tenantStatus } = response.data
          setAuth(accessToken, refreshToken, {
            userId,
            email,
            firstName,
            lastName,
            tenantId,
            roles,
            permissions,
            isTenantInitialized,
            tenantStatus,
            emailVerified: true
          })
          
          if (tenantId && isTenantInitialized) {
            navigate('/company/dashboard', { replace: true })
          } else if (tenantId) {
            navigate('/account-setup', { replace: true })
          } else {
            navigate('/onboarding', { replace: true })
          }
        } else {
          navigate('/onboarding', { replace: true })
        }
      } else {
        const friendly = getFriendlyError(response, 'forgot-password')
        setErrorBanner({
          title: friendly.title,
          message: friendly.message
        })
        setOtp(Array(6).fill(''))
        inputRefs.current[0]?.focus()
      }
    } catch (error: any) {
      const friendly = getFriendlyError(error, 'forgot-password')
      setErrorBanner({
        title: friendly.title,
        message: friendly.message
      })
      setOtp(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="auth-card"
    >
      {/* Top circle mark, title, and subtitle */}
      <div className="flex flex-col items-center text-center select-none mb-6">
        <img
          src="/brand/aquzio-icon-light.png"
          alt="Aquzio"
          className="w-11 h-11 object-contain mb-3"
        />
        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          Verify your email
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1 leading-normal">
          Enter the 6-digit confirmation code sent to your email.
        </p>
      </div>

      {/* Target Email Callout */}
      {email && (
        <div className="p-3 bg-slate-50 border border-[#E3E8EC] rounded-lg flex items-center justify-between text-xs select-none mb-5">
          <span className="text-[#5B6B75] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            <span>Sent to</span>
          </span>
          <span className="font-semibold text-[#05303B] font-mono">{email}</span>
        </div>
      )}

      {/* Friendly Error Banner */}
      <AnimatePresence>
        {errorBanner && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="auth-error-banner mb-5"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-[13px] text-red-900 leading-snug">
                {errorBanner.title}
              </span>
              <span className="text-[13px] text-red-800 leading-snug mt-0.5 block">
                {errorBanner.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleVerifySubmit} className="space-y-5" noValidate>
        {/* 6 Digit Input Boxes */}
        <div className="flex justify-between items-center gap-2" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              disabled={loading}
              ref={(el) => { inputRefs.current[index] = el }}
              onChange={(e) => handleOtpChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="w-12 h-12 text-center text-lg font-bold bg-white border border-[#CBD5DB] rounded-lg text-[#05303B] focus:border-[#12A89A] focus:outline-none focus:ring-2 focus:ring-[#12A89A]/20 transition-all font-mono"
              autoFocus={index === 0}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading || otp.join('').length < 6}
          className="auth-button-primary mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying code...</span>
            </>
          ) : (
            <>
              <span>Verify & Continue</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Resend Code Section */}
      <div className="pt-4 flex flex-col items-center gap-2 text-xs text-[#5B6B75] select-none">
        {countdown > 0 ? (
          <span>
            Resend code in <strong className="text-[#05303B] font-mono">{countdown}s</strong>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending}
            className="auth-link flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>Resend code</span>
          </button>
        )}
      </div>

      {/* Return to Sign in */}
      <div className="pt-4 border-t border-[#E8EDF0] mt-5 text-center text-[13px] text-[#5B6B75] select-none">
        Want to use a different account?{' '}
        <Link to="/login" className="auth-link font-medium">
          Sign in
        </Link>
      </div>
    </motion.div>
  )
}

export default OtpVerificationPage
