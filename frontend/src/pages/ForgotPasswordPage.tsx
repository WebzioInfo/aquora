import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { getFriendlyError } from '../utils/getFriendlyError'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  ArrowLeft, Check, AlertCircle, Loader2, RefreshCw
} from 'lucide-react'

type Step = 'email' | 'otp' | 'password' | 'success'

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [errorBanner, setErrorBanner] = useState<{ title?: string; message: string; type?: 'error' | 'warning' | 'info' } | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    document.title = 'Reset password · Aquzio'
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Simple email validity check
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  // Step 1: Submit Email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !isEmailValid) return

    setLoading(true)
    setErrorBanner(null)

    try {
      const res = await authService.forgotPassword(email.trim())
      if (res.success) {
        showToast('Password recovery code sent to your email.', 'success')
        setStep('otp')
        setCountdown(60)
        setOtp(Array(6).fill(''))
      } else {
        const friendly = getFriendlyError(res, 'forgot-password')
        // Neutral account-enumeration protection
        if (friendly.type === 'info') {
          showToast(friendly.message, 'info')
          setStep('otp')
          setCountdown(60)
          setOtp(Array(6).fill(''))
        } else {
          setErrorBanner({ title: friendly.title, message: friendly.message, type: friendly.type })
        }
      }
    } catch (err: any) {
      const friendly = getFriendlyError(err, 'forgot-password')
      if (friendly.statusCode === 404 || friendly.type === 'info') {
        // Unknown email: Neutral confirmation without revealing account existence
        showToast('If this email is registered, a recovery code has been sent.', 'info')
        setStep('otp')
        setCountdown(60)
        setOtp(Array(6).fill(''))
      } else {
        setErrorBanner({ title: friendly.title, message: friendly.message, type: friendly.type })
      }
    } finally {
      setLoading(false)
    }
  }

  // Step 2: OTP Input Controls
  const handleOtpChange = (val: string, index: number) => {
    const clean = val.replace(/[^0-9]/g, '')
    if (!clean) {
      const nextOtp = [...otp]
      nextOtp[index] = ''
      setOtp(nextOtp)
      return
    }

    const nextOtp = [...otp]
    nextOtp[index] = clean.substring(clean.length - 1)
    setOtp(nextOtp)

    if (index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const nextOtp = [...otp]
      nextOtp[index - 1] = ''
      setOtp(nextOtp)
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pasted)) {
      setOtp(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  // Step 2: Submit OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6 || loading) return

    setLoading(true)
    setErrorBanner(null)

    try {
      const res = await authService.verifyPasswordResetOtp(email.trim(), code)
      if (res.success && res.data?.resetToken) {
        setResetToken(res.data.resetToken)
        setStep('password')
        showToast('Verification code confirmed. Choose a new password.', 'success')
      } else {
        const friendly = getFriendlyError(res, 'forgot-password')
        setErrorBanner({ title: friendly.title, message: friendly.message, type: 'error' })
      }
    } catch (err: any) {
      const friendly = getFriendlyError(err, 'forgot-password')
      setErrorBanner({ title: friendly.title, message: friendly.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (resending || countdown > 0) return
    setResending(true)
    setErrorBanner(null)

    try {
      const res = await authService.resendPasswordResetOtp(email.trim())
      if (res.success) {
        showToast('A fresh recovery code has been sent to your email.', 'success')
        setCountdown(60)
        setOtp(Array(6).fill(''))
      } else {
        const friendly = getFriendlyError(res, 'forgot-password')
        setErrorBanner({ title: friendly.title, message: friendly.message, type: 'error' })
      }
    } catch (err: any) {
      const friendly = getFriendlyError(err, 'forgot-password')
      setErrorBanner({ title: friendly.title, message: friendly.message, type: 'error' })
    } finally {
      setResending(false)
    }
  }

  // Step 3: Submit New Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!newPassword || newPassword.length < 8) {
      setErrorBanner({
        title: 'Check your password',
        message: 'Password must be at least 8 characters.',
        type: 'error',
      })
      return
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErrorBanner({
        title: 'Check your password',
        message: 'Password must include uppercase, lowercase, and a number.',
        type: 'error',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorBanner({
        title: 'Passwords do not match',
        message: "Please make sure both passwords match.",
        type: 'error',
      })
      return
    }

    setLoading(true)
    setErrorBanner(null)

    try {
      const res = await authService.resetPassword({
        email: email.trim(),
        resetToken: resetToken || undefined,
        code: !resetToken ? otp.join('') : undefined,
        newPassword,
        confirmPassword
      })

      if (res.success) {
        setStep('success')
        showToast('Password reset successfully! You can now sign in.', 'success')
      } else {
        const friendly = getFriendlyError(res, 'forgot-password')
        setErrorBanner({ title: friendly.title, message: friendly.message, type: 'error' })
      }
    } catch (err: any) {
      const friendly = getFriendlyError(err, 'forgot-password')
      setErrorBanner({ title: friendly.title, message: friendly.message, type: 'error' })
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
      {/* Top of card: Brand light icon (44px, centered), title, subtitle */}
      <div className="flex flex-col items-center text-center select-none mb-6">
        <img
          src="/brand/aquzio-icon-light.png"
          alt="Aquzio"
          className="w-11 h-11 object-contain mb-4"
        />
        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          {step === 'email' && 'Reset your password'}
          {step === 'otp' && 'Enter recovery code'}
          {step === 'password' && 'Create new password'}
          {step === 'success' && 'Password updated'}
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1.5 leading-normal">
          {step === 'email' && "Enter your work email and we'll send a recovery code."}
          {step === 'otp' && `Enter the 6-digit confirmation PIN sent to ${email}`}
          {step === 'password' && 'Choose a strong, unique password for your account.'}
          {step === 'success' && 'Your password has been successfully reset.'}
        </p>
      </div>

      {/* Inline Error / Info Banner */}
      <AnimatePresence>
        {errorBanner && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mb-5 ${
              errorBanner.type === 'info'
                ? 'p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-[13px] flex items-start gap-2.5'
                : 'auth-error-banner'
            }`}
            role="alert"
          >
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${errorBanner.type === 'info' ? 'text-blue-600' : 'text-red-600'}`} />
            <div className="flex-1 text-[13px]">
              {errorBanner.title && (
                <span className="font-semibold block mb-0.5 leading-snug">{errorBanner.title}</span>
              )}
              <span className="leading-snug">{errorBanner.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP 1: Email Form */}
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="forgot-email" className="auth-label">
              Work email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="auth-input pl-10 pr-3.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isEmailValid}
            className="auth-button-primary mt-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending code...</span>
              </>
            ) : (
              <>
                <span>Send recovery code</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: OTP Verification Form */}
      {step === 'otp' && (
        <form onSubmit={handleOtpSubmit} className="space-y-4" noValidate>
          <div className="p-2.5 bg-[#F8FAFC] border border-[#E3E8EC] rounded-lg flex items-center justify-between text-xs">
            <span className="text-[#5B6B75]">Recovery recipient:</span>
            <span className="font-semibold text-[#05303B] font-mono">{email}</span>
          </div>

          <div className="flex justify-between items-center gap-2 py-1" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={digit}
                disabled={loading}
                ref={(el) => { inputRefs.current[idx] = el }}
                onChange={(e) => handleOtpChange(e.target.value, idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="w-11 h-12 text-center text-lg font-bold bg-white border border-[#CBD5DB] rounded-lg text-[#05303B] focus:border-[#12A89A] focus:ring-3 focus:ring-[#12A89A]/20 transition-all outline-none"
                autoFocus={idx === 0}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length < 6}
            className="auth-button-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying code...</span>
              </>
            ) : (
              <>
                <span>Verify code</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Resend Action & Back */}
          <div className="flex items-center justify-between text-xs pt-1 select-none">
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setErrorBanner(null)
              }}
              className="text-[#5B6B75] hover:text-[#05303B] font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change email</span>
            </button>

            {countdown > 0 ? (
              <span className="text-[#5B6B75]">
                Resend in <strong className="text-[#05303B] font-mono">{countdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="auth-link font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>Resend code</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* STEP 3: Create New Password Form */}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-3.5" noValidate>
          {/* New Password */}
          <div>
            <label htmlFor="new-pass" className="auth-label">
              New password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="new-pass"
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                disabled={loading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input pl-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5B6B75] hover:text-[#05303B] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-new-pass" className="auth-label">
              Confirm new password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="confirm-new-pass"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input pl-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5B6B75] hover:text-[#05303B] cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
            className="auth-button-primary mt-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating password...</span>
              </>
            ) : (
              <>
                <span>Set new password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 4: Success Screen — Clean confirmation block */}
      {step === 'success' && (
        <div className="py-2 text-center select-none space-y-5">
          <div className="w-12 h-12 rounded-full bg-[#12A89A]/10 text-[#0B7A70] flex items-center justify-center mx-auto border border-[#12A89A]/20">
            <Check className="w-6 h-6 stroke-[2.5]" />
          </div>

          <div className="space-y-1">
            <h2 className="text-[16px] font-semibold text-[#05303B]">
              Password updated
            </h2>
            <p className="text-[13px] text-[#5B6B75] max-w-xs mx-auto leading-relaxed">
              Your password has been changed. You can now access your workspace with your new credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="auth-button-primary"
          >
            <span>Back to sign in</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer Back to Login */}
      {step !== 'success' && (
        <div className="border-t border-[#E8EDF0] pt-4 mt-5 text-center text-[13px] text-[#5B6B75] select-none">
          Remember your password?{' '}
          <Link to="/login" className="auth-link font-medium">
            Back to sign in
          </Link>
        </div>
      )}
    </motion.div>
  )
}

export default ForgotPasswordPage
