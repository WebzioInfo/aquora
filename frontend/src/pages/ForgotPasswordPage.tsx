import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import BRAND from '../config/brand'
import {
  KeyRound, Mail, Lock, Eye, EyeOff, ArrowRight,
  ArrowLeft, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-200' }
    let score = 0
    if (pass.length >= 8) score++
    if (pass.length >= 12) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[a-z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500' }
    if (score <= 4) return { score: 3, label: 'Moderate', color: 'bg-amber-500' }
    return { score: 5, label: 'Strong', color: 'bg-emerald-500' }
  }

  const passwordStrength = getPasswordStrength(newPassword)

  // Step 1: Submit Email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !email.trim()) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const res = await authService.forgotPassword(email.trim())
      if (res.success) {
        showToast('Password recovery code dispatched to your email.', 'success')
        setStep('otp')
        setCountdown(60)
        setOtp(Array(6).fill(''))
      } else {
        setErrorMessage(res.message || 'Failed to dispatch recovery code.')
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setCountdown(60)
        setErrorMessage('Rate limit reached. Please wait a moment before requesting another code.')
      } else {
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to dispatch recovery code.')
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
    setErrorMessage(null)

    try {
      const res = await authService.verifyPasswordResetOtp(email.trim(), code)
      if (res.success && res.data?.resetToken) {
        setResetToken(res.data.resetToken)
        setStep('password')
        showToast('Verification code confirmed. Please choose a new password.', 'success')
      } else {
        setErrorMessage(res.message || 'Invalid verification code.')
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Invalid or expired verification code.')
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (resending || countdown > 0) return
    setResending(true)
    setErrorMessage(null)

    try {
      const res = await authService.resendPasswordResetOtp(email.trim())
      if (res.success) {
        showToast('A fresh recovery code has been sent to your email.', 'success')
        setCountdown(60)
        setOtp(Array(6).fill(''))
      } else {
        setErrorMessage(res.message || 'Failed to resend recovery code.')
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to resend recovery code.')
    } finally {
      setResending(false)
    }
  }

  // Step 3: Submit New Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

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
        setErrorMessage(res.message || 'Failed to reset password.')
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Password reset failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex justify-center items-center font-sans py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[440px] rounded-2xl p-8 sm:p-9 space-y-5 relative z-10 shadow-sm border"
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(229, 231, 235, 0.9)'
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 select-none mb-2">
          <img src={BRAND.logo} alt={BRAND.name} className="h-12 w-auto object-contain mb-1" />
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#2563EB]">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Account Recovery</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
            {step === 'email' && 'Reset Your Password'}
            {step === 'otp' && 'Enter Verification Code'}
            {step === 'password' && 'Create New Password'}
            {step === 'success' && 'Password Reset Complete'}
          </h2>
          <p className="text-xs font-medium text-[#6B7280]">
            {step === 'email' && 'Enter your registered email address to receive a recovery code.'}
            {step === 'otp' && `Enter the 6-digit PIN sent to ${email}`}
            {step === 'password' && 'Choose a strong, unique password for your account.'}
            {step === 'success' && 'Your password has been updated. You can now log in securely.'}
          </p>
        </div>

        {/* Inline Error Alert */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs select-none"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: Email Form */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111827]">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 h-[54px] bg-white border border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB] rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>
        )}

        {/* STEP 2: OTP Verification Form */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Sent to:</span>
              <span className="font-bold text-slate-800 font-mono">{email}</span>
            </div>

            <div className="flex justify-between items-center gap-2" onPaste={handlePaste}>
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
                  className="w-11 h-13 text-center text-xl font-bold bg-white border border-[#E5E7EB] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB] transition-all outline-none"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

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
                  <span>Verify Recovery Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>

            {/* Resend Action */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Email</span>
              </button>

              {countdown > 0 ? (
                <span className="text-slate-500">
                  Resend in <strong className="text-slate-800 font-mono">{countdown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[#2563EB] hover:text-[#1D4ED8] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>Resend Code</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: Create New Password Form */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111827]">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  disabled={loading}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 h-[54px] bg-white border border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB] rounded-xl text-xs font-medium text-[#111827] focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#111827]"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-500">Strength:</span>
                    <span className={`${
                      passwordStrength.label === 'Strong' ? 'text-emerald-600' :
                      passwordStrength.label === 'Moderate' ? 'text-amber-600' : 'text-rose-500'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          lvl <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#111827]">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 h-[54px] bg-white border border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB] rounded-xl text-xs font-medium text-[#111827] focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#111827]"
                >
                  {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading || !newPassword || newPassword !== confirmPassword}
              className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4.5 h-4.5" />
                  <span>Set New Password</span>
                </>
              )}
            </motion.button>
          </form>
        )}

        {/* STEP 4: Success Screen */}
        {step === 'success' && (
          <div className="space-y-6 py-2 text-center select-none">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Your Password Has Been Reset</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                You can now log in to your account with your newly configured password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer Back to Login */}
        {step !== 'success' && (
          <div className="pt-2 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280] select-none">
            Remembered your password?{' '}
            <Link to="/login" className="font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              Back to Sign In
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default ForgotPasswordPage
