import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { getDefaultRouteForUser } from '../routes/AppRoutes'
import { getFriendlyError } from '../utils/getFriendlyError'
import { Lock, Eye, EyeOff, Mail, AlertCircle, Loader2, ArrowRight } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginFormInputs = z.infer<typeof loginSchema>

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { showToast } = useNotificationStore()

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [errorBanner, setErrorBanner] = useState<{ title: string; message: string } | null>(null)
  const [rememberMe, setRememberMe] = useState(false)

  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    document.title = 'Sign in · Aquzio'
    const rememberedEmail = localStorage.getItem('aquzio_remember_email')
    if (rememberedEmail) {
      setRememberMe(true)
    }
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: localStorage.getItem('aquzio_remember_email') || '',
      password: '',
    },
  })

  // Hook form register for password with forwarded ref
  const passwordRegister = register('password')

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
    setErrorBanner(null)

    try {
      const response = await authService.login(data)
      const result = response.data
      
      if (response.success && result) {
        const { 
          accessToken, refreshToken, userId, email, firstName, 
          lastName, tenantId, roles, permissions, assignedProductionLineId, companyName 
        } = result
        
        localStorage.setItem('tenantCode', 'DEFAULT')
        if (rememberMe) {
          localStorage.setItem('aquzio_remember_email', data.email)
        } else {
          localStorage.removeItem('aquzio_remember_email')
        }
        
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
        const friendly = getFriendlyError(response, 'login')
        setErrorBanner({
          title: friendly.title,
          message: friendly.message,
        })
        setValue('password', '')
        setTimeout(() => passwordInputRef.current?.focus(), 50)
      }
    } catch (error: any) {
      const friendly = getFriendlyError(error, 'login')
      setErrorBanner({
        title: friendly.title,
        message: friendly.message,
      })
      // Keep entered email, clear only password, focus password
      setValue('password', '')
      setTimeout(() => passwordInputRef.current?.focus(), 50)
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
          Sign in to Aquzio
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1.5 leading-normal">
          Enter your credentials to access your workspace.
        </p>
      </div>

      {/* Inline Friendly Error Banner */}
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

      {/* Caps Lock Alert */}
      <AnimatePresence>
        {capsLockActive && (
          <motion.div 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="p-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-xs font-medium select-none"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Caps Lock is ON</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Controls — Native validation disabled (noValidate) */}
      <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4" noValidate>

        {/* Email or Username */}
        <div>
          <label htmlFor="login-email" className="auth-label">
            Email or Username
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="login-email"
              type="text"
              autoComplete="username"
              disabled={loading}
              placeholder="name@company.com"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              {...register('email')}
              className={`auth-input pl-10 pr-3.5 ${errors.email ? 'auth-input-error' : ''}`}
              autoFocus
            />
          </div>
          {errors.email?.message && (
            <div id="login-email-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email.message}</span>
            </div>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="login-password" className="auth-label">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={loading}
              onKeyDown={handleCapsLock}
              onKeyUp={handleCapsLock}
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              name={passwordRegister.name}
              onChange={passwordRegister.onChange}
              onBlur={passwordRegister.onBlur}
              ref={(el) => {
                passwordRegister.ref(el)
                passwordInputRef.current = el
              }}
              className={`auth-input pl-10 pr-10 ${errors.password ? 'auth-input-error' : ''}`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5B6B75] hover:text-[#05303B] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password?.message && (
            <div id="login-password-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.password.message}</span>
            </div>
          )}
        </div>

        {/* Remember Me & Forgot Password Row */}
        <div className="flex items-center justify-between pt-0.5 select-none">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="remember-me"
              disabled={loading}
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="auth-checkbox"
            />
            <span className="text-[13px] text-[#5B6B75]">Remember me</span>
          </label>

          <Link
            to="/forgot-password"
            className="auth-link"
          >
            Forgot password?
          </Link>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="auth-button-primary mt-1"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

      </form>

      {/* Bottom Switch Link */}
      <div className="border-t border-[#E8EDF0] pt-4 mt-5 text-center text-[13px] text-[#5B6B75] select-none">
        Don't have an account?{' '}
        <Link to="/register" className="auth-link font-medium">
          Create account
        </Link>
      </div>

    </motion.div>
  )
}

export default LoginPage
