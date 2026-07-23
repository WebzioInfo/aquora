import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { getDefaultRouteForUser } from '../routes/AppRoutes'
import { Droplet, Lock, Eye, EyeOff, Mail, CheckCircle, XCircle } from 'lucide-react'
import EnterpriseInput from '../components/ui/EnterpriseInput'
import EnterpriseButton from '../components/ui/EnterpriseButton'

const loginSchema = z.object({
  email: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password or PIN is required').min(4, 'Password or PIN must be at least 4 characters'),
})

type LoginFormInputs = z.infer<typeof loginSchema>

type AuthMode = 'signin' | 'forgot' | 'reset'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)

  // Forgot password & reset password inputs
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetCode, setResetCode] = useState<string[]>(Array(6).fill(''))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Watch/Check new password strength rules
  const rules = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  }

  const getStrengthScore = () => {
    let score = 0
    if (rules.length) score++
    if (rules.upper) score++
    if (rules.lower) score++
    if (rules.number) score++
    return score
  }

  const strengthScore = getStrengthScore()

  const handleCapsLock = (e: React.KeyboardEvent) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockActive(true)
    } else {
      setCapsLockActive(false)
    }
  }

  // Handle standard login
  const onLoginSubmit = async (data: LoginFormInputs) => {
    if (loading) return
    setLoading(true)
    try {
      const response = await authService.login(data)
      const result = response.data
      
      if (response.success && result) {
        const { accessToken, refreshToken, userId, email, firstName, lastName, tenantId, roles, permissions, assignedProductionLineId, companyName } = result
        
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

        showToast(`Welcome back, ${firstName}!`, 'success')
        
        const targetRoute = getDefaultRouteForUser({
          roles,
          tenantId,
          isTenantInitialized: response.data.isTenantInitialized,
          emailVerified: response.data.emailVerified
        })
        navigate(targetRoute)
      } else {
        showToast(response.message || 'Login failed.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Authentication failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle forgot password OTP request
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) {
      showToast('Please enter your email address.', 'error')
      return
    }
    setLoading(true)
    try {
      const response = await authService.sendOtp(forgotEmail, 'PasswordReset')
      if (response.success) {
        showToast('Password recovery pin dispatched to your email.', 'success')
        setAuthMode('reset')
        setResetCode(Array(6).fill(''))
      } else {
        showToast(response.message || 'Failed to dispatch recovery pin.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Verification code dispatch failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Handle OTP digit navigation
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
    if (e.key === 'Backspace') {
      if (!resetCode[index] && index > 0) {
        const newCode = [...resetCode]
        newCode[index - 1] = ''
        setResetCode(newCode)
        codeRefs.current[index - 1]?.focus()
      } else {
        const newCode = [...resetCode]
        newCode[index] = ''
        setResetCode(newCode)
      }
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

  // Handle password reset verification & submission
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const codeStr = resetCode.join('')
    if (codeStr.length < 6) {
      showToast('Please enter the full 6-digit confirmation pin.', 'error')
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

    setLoading(true)
    try {
      // 1. Verify verification code
      const verifyRes = await authService.verifyOtp({
        email: forgotEmail,
        code: codeStr,
        purpose: 'PasswordReset'
      })

      if (verifyRes.success) {
        // 2. Perform password update
        const resetRes = await authService.resetPassword(forgotEmail, newPassword)
        if (resetRes.success) {
          showToast('Credentials updated successfully. Please sign in.', 'success')
          setAuthMode('signin')
          reset()
          setNewPassword('')
          setConfirmPassword('')
          setForgotEmail('')
        } else {
          showToast(resetRes.message || 'Credentials update failed.', 'error')
        }
      } else {
        showToast(verifyRes.message || 'Invalid verification code.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Verification or update failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in text-left">
      {/* Title */}
      <div className="flex flex-col items-center text-center select-none">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-md mb-4">
          <Droplet className="w-6 h-6 text-white fill-white animate-pulse" />
        </div>
        <h1 className="text-xl font-bold text-[#111827] tracking-tight">
          {authMode === 'signin' && 'Sign In to Portal'}
          {authMode === 'forgot' && 'Reset Security Credentials'}
          {authMode === 'reset' && 'Create New Password'}
        </h1>
        <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest font-bold">
          {authMode === 'signin' && 'Authorized Operator Access'}
          {authMode === 'forgot' && 'Initiate Account Recovery'}
          {authMode === 'reset' && 'Establish Secure Password'}
        </p>
      </div>

      {/* Caps Lock warning */}
      {capsLockActive && authMode === 'signin' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-850 flex items-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>CAPS LOCK IS ACTIVE</span>
        </div>
      )}

      {/* MODE 1: Standard Sign In */}
      {authMode === 'signin' && (
        <form onSubmit={handleSubmit(onLoginSubmit)} className="flex flex-col gap-4">
          {/* Email / Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 select-none">Email or Username *</label>
            <EnterpriseInput 
              id="email"
              placeholder="operator@company.com"
              disabled={loading}
              error={errors.email?.message}
              {...register('email')}
              className="bg-white border-[#D0D5DD] text-[#111827] placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 transition-all w-full"
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="relative w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 select-none">Password or PIN *</label>
            <div className="relative">
              <input 
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                disabled={loading}
                onKeyDown={handleCapsLock}
                {...register('password')}
                className="bg-white border border-[#D0D5DD] text-[#111827] placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 pr-10 transition-all w-full outline-none"
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer select-none"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password?.message && (
              <span className="text-[11px] font-semibold text-red-650 mt-1">{errors.password.message}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center select-none text-[11px] font-semibold">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                className="w-3.5 h-3.5 border-[#D0D5DD] text-blue-600 focus:ring-blue-500 rounded transition-all cursor-pointer bg-white"
                type="checkbox"
                disabled={loading}
              />
              <span className="text-slate-500 group-hover:text-slate-800 transition-colors">
                Remember operator session
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                setAuthMode('forgot')
              }}
              className="text-blue-600 hover:text-blue-700 transition-colors cursor-pointer hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit */}
          <EnterpriseButton
            type="submit"
            loading={loading}
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-none shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all font-bold text-white text-sm"
          >
            Authorize Access
          </EnterpriseButton>
        </form>
      )}

      {/* MODE 2: Forgot Password */}
      {authMode === 'forgot' && (
        <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4 animate-fade-in">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 select-none">Account Corporate Email *</label>
            <div className="relative">
              <input 
                type="email"
                required
                placeholder="operator@company.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={loading}
                className="bg-white border border-[#D0D5DD] text-[#111827] placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 pl-10 transition-all w-full outline-none"
                autoFocus
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed mt-1 select-none">
              A 6-digit identity confirmation pin will be dispatched to this corporate address.
            </p>
          </div>

          <EnterpriseButton
            type="submit"
            loading={loading}
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-none shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all font-bold text-white text-sm"
          >
            Dispatch Recovery Code
          </EnterpriseButton>

          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center cursor-pointer select-none"
          >
            Return to Login
          </button>
        </form>
      )}

      {/* MODE 3: Reset Password (Enter Code & Password) */}
      {authMode === 'reset' && (
        <form onSubmit={handleResetSubmit} className="flex flex-col gap-4 animate-fade-in">
          {/* OTP inputs */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-700 select-none text-left">
              Verification Code sent to <strong className="text-slate-800">{forgotEmail}</strong> *
            </label>
            <div className="flex justify-between items-center gap-2" onPaste={handleCodePaste}>
              {resetCode.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={digit}
                  disabled={loading}
                  ref={(el) => { codeRefs.current[idx] = el; }}
                  onChange={(e) => handleCodeChange(e.target.value, idx)}
                  onKeyDown={(e) => handleCodeKeyDown(e, idx)}
                  className="w-12 h-12 text-center text-lg font-bold bg-white border border-[#D0D5DD] rounded-lg text-[#111827] placeholder:text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                  placeholder="0"
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>

          {/* New Password */}
          <div className="relative w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 select-none">New Security Password *</label>
            <div className="relative">
              <input 
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="bg-white border border-[#D0D5DD] text-[#111827] placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 pr-10 transition-all w-full outline-none"
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer select-none"
                onClick={() => setShowNewPassword(!showNewPassword)}
                type="button"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Strength meter */}
          {newPassword && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] select-none">
              <div className="flex justify-between items-center text-[10px] font-bold tracking-wider">
                <span className="text-slate-500 uppercase">Strength Score</span>
                <span className={
                  strengthScore <= 1 ? 'text-red-500' :
                  strengthScore === 2 ? 'text-amber-500' :
                  strengthScore === 3 ? 'text-blue-500' : 'text-emerald-500'
                }>
                  {strengthScore <= 1 ? 'WEAK' :
                   strengthScore === 2 ? 'FAIR' :
                   strengthScore === 3 ? 'GOOD' : 'STRONG'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className={`h-1 rounded-full transition-all duration-350 ${
                      i <= strengthScore 
                        ? strengthScore <= 1 ? 'bg-red-500' 
                        : strengthScore === 2 ? 'bg-amber-500' 
                        : strengthScore === 3 ? 'bg-blue-500' : 'bg-emerald-500'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              {/* Checklist */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  {rules.length ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.length ? 'text-slate-800' : 'text-slate-500'}>8+ Characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {rules.upper ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.upper ? 'text-slate-800' : 'text-slate-500'}>Uppercase Letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {rules.lower ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.lower ? 'text-slate-800' : 'text-slate-500'}>Lowercase Letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {rules.number ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.number ? 'text-slate-800' : 'text-slate-500'}>Contains Number</span>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="relative w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 select-none">Confirm New Password *</label>
            <input 
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="bg-white border border-[#D0D5DD] text-[#111827] placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 transition-all w-full outline-none"
            />
          </div>

          <EnterpriseButton
            type="submit"
            loading={loading}
            disabled={!newPassword || newPassword !== confirmPassword || resetCode.join('').length < 6}
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-none shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all font-bold text-white text-sm"
          >
            Update Credentials
          </EnterpriseButton>

          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center cursor-pointer select-none"
          >
            Cancel and Return
          </button>
        </form>
      )}

      {/* Info Footer */}
      <div className="pt-5 border-t border-[#E5E7EB] text-center flex flex-col items-center gap-3 select-none">
        <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
          Proprietary Industrial Resource Planning Environment.
        </p>
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-red-600 uppercase tracking-widest bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
          <Lock className="w-2.5 h-2.5" />
          <span>Secure Access Only</span>
        </div>
      </div>

      {/* Demo Credentials Box */}
      {authMode === 'signin' && (
        <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-[11px] text-slate-500 leading-relaxed select-none">
          <span className="font-bold text-slate-800 block mb-1">Clearance Demo Account:</span>
          <span className="block font-medium">Email: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">admin@aquora.com</code></span>
          <span className="block font-medium">Password: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">Admin@12345</code></span>
        </div>
      )}
    </div>
  )
}
export default LoginPage
