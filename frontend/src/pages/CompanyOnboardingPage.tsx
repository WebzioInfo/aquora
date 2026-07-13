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
    setLoading(true)
    try {
      const response = await onboardingService.onboardCompany({
        companyName: data.companyName,
        employeeCount: data.employeeCount,
        howDidYouHearAboutUs: data.howDidYouHearAboutUs,
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
            Initialize tenant workspace
          </p>
        </div>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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

        {/* Onboard Button */}
        <EnterpriseButton
          type="submit"
          loading={loading}
          className="w-full mt-2"
        >
          Initialize Tenant Workspace
        </EnterpriseButton>
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
