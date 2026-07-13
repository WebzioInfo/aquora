import { api } from './api'

export interface RegisterRequest {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export interface VerifyOtpRequest {
  email: string
  code: string
  purpose?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponseData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  userId: string
  email: string
  firstName: string
  lastName: string
  tenantId: string | null
  roles: string[]
  permissions: string[]
  isTenantInitialized: boolean
  tenantStatus: string
  emailVerified: boolean
  assignedProductionLineId: string | null
  onboardingProgress?: number
  onboardingStep?: string | null
  onboardingFailureReason?: string | null
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface AuthMeResponse {
  userId: string
  name: string
  email: string
  emailVerified: boolean
  ownsCompany: boolean
  membershipCount: number
  isTenantInitialized: boolean
  tenantStatus: string
}

export interface UserSessionResponse {
  userId: string
  email: string
  firstName: string
  lastName: string
  tenantId: string | null
  tenantSchema: string
  companyName: string
  roles: string[]
  permissions: string[]
  ownsCompany: boolean
  isTenantInitialized: boolean
  tenantStatus: string
  emailVerified: boolean
  dashboard: string
  assignedProductionLineId: string | null
  onboardingProgress: number
  onboardingStep: string | null
  onboardingFailureReason: string | null
}

export const authService = {
  register: async (data: RegisterRequest): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/register', data)
    return response.data
  },

  verifyOtp: async (data: VerifyOtpRequest): Promise<ApiResponse<LoginResponseData>> => {
    const response = await api.post<ApiResponse<LoginResponseData>>('/api/v1/auth/verify-otp', {
      email: data.email,
      code: data.code,
      purpose: data.purpose || 'Registration'
    })
    return response.data
  },

  login: async (data: LoginRequest): Promise<ApiResponse<LoginResponseData>> => {
    const response = await api.post<ApiResponse<LoginResponseData>>('/api/v1/auth/login', data)
    return response.data
  },

  getMe: async (): Promise<ApiResponse<AuthMeResponse>> => {
    const response = await api.get<ApiResponse<AuthMeResponse>>('/api/v1/auth/me')
    return response.data
  },

  getSession: async (): Promise<ApiResponse<UserSessionResponse>> => {
    const response = await api.get<ApiResponse<UserSessionResponse>>('/api/v1/auth/session')
    return response.data
  },

  resendOtp: async (email: string): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/tenant/send-otp', { email })
    return response.data
  },

  sendOtp: async (email: string, purpose: string = 'Registration'): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/send-otp', { email, purpose })
    return response.data
  },

  resetPassword: async (email: string, newPassword: string): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/reset-password', { email, newPassword })
    return response.data
  },
}
