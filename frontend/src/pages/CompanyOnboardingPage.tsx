import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { onboardingService } from '../services/onboarding'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { Droplet, Lock } from 'lucide-react'
import EnterpriseInput from '../components/ui/EnterpriseInput'
import EnterpriseButton from '../components/ui/EnterpriseButton'
import EnterpriseBadge from '../components/ui/EnterpriseBadge'

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
        showToast('Company created successfully!', 'success')
        
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
            isTenantInitialized: true,
            emailVerified: user.emailVerified
          })
        }
        
        navigate('/invite-team')
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
    <div className="flex flex-col w-full gap-8">
      {/* Title block */}
      <div className="flex flex-col items-center gap-4 text-center select-none">
        <div className="w-14 h-14 bg-[#1A56DB] flex items-center justify-center rounded-[8px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <Droplet className="w-8 h-8 text-white fill-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#111827] dark:text-white">Company Onboarding</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {step === 1 ? 'Initialize tenant workspace' : 'Configure production stations'}
          </p>
        </div>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        
        {/* STEP 1 FIELDS */}
        <div className={step === 2 ? 'hidden' : 'flex flex-col gap-5'}>
          {/* Company Name */}
          <EnterpriseInput 
            id="companyName"
            label="Company Name *"
            placeholder="Aquaflow Industrial Ltd."
            disabled={loading}
            error={errors.companyName?.message}
            {...register('companyName')}
          />

          {/* Employee Count */}
          <EnterpriseInput 
            id="employeeCount"
            label="Employee Count *"
            placeholder="50"
            type="number"
            min={1}
            disabled={loading}
            error={errors.employeeCount?.message}
            {...register('employeeCount', { valueAsNumber: true })}
          />

          {/* Referral Source */}
          <EnterpriseInput 
            id="howDidYouHearAboutUs"
            label="How did you hear about Aquora? *"
            placeholder="e.g. Search engine, colleague, trade show"
            disabled={loading}
            error={errors.howDidYouHearAboutUs?.message}
            {...register('howDidYouHearAboutUs')}
          />
        </div>

        {/* STEP 2 FIELDS */}
        {step === 2 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              Select the active production stations for your manufacturing lines:
            </p>
            <div className="space-y-2.5">
              {Object.keys(enabledStations).map((stationName) => {
                const station = stationName as keyof typeof enabledStations
                return (
                  <div 
                    key={station} 
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-[8px]"
                  >
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">{station} Station</span>
                      <span className="text-[10px] text-slate-500 block">
                        {station === 'Blowing' && 'Manage preform materials and blowing logs'}
                        {station === 'Filling' && 'Track cap usage and bottle/water filling'}
                        {station === 'Labeling' && 'Track label application and wastage'}
                        {station === 'Packing' && 'Manage shrink film, glue, ink, and makeup logs'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enabledStations[station]}
                        onChange={(e) => setEnabledStations(prev => ({ ...prev, [station]: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Buttons */}
        {step === 1 ? (
          <EnterpriseButton
            type="submit"
            className="w-full mt-2"
          >
            Next: Configure Stations
          </EnterpriseButton>
        ) : (
          <div className="flex gap-3 mt-2">
            <EnterpriseButton
              type="button"
              variant="secondary"
              onClick={handleBack}
              disabled={loading}
              className="w-1/3"
            >
              Back
            </EnterpriseButton>
            <EnterpriseButton
              type="submit"
              loading={loading}
              className="flex-1"
            >
              Initialize Workspace
            </EnterpriseButton>
          </div>
        )}
      </form>

      {/* Card Info Footer */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-3 select-none">
        <p className="text-xs leading-relaxed text-slate-500">
          Proprietary Industrial Resource Planning Environment.
        </p>
        <EnterpriseBadge variant="danger" className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>Secure Access Only</span>
        </EnterpriseBadge>
      </div>
    </div>
  )
}

export default CompanyOnboardingPage
