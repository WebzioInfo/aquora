import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { onboardingService } from '../services/onboarding'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { getFriendlyError } from '../utils/getFriendlyError'
import {
  Building2, Users, HelpCircle, ArrowRight, ArrowLeft,
  Loader2, Check, CheckCircle2, AlertCircle
} from 'lucide-react'

const onboardingSchema = z.object({
  companyName: z.string().min(1, 'Enter your company name'),
  employeeCount: z.number().min(1, 'Employee count must be at least 1'),
  howDidYouHearAboutUs: z.string().min(1, 'Please specify how you heard about us'),
})

type OnboardingFormInputs = z.infer<typeof onboardingSchema>

interface StationConfig {
  key: string
  name: string
  description: string
}

const STATION_LIST: StationConfig[] = [
  { key: 'Blowing', name: 'Blowing Station', description: 'Manage preform materials and blowing logs' },
  { key: 'Filling', name: 'Filling Station', description: 'Track cap usage and bottle/water filling' },
  { key: 'Labeling', name: 'Labeling Station', description: 'Track label application and wastage' },
  { key: 'Packing', name: 'Packing Station', description: 'Manage shrink film, glue, ink, and packaging logs' },
]

export const CompanyOnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, setAuth } = useAuthStore()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [errorBanner, setErrorBanner] = useState<{ title: string; message: string } | null>(null)

  const [enabledStations, setEnabledStations] = useState<Record<string, boolean>>({
    Blowing: true,
    Filling: true,
    Labeling: true,
    Packing: true,
  })

  useEffect(() => {
    document.title = 'Company setup · Aquzio'
  }, [])

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<OnboardingFormInputs>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      companyName: '',
      employeeCount: 1,
      howDidYouHearAboutUs: '',
    },
  })

  const handleNextStep = async () => {
    setErrorBanner(null)
    const valid = await trigger()
    if (valid) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setErrorBanner(null)
    setStep(1)
  }

  const toggleStation = (stationKey: string) => {
    setEnabledStations(prev => ({
      ...prev,
      [stationKey]: !prev[stationKey]
    }))
  }

  const onSubmit = async (data: OnboardingFormInputs) => {
    setErrorBanner(null)
    const activeStations = Object.keys(enabledStations).filter(k => enabledStations[k])
    if (activeStations.length === 0) {
      setErrorBanner({
        title: 'Select at least one station',
        message: 'Your production plant requires at least one active station to proceed.'
      })
      return
    }

    setLoading(true)
    try {
      const response = await onboardingService.onboardCompany({
        companyName: data.companyName,
        employeeCount: data.employeeCount,
        howDidYouHearAboutUs: data.howDidYouHearAboutUs,
        enabledStations: activeStations,
      })

      if (response.success && response.data) {
        showToast('Company workspace created successfully', 'success')

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
        const friendly = getFriendlyError(response, 'onboarding')
        setErrorBanner({
          title: friendly.title,
          message: friendly.message
        })
      }
    } catch (error: any) {
      const friendly = getFriendlyError(error, 'onboarding')
      setErrorBanner({
        title: friendly.title,
        message: friendly.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="auth-card-wide"
    >
      {/* Top circle mark, title, and subtitle */}
      <div className="flex flex-col items-center text-center select-none mb-6">
        <img
          src="/brand/aquzio-icon-light.png"
          alt="Aquzio"
          className="w-11 h-11 object-contain mb-3"
        />
        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          Set up your company workspace
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1 leading-normal">
          Configure your plant profile and production lines in two quick steps.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-6 select-none" aria-label="Onboarding steps">
        {/* Desktop / Tablet: Numbered steps with labels */}
        <div className="hidden sm:flex items-center justify-between relative">
          {/* Connecting Line */}
          <div className="absolute top-4 left-8 right-8 h-[1px] bg-[#E3E8EC] z-0" />

          {/* Step 1 Item */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                step > 1
                  ? 'bg-[#12A89A] border-[#12A89A] text-white'
                  : 'bg-[#05303B] border-[#05303B] text-white'
              }`}
            >
              {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span
              className={`text-xs font-medium ${
                step === 1 ? 'text-[#05303B] font-semibold' : 'text-[#5B6B75]'
              }`}
            >
              Company Details
            </span>
          </div>

          {/* Step 2 Item */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                step === 2
                  ? 'bg-[#05303B] border-[#05303B] text-white'
                  : 'bg-white border-[#CBD5DB] text-[#94A3AD]'
              }`}
            >
              2
            </div>
            <span
              className={`text-xs font-medium ${
                step === 2 ? 'text-[#05303B] font-semibold' : 'text-[#94A3AD]'
              }`}
            >
              Production Stations
            </span>
          </div>
        </div>

        {/* Mobile View: Collapsed Step X of 2 with 4px Flat Bar */}
        <div className="sm:hidden space-y-1.5">
          <div className="flex justify-between items-center text-xs text-[#5B6B75]">
            <span className="font-semibold text-[#05303B]">Step {step} of 2</span>
            <span>{step === 1 ? 'Company Details' : 'Production Stations'}</span>
          </div>
          <div className="w-full bg-[#E3E8EC] rounded-full h-1 overflow-hidden">
            <div
              className="bg-[#12A89A] h-full transition-all duration-200"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Friendly Error Banner */}
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

      {/* Form Form Controls (noValidate) */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="auth-label">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="companyName"
                    type="text"
                    disabled={loading}
                    placeholder="Aquzio Bottling Works Ltd."
                    aria-invalid={errors.companyName ? 'true' : 'false'}
                    aria-describedby={errors.companyName ? 'companyName-error' : undefined}
                    {...register('companyName')}
                    className={`auth-input pl-10 pr-3.5 ${errors.companyName ? 'auth-input-error' : ''}`}
                    autoFocus
                  />
                </div>
                {errors.companyName?.message && (
                  <div id="companyName-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.companyName.message}</span>
                  </div>
                )}
              </div>

              {/* Employee Count */}
              <div>
                <label htmlFor="employeeCount" className="auth-label">
                  Employee Count <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    id="employeeCount"
                    type="number"
                    min={1}
                    disabled={loading}
                    placeholder="25"
                    aria-invalid={errors.employeeCount ? 'true' : 'false'}
                    aria-describedby={errors.employeeCount ? 'employeeCount-error' : undefined}
                    {...register('employeeCount', { valueAsNumber: true })}
                    className={`auth-input pl-10 pr-3.5 ${errors.employeeCount ? 'auth-input-error' : ''}`}
                  />
                </div>
                {errors.employeeCount?.message && (
                  <div id="employeeCount-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.employeeCount.message}</span>
                  </div>
                )}
              </div>

              {/* Referral Source */}
              <div>
                <label htmlFor="howDidYouHearAboutUs" className="auth-label">
                  How did you hear about Aquzio? <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5B6B75]">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <input
                    id="howDidYouHearAboutUs"
                    type="text"
                    disabled={loading}
                    placeholder="Search engine, industry colleague, trade event"
                    aria-invalid={errors.howDidYouHearAboutUs ? 'true' : 'false'}
                    aria-describedby={errors.howDidYouHearAboutUs ? 'howDidYouHearAboutUs-error' : undefined}
                    {...register('howDidYouHearAboutUs')}
                    className={`auth-input pl-10 pr-3.5 ${errors.howDidYouHearAboutUs ? 'auth-input-error' : ''}`}
                  />
                </div>
                {errors.howDidYouHearAboutUs?.message && (
                  <div id="howDidYouHearAboutUs-error" className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.howDidYouHearAboutUs.message}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="mb-2">
                <span className="auth-label">Active Plant Stations</span>
                <p className="text-xs text-[#5B6B75]">
                  Select the operational stations currently installed on your bottling and packaging lines.
                </p>
              </div>

              {/* Bordered Check Cards for Stations */}
              <div className="space-y-2 select-none" role="group" aria-label="Production stations">
                {STATION_LIST.map((station) => {
                  const isChecked = !!enabledStations[station.key]
                  return (
                    <div
                      key={station.key}
                      onClick={() => toggleStation(station.key)}
                      className={`auth-radio-card ${isChecked ? 'selected' : ''}`}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          toggleStation(station.key)
                        }
                      }}
                    >
                      <div className="pr-3">
                        <span className="text-sm font-semibold text-[#05303B] block">
                          {station.name}
                        </span>
                        <span className="text-xs text-[#5B6B75] block mt-0.5">
                          {station.description}
                        </span>
                      </div>

                      {/* Custom Flat Teal Checkbox Indicator */}
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          isChecked
                            ? 'bg-[#12A89A] border-[#12A89A] text-white'
                            : 'border-[#CBD5DB] bg-white text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Footer Row */}
        <div className="flex items-center justify-between border-t border-[#E8EDF0] pt-5 mt-6">
          {step === 2 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="auth-button-text"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <span className="text-xs text-[#5B6B75]">Step 1 of 2</span>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="auth-button-primary w-auto px-6 ml-auto"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="auth-button-primary w-auto px-6 ml-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </motion.div>
  )
}

export default CompanyOnboardingPage
