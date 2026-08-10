import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { authService } from '../services/auth'
import { useNotificationStore } from '../store/useNotificationStore'
import BRAND from '../config/brand'
import AuthWatermark from '../components/ui/AuthWatermark'
import { 
  User, Mail, Lock, Eye, EyeOff, 
  CheckCircle2, XCircle, ArrowRight, Loader2 
} from 'lucide-react'

const registerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid corporate email'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[a-z]/, 'Must include at least one lowercase letter')
    .regex(/[0-9]/, 'Must include at least one number'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
  agree: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the Terms & Privacy Policy',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterFormInputs = z.infer<typeof registerSchema>

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      agree: false,
    },
  })

  const passwordVal = watch('password', '')

  const rules = {
    length: passwordVal.length >= 8,
    upper: /[A-Z]/.test(passwordVal),
    lower: /[a-z]/.test(passwordVal),
    number: /[0-9]/.test(passwordVal),
  }

  const handleCapsLock = (e: React.KeyboardEvent) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockActive(true)
    } else {
      setCapsLockActive(false)
    }
  }

  const onSubmit = async (data: RegisterFormInputs) => {
    if (loading) return
    setLoading(true)
    const trimmedEmail = data.email.trim()
    const trimmedFullName = data.fullName.trim()
    try {
      const response = await authService.register({
        fullName: trimmedFullName,
        email: trimmedEmail,
        password: data.password,
        confirmPassword: data.confirmPassword,
      })

      if (response.success) {
        showToast('Registration completed. Enter the verification code sent to your email.', 'success')
        navigate('/verify-otp', { state: { email: trimmedEmail, fromRegistration: true } })
      } else {
        showToast(response.message || 'Registration failed.', 'error')
      }
    } catch (error: any) {
      if (error.response?.status === 429 || error.response?.data?.code === 'OTP_RATE_LIMITED') {
        const retryAfter = error.response?.data?.retryAfterSeconds || error.response?.headers?.['retry-after']
        const msg = retryAfter 
          ? `Please wait ${retryAfter} seconds before requesting another code.` 
          : (error.response?.data?.message || 'Please wait before requesting another code.')
        showToast(msg, 'error')
      } else {
        const errMsg = error.response?.data?.message || error.message || 'Registration failed.'
        showToast(errMsg, 'error')
      }
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
        className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xs p-8 sm:p-9 space-y-4 relative z-10"
      >
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 select-none">
          <img src={BRAND.logo} alt={BRAND.name} className="h-12 w-auto object-contain mb-1" />
          <div>
            <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
              Create Account
            </h2>
            <p className="text-xs font-medium text-[#6B7280] mt-0.5">
              Register your {BRAND.name} workspace
            </p>
          </div>
        </div>

        {/* Caps Lock Alert */}
        {capsLockActive && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-semibold select-none">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Caps Lock is ON</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

          {/* Full Name */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <User className="w-4.5 h-4.5" />
              </div>
              <input
                type="text"
                disabled={loading}
                placeholder="Jane Smith"
                {...register('fullName')}
                className={`w-full pl-10 pr-3.5 h-12 bg-white border ${
                  errors.fullName ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
                autoFocus
              />
            </div>
            {errors.fullName?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.fullName.message}</p>
            )}
          </div>

          {/* Corporate Email */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">Corporate Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Mail className="w-4.5 h-4.5" />
              </div>
              <input
                type="email"
                disabled={loading}
                placeholder="jane@company.com"
                {...register('email')}
                className={`w-full pl-10 pr-3.5 h-12 bg-white border ${
                  errors.email ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
              />
            </div>
            {errors.email?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                disabled={loading}
                onKeyDown={handleCapsLock}
                placeholder="••••••••"
                {...register('password')}
                className={`w-full pl-10 pr-10 h-12 bg-white border ${
                  errors.password ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass(!showPass)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#111827] transition-colors"
              >
                {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.password.message}</p>
            )}
          </div>

          {/* Password Rules */}
          {passwordVal && (
            <div className="p-2.5 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] space-y-1 select-none text-[10px]">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className="flex items-center gap-1.5">
                  {rules.length ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.length ? 'text-[#111827] font-semibold' : 'text-[#6B7280]'}>8+ Characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {rules.upper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.upper ? 'text-[#111827] font-semibold' : 'text-[#6B7280]'}>Uppercase Letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {rules.lower ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.lower ? 'text-[#111827] font-semibold' : 'text-[#6B7280]'}>Lowercase Letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {rules.number ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={rules.number ? 'text-[#111827] font-semibold' : 'text-[#6B7280]'}>Contains Number</span>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Lock className="w-4.5 h-4.5" />
              </div>
              <input
                type={showConfirmPass ? 'text' : 'password'}
                disabled={loading}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`w-full pl-10 pr-10 h-12 bg-white border ${
                  errors.confirmPassword ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#111827] transition-colors"
              >
                {showConfirmPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {errors.confirmPassword?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Terms Certification */}
          <div className="space-y-1 pt-0.5 select-none">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={loading}
                {...register('agree')}
                className="w-4 h-4 mt-0.5 rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]/20"
              />
              <span className="text-xs text-[#6B7280] leading-snug">
                I agree to the Terms of Service & Privacy Policy.
              </span>
            </label>
            {errors.agree?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.agree.message}</p>
            )}
          </div>

          {/* Submit Button */}
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Register Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>

        </form>

        {/* Existing account link */}
        <div className="pt-2 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
            Sign in
          </Link>
        </div>

      </motion.div>

    </div>
  )
}

export default RegisterPage
