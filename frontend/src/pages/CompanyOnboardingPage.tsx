import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { onboardingService } from '../services/onboarding'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import BRAND from '../config/brand'
import AuthWatermark from '../components/ui/AuthWatermark'
import { 
  Building2, Globe, Phone, MapPin, Users, HelpCircle,
  ArrowRight, ArrowLeft, Loader2, Plus, Trash2, CheckCircle2 
} from 'lucide-react'

const onboardingSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  employeeCount: z.number().min(1, 'Employee count must be at least 1'),
  howDidYouHearAboutUs: z.string().min(1, 'Please specify how you heard about us'),
})

type OnboardingFormInputs = z.infer<typeof onboardingSchema>

export const CompanyOnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, setAuth } = useAuthStore()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [enabledStations, setEnabledStations] = useState<Record<string, boolean>>({
    Blowing: true,
    Filling: true,
    Labeling: true,
    Packing: true,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormInputs>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      companyName: '',
      employeeCount: 1,
      howDidYouHearAboutUs: '',
    },
  })

  const onSubmit = async (data: OnboardingFormInputs) => {
    if (step === 1) {
      setStep(2)
      return
    }

    setLoading(true)
    try {
      const response = await onboardingService.onboardCompany({
        companyName: data.companyName,
        employeeCount: data.employeeCount,
        howDidYouHearAboutUs: data.howDidYouHearAboutUs,
        enabledStations: Object.keys(enabledStations).filter(k => enabledStations[k]),
      })

      if (response.success && response.data) {
        showToast('Company workspace created successfully!', 'success')
        
        if (user) {
          setAuth(response.data.accessToken, response.data.refreshToken, {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            tenantId: response.data.tenantId,
            roles: [response.data.ownerRole],
            permissions: response.data.permissions,
            ownsCompany: true,
            isTenantInitialized: false,
            tenantStatus: 'Provisioning',
            emailVerified: user.emailVerified
          })
        }
        
        navigate('/account-setup')
      } else {
        showToast(response.message || 'Onboarding failed.', 'error')
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Onboarding failed.'
      showToast(errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  return (
    <div className="w-full flex justify-center items-center font-sans">

      {/* FRESH WHITE AUTHENTICATION SURFACE CARD */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xs p-8 sm:p-9 space-y-5 relative z-10"
      >
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 select-none">
          <img src={BRAND.logo} alt={BRAND.name} className="h-12 w-auto object-contain mb-1" />
          <div>
            <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
              Company Onboarding
            </h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2563EB] mt-0.5">
              {step === 1 ? 'Step 1: Workspace Details' : 'Step 2: Production Stations'}
            </p>
          </div>
        </div>

        {/* Step Indicator Bar */}
        <div className="flex items-center gap-2 pt-1">
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'}`} />
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3.5"
              >
                {/* Company Name (54px Height) */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#111827] select-none">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                    <input
                      id="companyName"
                      type="text"
                      disabled={loading}
                      placeholder="Aquora Industrial Ltd."
                      {...register('companyName')}
                      className={`w-full pl-10 pr-3.5 h-[54px] bg-white border ${
                        errors.companyName ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                      } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
                      autoFocus
                    />
                  </div>
                  {errors.companyName?.message && (
                    <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.companyName.message}</p>
                  )}
                </div>

                {/* Employee Count (54px Height) */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#111827] select-none">
                    Employee Count <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                      <Users className="w-4.5 h-4.5" />
                    </div>
                    <input
                      id="employeeCount"
                      type="number"
                      min={1}
                      disabled={loading}
                      placeholder="50"
                      {...register('employeeCount', { valueAsNumber: true })}
                      className={`w-full pl-10 pr-3.5 h-[54px] bg-white border ${
                        errors.employeeCount ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                      } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
                    />
                  </div>
                  {errors.employeeCount?.message && (
                    <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.employeeCount.message}</p>
                  )}
                </div>

                {/* Referral Source (54px Height) */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#111827] select-none">
                    How did you hear about Aquora? <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                      <HelpCircle className="w-4.5 h-4.5" />
                    </div>
                    <input
                      id="howDidYouHearAboutUs"
                      type="text"
                      disabled={loading}
                      placeholder="Search engine, colleague, trade show"
                      {...register('howDidYouHearAboutUs')}
                      className={`w-full pl-10 pr-3.5 h-[54px] bg-white border ${
                        errors.howDidYouHearAboutUs ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                      } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
                    />
                  </div>
                  {errors.howDidYouHearAboutUs?.message && (
                    <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.howDidYouHearAboutUs.message}</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <p className="text-xs font-medium text-[#6B7280] leading-relaxed select-none">
                  Select the active production stations for your manufacturing lines:
                </p>

                {/* Production Station Toggles */}
                <div className="space-y-2.5">
                  {Object.keys(enabledStations).map((stationName) => {
                    const station = stationName as keyof typeof enabledStations
                    const isChecked = enabledStations[station]
                    return (
                      <div 
                        key={station} 
                        className={`p-3.5 bg-[#FAFBFC] hover:bg-white border ${
                          isChecked ? 'border-[#2563EB]/30 shadow-2xs' : 'border-[#E5E7EB]'
                        } rounded-xl flex items-center justify-between transition-all select-none`}
                      >
                        <div className="text-left space-y-0.5">
                          <span className="text-xs font-bold text-[#111827] block">
                            {station} Station
                          </span>
                          <span className="text-[11px] text-[#6B7280] block">
                            {station === 'Blowing' && 'Manage preform materials and blowing logs'}
                            {station === 'Filling' && 'Track cap usage and bottle/water filling'}
                            {station === 'Labeling' && 'Track label application and wastage'}
                            {station === 'Packing' && 'Manage shrink film, glue, ink, and makeup logs'}
                          </span>
                        </div>

                        {/* Modern Switch */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setEnabledStations(prev => ({ ...prev, [station]: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5.5 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:bg-[#2563EB] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all after:shadow-xs peer-checked:after:translate-x-[18px]"></div>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {step === 1 ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Next: Configure Stations</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <div className="flex items-center gap-3 mt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="w-1/3 h-[54px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#111827] font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4 text-[#6B7280]" />
                <span>Back</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="flex-1 h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Initializing...</span>
                  </>
                ) : (
                  <>
                    <span>Initialize Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </div>
          )}

        </form>

        {/* Footer info */}
        <div className="pt-3 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280] select-none">
          Proprietary Industrial Resource Planning Environment
        </div>

      </motion.div>

    </div>
  )
}

export default CompanyOnboardingPage
