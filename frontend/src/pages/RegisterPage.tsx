import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authService } from '../services/auth'
import { useNotificationStore } from '../store/useNotificationStore'
import { Shield, Eye, EyeOff, UserPlus, CheckCircle, XCircle } from 'lucide-react'
import EnterpriseInput from '../components/ui/EnterpriseInput'
import EnterpriseButton from '../components/ui/EnterpriseButton'

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
    message: 'You must certify authorization to register',
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

  // Password requirements validation state
  const rules = {
    length: passwordVal.length >= 8,
    upper: /[A-Z]/.test(passwordVal),
    lower: /[a-z]/.test(passwordVal),
    number: /[0-9]/.test(passwordVal),
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

  const onSubmit = async (data: RegisterFormInputs) => {
    if (loading) return
    setLoading(true)
    try {
      const response = await authService.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      })

      if (response.success) {
        showToast('Registration completed. Enter the verification code sent to your email.', 'success')
        navigate('/verify-otp', { state: { email: data.email } })
      } else {
        showToast(response.message || 'Registration failed.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Registration failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {/* Title */}
      <div className="flex flex-col items-center text-center select-none">
        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_4px_20px_rgba(37,99,235,0.3)] mb-4">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Create Operator Profile</h1>
        <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">
          Establish System Clearance credentials
        </p>
      </div>

      {/* Caps Lock warning */}
      {capsLockActive && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 text-xs text-amber-300 flex items-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>CAPS LOCK IS ACTIVE</span>
        </div>
      )}

      {/* Form Area */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 text-left">
        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-350 select-none">Corporate Full Name *</label>
          <EnterpriseInput 
            id="fullName"
            placeholder="John Doe"
            disabled={loading}
            error={errors.fullName?.message}
            {...register('fullName')}
            className="bg-slate-950/40 border-slate-800/80 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 transition-all w-full"
            autoFocus
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-350 select-none">Corporate Email Address *</label>
          <EnterpriseInput 
            id="email"
            type="email"
            placeholder="name@company.com"
            disabled={loading}
            error={errors.email?.message}
            {...register('email')}
            className="bg-slate-950/40 border-slate-800/80 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 transition-all w-full"
          />
        </div>

        {/* Security Password */}
        <div className="relative w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-350 select-none">Security Password *</label>
          <div className="relative">
            <input 
              id="password"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={loading}
              onKeyDown={handleCapsLock}
              {...register('password')}
              className="bg-slate-950/40 border border-slate-800/80 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 pr-10 transition-all w-full outline-none"
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors cursor-pointer select-none"
              onClick={() => setShowPass(!showPass)}
              type="button"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password?.message && (
            <span className="text-[11px] font-semibold text-red-400 mt-1">{errors.password.message}</span>
          )}
        </div>

        {/* Password Strength Meter */}
        {passwordVal && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-950/20 border border-slate-900/60 select-none">
            <div className="flex justify-between items-center text-[10px] font-bold tracking-wider">
              <span className="text-slate-400 uppercase">Password Strength</span>
              <span className={
                strengthScore <= 1 ? 'text-red-400' :
                strengthScore === 2 ? 'text-amber-400' :
                strengthScore === 3 ? 'text-blue-400' : 'text-emerald-400'
              }>
                {strengthScore <= 1 ? 'WEAK' :
                 strengthScore === 2 ? 'FAIR' :
                 strengthScore === 3 ? 'GOOD' : 'STRONG'}
              </span>
            </div>
            {/* Strength Bars */}
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className={`h-1 rounded-full transition-all duration-350 ${
                    i <= strengthScore 
                      ? strengthScore <= 1 ? 'bg-red-500' 
                      : strengthScore === 2 ? 'bg-amber-500' 
                      : strengthScore === 3 ? 'bg-blue-500' : 'bg-emerald-500'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
            {/* Checklist */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                {rules.length ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                <span className={rules.length ? 'text-slate-200' : 'text-slate-500'}>8+ Characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.upper ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                <span className={rules.upper ? 'text-slate-200' : 'text-slate-500'}>Uppercase Letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.lower ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                <span className={rules.lower ? 'text-slate-200' : 'text-slate-500'}>Lowercase Letter</span>
              </div>
              <div className="flex items-center gap-1.5">
                {rules.number ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                <span className={rules.number ? 'text-slate-200' : 'text-slate-500'}>Contains Number</span>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Password */}
        <div className="relative w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-350 select-none">Confirm Security Password *</label>
          <div className="relative">
            <input 
              id="confirmPassword"
              type={showConfirmPass ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={loading}
              {...register('confirmPassword')}
              className="bg-slate-950/40 border border-slate-800/80 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm p-2.5 pr-10 transition-all w-full outline-none"
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors cursor-pointer select-none"
              onClick={() => setShowConfirmPass(!showConfirmPass)}
              type="button"
            >
              {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword?.message && (
            <span className="text-[11px] font-semibold text-red-400 mt-1">{errors.confirmPassword.message}</span>
          )}
        </div>

        {/* Certification Checkbox */}
        <div className="flex flex-col gap-1 select-none mt-1">
          <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all bg-slate-950/40"
              disabled={loading}
              {...register('agree')}
            />
            <span className="group-hover:text-blue-400 transition-colors leading-relaxed">
              I certify that I am an authorized representative of my organization.
            </span>
          </label>
          {errors.agree?.message && (
            <span className="text-[11px] font-semibold text-red-400 mt-1">{errors.agree.message}</span>
          )}
        </div>

        {/* Register Button */}
        <EnterpriseButton
          type="submit"
          loading={loading}
          className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-none shadow-[0_4px_20px_rgba(37,99,235,0.25)] transition-all font-bold text-white text-sm"
        >
          Register Account
        </EnterpriseButton>
      </form>

      {/* Switch modes */}
      <div className="text-center text-xs select-none">
        <span className="text-slate-500">Already registered?</span>
        <Link
          to="/login"
          className="text-blue-400 font-bold hover:text-blue-300 transition-colors ml-1.5 hover:underline cursor-pointer"
        >
          Sign In
        </Link>
      </div>

      {/* Security badge */}
      <div className="pt-5 border-t border-slate-800/80 text-center flex flex-col items-center gap-2 select-none">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-900/40">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>AES-256 Encrypted Portal</span>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
