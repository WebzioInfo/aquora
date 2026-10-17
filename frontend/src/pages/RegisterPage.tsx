import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { authService } from '../services/auth'
import { useNotificationStore } from '../store/useNotificationStore'
import { getFriendlyError } from '../utils/getFriendlyError'
import { 
  User, Mail, Lock, Eye, EyeOff, 
  Check, X, ArrowRight, Loader2, AlertCircle 
} from 'lucide-react'

const registerSchema = z.object({
  fullName: z.string().min(1, 'Please enter your full name').max(100, 'Name is too long'),
  email: z.string().min(1, 'Enter a valid work email').email('Enter a valid work email'),
  password: z
    .string()
    .min(1, 'Password must be at least 8 characters')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[a-z]/, 'Must include at least one lowercase letter')
    .regex(/[0-9]/, 'Must include at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  agree: z.boolean().refine((val) => val === true, {
    message: 'Please accept the Terms to continue',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
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
  const [serverEmailError, setServerEmailError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Create account · Aquzio'
  }, [])

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
  const confirmPasswordVal = watch('confirmPassword', '')
  const emailVal = watch('email', '')

  // Clear server email error if user edits the email field
  useEffect(() => {
    if (serverEmailError) setServerEmailError(null)
  }, [emailVal])

  const rules = {
    length: passwordVal.length >= 8,
    upper: /[A-Z]/.test(passwordVal),
    lower: /[a-z]/.test(passwordVal),
    number: /[0-9]/.test(passwordVal),
  }

  const passwordsMatch = confirmPasswordVal.length > 0 && passwordVal === confirmPasswordVal

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
    setServerEmailError(null)
    setGeneralError(null)

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
        const friendly = getFriendlyError(response, 'register')
        if (friendly.fieldErrors?.email) {
          setServerEmailError(friendly.fieldErrors.email)
        } else {
          setGeneralError(friendly.message)
        }
      }
    } catch (error: any) {
      const friendly = getFriendlyError(error, 'register')
      if (friendly.fieldErrors?.email) {
        setServerEmailError(friendly.fieldErrors.email)
      } else {
        setGeneralError(friendly.message)
      }
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
      <div className="flex flex-col items-center text-center select-none mb-5">
        <img
          src="/brand/aquzio-icon-light.png"
          alt="Aquzio"
          className="w-11 h-11 object-contain mb-3"
        />
        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          Create your account
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1 leading-normal">
          Set up your Aquzio workspace.
        </p>
      </div>

      {/* General Form Error Alert */}
      <AnimatePresence>
        {generalError && (
          <motion.div 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="auth-error-banner mb-4"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-[13px]">{generalError}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caps Lock Alert */}
      <AnimatePresence>
        {capsLockActive && (
          <motion.div 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="p-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-xs font-medium select-none"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Caps Lock is ON</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Controls — Native validation disabled (noValidate) */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>

        {/* Full Name */}
        <div>
          <label htmlFor="reg-name" className="auth-label">
            Full name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
              <User className="w-4 h-4" />
            </div>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              disabled={loading}
              placeholder="Jane Smith"
              aria-invalid={errors.fullName ? 'true' : 'false'}
              aria-describedby={errors.fullName ? 'reg-name-error' : undefined}
              {...register('fullName')}
              className={`auth-input pl-10 pr-3.5 ${errors.fullName ? 'auth-input-error' : ''}`}
              autoFocus
            />
          </div>
          {errors.fullName?.message && (
            <div id="reg-name-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.fullName.message}</span>
            </div>
          )}
        </div>

        {/* Corporate Email */}
        <div>
          <label htmlFor="reg-email" className="auth-label">
            Corporate email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              disabled={loading}
              placeholder="jane@company.com"
              aria-invalid={errors.email || serverEmailError ? 'true' : 'false'}
              aria-describedby={errors.email || serverEmailError ? 'reg-email-error' : undefined}
              {...register('email')}
              className={`auth-input pl-10 pr-3.5 ${errors.email || serverEmailError ? 'auth-input-error' : ''}`}
            />
          </div>
          {/* Server duplicate email message with inline sign in link */}
          {serverEmailError ? (
            <div id="reg-email-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                An account with this email already exists.{' '}
                <Link to="/login" className="underline font-semibold hover:text-red-700">
                  Sign in instead
                </Link>
              </span>
            </div>
          ) : errors.email?.message ? (
            <div id="reg-email-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email.message}</span>
            </div>
          ) : null}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" className="auth-label">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="reg-password"
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={loading}
              onKeyDown={handleCapsLock}
              onKeyUp={handleCapsLock}
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'reg-pass-error' : undefined}
              {...register('password')}
              className={`auth-input pl-10 pr-10 ${errors.password ? 'auth-input-error' : ''}`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5B6B75] hover:text-[#05303B] transition-colors cursor-pointer"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password?.message && (
            <div id="reg-pass-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.password.message}</span>
            </div>
          )}

          {/* Compact Password Requirements Indicator */}
          {passwordVal.length > 0 && (
            <div className="mt-2 p-2 bg-[#F8FAFC] border border-[#E3E8EC] rounded-md grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] select-none">
              <div className="flex items-center gap-1.5">
                {rules.length ? (
                  <Check className="w-3.5 h-3.5 text-[#12A89A] shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={rules.length ? 'text-[#05303B] font-medium' : 'text-[#5B6B75]'}>
                  8+ characters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.number ? (
                  <Check className="w-3.5 h-3.5 text-[#12A89A] shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={rules.number ? 'text-[#05303B] font-medium' : 'text-[#5B6B75]'}>
                  One number
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.upper ? (
                  <Check className="w-3.5 h-3.5 text-[#12A89A] shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={rules.upper ? 'text-[#05303B] font-medium' : 'text-[#5B6B75]'}>
                  Uppercase letter
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.lower ? (
                  <Check className="w-3.5 h-3.5 text-[#12A89A] shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={rules.lower ? 'text-[#05303B] font-medium' : 'text-[#5B6B75]'}>
                  Lowercase letter
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="reg-confirm-password" className="auth-label">
            Confirm password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="reg-confirm-password"
              type={showConfirmPass ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={loading}
              placeholder="••••••••"
              aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              aria-describedby={errors.confirmPassword ? 'reg-confirm-error' : undefined}
              {...register('confirmPassword')}
              className={`auth-input pl-10 pr-10 ${errors.confirmPassword ? 'auth-input-error' : ''}`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirmPass(!showConfirmPass)}
              aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5B6B75] hover:text-[#05303B] transition-colors cursor-pointer"
            >
              {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Live passwords match indicator */}
          {confirmPasswordVal.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] mt-1 select-none">
              {passwordsMatch ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#12A89A] shrink-0" />
                  <span className="text-[#0B7A70] font-medium">Passwords match</span>
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="text-red-600 font-medium">Passwords don't match</span>
                </>
              )}
            </div>
          )}

          {errors.confirmPassword?.message && !confirmPasswordVal && (
            <div id="reg-confirm-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.confirmPassword.message}</span>
            </div>
          )}
        </div>

        {/* Terms and Privacy Checkbox */}
        <div className="pt-1 select-none">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="reg-agree"
              disabled={loading}
              {...register('agree')}
              className="auth-checkbox mt-0.5"
            />
            <span className="text-[12px] text-[#5B6B75] leading-snug">
              I agree to the{' '}
              <a href="#" className="auth-link">Terms of Service</a>{' '}
              and{' '}
              <a href="#" className="auth-link">Privacy Policy</a>.
            </span>
          </label>
          {errors.agree?.message && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.agree.message}</span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="auth-button-primary mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

      </form>

      {/* Bottom Switch Link */}
      <div className="border-t border-[#E8EDF0] pt-3.5 mt-4 text-center text-[13px] text-[#5B6B75] select-none">
        Already have an account?{' '}
        <Link to="/login" className="auth-link font-medium">
          Sign in
        </Link>
      </div>

    </motion.div>
  )
}

export default RegisterPage
