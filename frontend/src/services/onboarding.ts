import { api } from './api'
import type { ApiResponse } from './auth'

export interface CompanyOnboardingRequest {
  companyName: string
  employeeCount: number
  howDidYouHearAboutUs: string
  enabledStations?: string[]
}

export interface CompanyOnboardingResponse {
  tenantId: string
  companyId: string
  companyName: string
  schemaName: string
  ownerRole: string
  provisioningStatus: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  permissions: string[]
}

export interface InviteMemberRequest {
  email: string
  role: string
}

export const onboardingService = {
  onboardCompany: async (data: CompanyOnboardingRequest): Promise<ApiResponse<CompanyOnboardingResponse>> => {
    const response = await api.post<ApiResponse<CompanyOnboardingResponse>>('/api/v1/onboarding/company', data)
    return response.data
  },

  inviteMember: async (data: InviteMemberRequest): Promise<ApiResponse<boolean>> => {
    // Simulated team invitation because there is no API endpoint for it in the C# controllers.
    // This conforms to the instruction to avoid backend changes and SMTP.
    console.log('[TEAM INVITATION SIMULATION] Invited member:', data)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: `Successfully invited ${data.email} as ${data.role}.`,
          data: true
        })
      }, 500)
    })
  }
}
