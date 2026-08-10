import React, { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { getDefaultRouteForUser } from '../routes/AppRoutes'
import BRAND from '../config/brand'
import AuthWatermark from '../components/ui/AuthWatermark'
import { 
  Lock, Eye, EyeOff, Mail, AlertCircle, 
  Loader2, KeyRound, ArrowRight, X 
} from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'Email or Username is required'),
  password: z.string().min(1, 'Password is required').min(4, 'Password must be at least 4 characters'),
})

type LoginFormInputs = z.infer<typeof loginSchema>

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { showToast } = useNotificationStore()

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [shakeError, setShakeError] = useState(false)

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [resetCode, setResetCode] = useState<string[]>(Array(6).fill(''))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const handleCapsLock = (e: React.KeyboardEvent) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockActive(true)
    } else {
      setCapsLockActive(false)
    }
  }

  // Handle Login Submit
  const onLoginSubmit = async (data: LoginFormInputs) => {
    if (loading) return
    setLoading(true)
    setErrorMessage(null)
    setShakeError(false)

    try {
      const response = await authService.login(data)
      const result = response.data
      
      if (response.success && result) {
        const { 
          accessToken, refreshToken, userId, email, firstName, 
          lastName, tenantId, roles, permissions, assignedProductionLineId, companyName 
        } = result
        
        localStorage.setItem('tenantCode', 'DEFAULT')
        
        setAuth(accessToken, refreshToken, {
          userId,
          email,
          firstName,
          lastName,
          tenantId,
          roles,
          permissions,
          isTenantInitialized: response.data.isTenantInitialized,
          tenantStatus: response.data.tenantStatus,
          emailVerified: response.data.emailVerified,
          assignedProductionLineId,
          companyName,
          tenantName: companyName
        })

        showToast(`Welcome back, ${firstName || 'User'}!`, 'success')
        
        const targetRoute = getDefaultRouteForUser({
          roles,
          tenantId,
          isTenantInitialized: response.data.isTenantInitialized,
          emailVerified: response.data.emailVerified
        })
        navigate(targetRoute)
      } else {
        triggerError(response.message || 'Invalid credentials. Please verify your email and password.')
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Authentication failed. Please check your credentials.'
      triggerError(msg)
    } finally {
      setLoading(false)
    }
  }

  const triggerError = (msg: string) => {
    setErrorMessage(msg)
    setShakeError(true)
    setTimeout(() => setShakeError(false), 500)
  }

  // Forgot password handlers
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) {
      showToast('Please enter your corporate email address.', 'error')
      return
    }
    setForgotLoading(true)
    try {
      const response = await authService.sendOtp(forgotEmail, 'PasswordReset')
      if (response.success) {
        showToast('Password recovery PIN sent to your email.', 'success')
        setForgotStep('verify')
        setResetCode(Array(6).fill(''))
      } else {
        showToast(response.message || 'Failed to send recovery code.', 'error')
      }
    } catch (error: any) {
      if (error.response?.status === 429 || error.response?.data?.code === 'OTP_RATE_LIMITED') {
        const retryAfter = error.response?.data?.retryAfterSeconds || error.response?.headers?.['retry-after']
        const msg = retryAfter 
          ? `Please wait ${retryAfter} seconds before requesting another code.` 
          : (error.response?.data?.message || 'Please wait before requesting another code.')
        showToast(msg, 'error')
      } else {
        showToast(error.response?.data?.message || 'Failed to send recovery code.', 'error')
      }
    } finally {
      setForgotLoading(false)
    }
  }

  const handleCodeChange = (val: string, index: number) => {
    const clean = val.replace(/[^0-9]/g, '')
    if (!clean) {
      const newCode = [...resetCode]
      newCode[index] = ''
      setResetCode(newCode)
      return
    }

    const newCode = [...resetCode]
    newCode[index] = clean.substring(clean.length - 1)
    setResetCode(newCode)

    if (index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      const newCode = [...resetCode]
      newCode[index - 1] = ''
      setResetCode(newCode)
      codeRefs.current[index - 1]?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pasted)) {
      setResetCode(pasted.split(''))
      codeRefs.current[5]?.focus()
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const codeStr = resetCode.join('')
    if (codeStr.length < 6) {
      showToast('Please enter the complete 6-digit confirmation pin.', 'error')
      return
    }
    if (!newPassword || newPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error')
      return
    }

    setForgotLoading(true)
    try {
      const verifyRes = await authService.verifyOtp({
        email: forgotEmail,
        code: codeStr,
        purpose: 'PasswordReset'
      })

      if (verifyRes.success) {
        const resetRes = await authService.resetPassword(forgotEmail, newPassword)
        if (resetRes.success) {
          showToast('Password updated successfully. Please sign in.', 'success')
          setIsForgotModalOpen(false)
          setForgotStep('request')
          setForgotEmail('')
          setNewPassword('')
          setConfirmPassword('')
        } else {
          showToast(resetRes.message || 'Password update failed.', 'error')
        }
      } else {
        showToast(verifyRes.message || 'Invalid verification PIN.', 'error')
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Reset failed.', 'error')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="w-full flex justify-center items-center font-sans">

      {/* FRESH WHITE AUTHENTICATION SURFACE (440px width, 16px rounded, soft border) */}
      <motion.div 
        animate={shakeError ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xs p-8 sm:p-9 space-y-5 relative z-10"
      >
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2 select-none">
          <img src={BRAND.logo} alt={BRAND.name} className="h-14 w-auto object-contain mb-1" />
          <div>
            <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
              Welcome Back
            </h2>
            <p className="text-xs font-medium text-[#6B7280] mt-0.5">
              Sign in to continue to {BRAND.name} Platform
            </p>
          </div>
        </div>

        {/* Caps Lock Alert */}
        <AnimatePresence>
          {capsLockActive && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs font-semibold select-none"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Caps Lock is ON</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline Error Alert */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs leading-relaxed select-none"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5">Authentication Failed</span>
                <span>{errorMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Controls */}
        <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">

          {/* Email / Username Field (54px Height) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">
              Email or Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Mail className="w-4.5 h-4.5" />
              </div>
              <input
                id="email"
                type="text"
                autoComplete="username"
                disabled={loading}
                placeholder="name@company.com"
                {...register('email')}
                className={`w-full pl-10 pr-3.5 h-[54px] bg-white border ${
                  errors.email ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
                autoFocus
              />
            </div>
            {errors.email?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field (54px Height) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={loading}
                onKeyDown={handleCapsLock}
                placeholder="••••••••"
                {...register('password')}
                className={`w-full pl-10 pr-10 h-[54px] bg-white border ${
                  errors.password ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#111827] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs select-none">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={loading}
                className="w-4 h-4 rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]/20"
              />
              <span className="text-[#6B7280] font-medium">Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setIsForgotModalOpen(true)
                setForgotStep('request')
              }}
              className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {/* Primary Action Button (Solid Blue #2563EB, 54px Height) */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading}
            className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>

        </form>

        {/* Register Account Link */}
        <div className="pt-2 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280] select-none">
          Don't have an enterprise account?{' '}
          <Link to="/register" className="font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
            Register here
          </Link>
        </div>

      </motion.div>

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsForgotModalOpen(false)} 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              
              {/* Header */}
              <div className="px-6 py-4 bg-[#FAFBFC] border-b border-[#E5E7EB] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-5 h-5 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#111827]">
                    {forgotStep === 'request' ? 'Reset Password' : 'Verify Recovery PIN'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsForgotModalOpen(false)} 
                  className="p-1 rounded-xl text-[#9CA3AF] hover:text-[#111827] transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 text-xs">

                {forgotStep === 'request' ? (
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <p className="text-[#6B7280] leading-relaxed">
                      Enter your corporate email address. We will send you a 6-digit confirmation PIN to reset your password.
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-[#111827] font-semibold">Corporate Email</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full px-3.5 h-[54px] bg-white border border-[#E5E7EB] rounded-xl text-[#111827] text-xs focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Recovery Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetSubmit} className="space-y-4">
                    <p className="text-[#6B7280] leading-relaxed">
                      Enter the 6-digit PIN sent to <strong className="text-[#111827]">{forgotEmail}</strong> and set your new password.
                    </p>

                    {/* OTP Digits */}
                    <div className="flex justify-between items-center gap-2" onPaste={handleCodePaste}>
                      {resetCode.map((digit, idx) => (
                        <input
                          key={idx}
                          type="text"
                          maxLength={1}
                          value={digit}
                          ref={(el) => { codeRefs.current[idx] = el }}
                          onChange={(e) => handleCodeChange(e.target.value, idx)}
                          onKeyDown={(e) => handleCodeKeyDown(e, idx)}
                          className="w-10 h-11 text-center font-bold text-base bg-white border border-[#E5E7EB] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]"
                        />
                      ))}
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label className="block text-[#111827] font-semibold">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 h-[54px] bg-white border border-[#E5E7EB] rounded-xl text-[#111827] text-xs focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9CA3AF]"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="block text-[#111827] font-semibold">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 h-[54px] bg-white border border-[#E5E7EB] rounded-xl text-[#111827] text-xs focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading || resetCode.join('').length < 6 || !newPassword}
                      className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set New Password'}
                    </button>
                  </form>
                )}

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default LoginPage
