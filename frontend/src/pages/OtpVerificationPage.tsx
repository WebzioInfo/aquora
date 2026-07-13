import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { getDefaultRouteForUser } from '../routes/AppRoutes'
import { RefreshCw, Key, ShieldCheck, Mail } from 'lucide-react'
import EnterpriseButton from '../components/ui/EnterpriseButton'

export const OtpVerificationPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useNotificationStore()
  const { user, isAuthenticated, setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  // Countdown timer for resend
  const [countdown, setCountdown] = useState(60)

  // Retrieve email passed from registration or cached unverified user
  const initialEmail = (location.state as { email?: string })?.email || user?.email || ''
  const [email, setEmail] = useState(initialEmail)

  // 6-digit OTP input state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auth Guard: Redirect verified users away
  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      const targetRoute = getDefaultRouteForUser(user)
      navigate(targetRoute, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleOtpChange = (value: string, index: number) => {
    const cleanValue = value.replace(/[^0-9]/g, '') // numbers only
    if (!cleanValue) {
      const newOtp = [...otp]
      newOtp[index] = ''
      setOtp(newOtp)
      return
    }

    const newOtp = [...otp]
    newOtp[index] = cleanValue.substring(cleanValue.length - 1)
    setOtp(newOtp)

    // Auto-advance
    if (index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
        inputRefs.current[index - 1]?.focus()
      } else {
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('')
      setOtp(digits)
      inputRefs.current[5]?.focus()
    } else {
      showToast('Please paste a valid 6-digit verification code.', 'error')
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || resending || !email) return
    setResending(true)
    try {
      const response = await authService.resendOtp(email)
      if (response.success) {
        showToast('A new verification code has been dispatched to your email.', 'success')
        setCountdown(60)
        setOtp(Array(6).fill(''))
        inputRefs.current[0]?.focus()
      } else {
        showToast(response.message || 'Resend failed.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Failed to dispatch verification code.'
      showToast(errMsg, 'error')
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) {
      showToast('Please input the complete 6-digit verification code.', 'error')
      return
    }
    if (!email) {
      showToast('Email address is required to proceed.', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await authService.verifyOtp({
        email,
        code,
        purpose: 'Registration'
      })

      if (response.success && response.data) {
        showToast('Email address verified successfully!', 'success')
        setAuth(
          response.data.accessToken,
          response.data.refreshToken,
          {
            userId: response.data.userId,
            email: response.data.email,
            firstName: response.data.firstName,
            lastName: response.data.lastName,
            tenantId: response.data.tenantId,
            roles: response.data.roles,
            permissions: response.data.permissions,
            tenantStatus: response.data.tenantStatus,
            emailVerified: response.data.emailVerified
          }
        )
        navigate('/onboarding', { replace: true })
      } else {
        showToast(response.message || 'Verification failed.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Verification failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {/* Title */}
      <div className="flex flex-col items-center text-center select-none">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-md mb-4">
          <Key className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-[#111827] tracking-tight">Verify Operator Identity</h1>
        <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest font-bold">
          Enter the 6-digit confirmation pin
        </p>
      </div>

      {/* Main Info */}
      <div className="bg-[#F8FAFC] border border-[#E5E7EB] p-4 rounded-xl flex items-center gap-3">
        <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-left text-xs leading-relaxed">
          <span className="text-slate-500 block">Code dispatched to:</span>
          {email ? (
            <strong className="text-slate-800 font-mono select-all block break-all">{email}</strong>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="bg-transparent text-slate-850 font-mono border-b border-[#E5E7EB] outline-none w-full mt-0.5 focus:border-blue-600 transition-colors"
            />
          )}
        </div>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-700 select-none text-left">
            Confirmation Code *
          </label>
          {/* 6 Digit Inputs */}
          <div className="flex justify-between items-center gap-2 relative" onPaste={handlePaste}>
            {/* Hidden input for E2E testing compatibility */}
            <input
              type="text"
              name="code"
              maxLength={6}
              value={otp.join('')}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '').substring(0, 6)
                const digits = val.split('')
                const newOtp = Array(6).fill('')
                for (let i = 0; i < digits.length; i++) {
                  newOtp[i] = digits[i]
                }
                setOtp(newOtp)
                const focusIdx = Math.min(digits.length, 5)
                inputRefs.current[focusIdx]?.focus()
              }}
              className="absolute opacity-0 -z-50 pointer-events-none w-1 h-1"
              autoComplete="off"
            />
            {otp.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={digit}
                disabled={loading}
                ref={(el) => { inputRefs.current[idx] = el; }}
                onChange={(e) => handleOtpChange(e.target.value, idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="w-12 h-12 text-center text-lg font-bold bg-white border border-[#D0D5DD] rounded-lg text-[#111827] placeholder:text-slate-350 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                placeholder="0"
                autoFocus={idx === 0}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <EnterpriseButton
          type="submit"
          loading={loading}
          disabled={!email || otp.join('').length < 6}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-none shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all font-bold text-white text-sm"
        >
          Verify Pin
        </EnterpriseButton>
      </form>

      {/* Resend Actions & Countdown */}
      <div className="flex justify-between items-center text-xs select-none p-1 border-t border-[#E5E7EB] pt-4">
        {countdown > 0 ? (
          <span className="text-slate-500 flex items-center gap-1.5 font-medium">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
            <span>Resend available in <strong className="font-mono text-slate-800">{countdown}s</strong></span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-blue-600 font-bold hover:text-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer hover:underline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>Resend Verification Code</span>
          </button>
        )}

        <Link
          to="/login"
          className="text-slate-500 hover:text-slate-800 font-bold transition-colors"
        >
          Back to Login
        </Link>
      </div>

      {/* Security badge */}
      <div className="pt-3 border-t border-[#E5E7EB] text-center flex flex-col items-center gap-2 select-none">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          <ShieldCheck className="w-3 h-3 text-blue-600" />
          <span>Identity Verification Layer</span>
        </div>
      </div>
    </div>
  )
}

export default OtpVerificationPage
