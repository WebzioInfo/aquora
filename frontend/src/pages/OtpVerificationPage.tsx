import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { getDefaultRouteForUser } from '../routes/AppRoutes'
import { RefreshCw, Key, ArrowRight, Loader2 } from 'lucide-react'

export const OtpVerificationPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useNotificationStore()
  const { user, isAuthenticated, setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)

  const initialEmail = (location.state as { email?: string })?.email || user?.email || ''
  const [email, setEmail] = useState(initialEmail)
  
  const fromRegistration = (location.state as { fromRegistration?: boolean })?.fromRegistration || false
  const [sendingMsgVisible, setSendingMsgVisible] = useState(fromRegistration)

  useEffect(() => {
    if (sendingMsgVisible) {
      const timer = setTimeout(() => setSendingMsgVisible(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [sendingMsgVisible])

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
    const pastedData = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('')
      setOtp(digits)
      inputRefs.current[5]?.focus()
    } else {
      showToast('Please paste a valid 6-digit verification PIN.', 'error')
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return
    if (!email) {
      showToast('No email address provided for verification code dispatch.', 'error')
      return
    }

    setResending(true)
    try {
      const response = await authService.sendOtp(email, 'Registration')
      if (response.success) {
        showToast('Verification PIN dispatched to your email.', 'success')
        setCountdown(60)
      } else {
        showToast(response.message || 'Failed to dispatch verification PIN.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Dispatch failed.'
      showToast(errMsg, 'error')
    } finally {
      setResending(false)
    }
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const codeStr = otp.join('')
    if (codeStr.length < 6) {
      showToast('Please enter the complete 6-digit confirmation PIN.', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await authService.verifyOtp({
        email,
        code: codeStr,
        purpose: 'Registration',
      })

      if (response.success) {
        showToast('Email verified successfully!', 'success')
        
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
          
          const targetRoute = getDefaultRouteForUser(response.data)
          navigate(targetRoute)
        } else if (user) {
          setAuth(useAuthStore.getState().accessToken || '', useAuthStore.getState().refreshToken || '', {
            ...user,
            emailVerified: true
          })
          const targetRoute = getDefaultRouteForUser({ ...user, emailVerified: true })
          navigate(targetRoute)
        } else {
          navigate('/login')
        }
      } else {
        showToast(response.message || 'Invalid verification PIN.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Verification failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex justify-center items-center font-sans">
      
      {/* FRESH WHITE SURFACE */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xs p-8 sm:p-9 space-y-5 relative"
      >
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 select-none">
          <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs mb-0.5">
            <Key className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
            Verify Email Address
          </h2>
          <p className="text-xs font-medium text-[#6B7280]">
            Enter the 6-digit PIN sent to your email
          </p>
        </div>

        {/* Email Address Display */}
        <div className="p-3 bg-[#FAFBFC] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs select-none">
          <span className="text-[#6B7280] font-medium">Target Email:</span>
          <span className="font-bold text-[#111827] font-mono">{email || 'user@company.com'}</span>
        </div>

        {sendingMsgVisible && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium select-none">
            A 6-digit verification PIN has been dispatched to your email address.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerifySubmit} className="space-y-5">

          {/* 6 OTP Boxes */}
          <div className="flex justify-between items-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                value={digit}
                disabled={loading}
                ref={(el) => { inputRefs.current[index] = el }}
                onChange={(e) => handleOtpChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-11 h-13 text-center text-xl font-bold bg-white border border-[#E5E7EB] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB] transition-all outline-none"
                autoFocus={index === 0}
              />
            ))}
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading || otp.join('').length < 6}
            className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Verifying PIN...</span>
              </>
            ) : (
              <>
                <span>Verify & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>

        </form>

        {/* Resend PIN Row */}
        <div className="pt-1 flex flex-col items-center gap-2 text-xs text-[#6B7280] select-none">
          {countdown > 0 ? (
            <span>Resend code in <strong className="text-[#111827] font-mono">{countdown}s</strong></span>
          ) : (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending}
              className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              <span>Resend Verification PIN</span>
            </button>
          )}
        </div>

        {/* Return to Sign In */}
        <div className="pt-2 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          Want to use a different account?{' '}
          <Link to="/login" className="font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
            Return to Sign In
          </Link>
        </div>

      </motion.div>

    </div>
  )
}

export default OtpVerificationPage
