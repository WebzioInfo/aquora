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

export interface VerifyPasswordResetOtpResponse {
  success: boolean
  message: string
  email: string
  resetToken: string
  expiresInMinutes: number
}

export interface ResetPasswordPayload {
  email: string
  resetToken?: string
  code?: string
  newPassword: string
  confirmPassword?: string
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
  companyName?: string
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

  resendOtp: async (email: string, purpose: string = 'Registration'): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/resend-otp', { email, purpose })
    return response.data
  },

  sendOtp: async (email: string, purpose: string = 'Registration'): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/send-otp', { email, purpose })
    return response.data
  },

  // Password Recovery Endpoints
  forgotPassword: async (email: string): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/forgot-password', { email })
    return response.data
  },

  verifyPasswordResetOtp: async (email: string, code: string): Promise<ApiResponse<VerifyPasswordResetOtpResponse>> => {
    const response = await api.post<ApiResponse<VerifyPasswordResetOtpResponse>>('/api/v1/auth/verify-password-reset-otp', { email, code })
    return response.data
  },

  resetPassword: async (payload: ResetPasswordPayload | string, newPassword?: string): Promise<ApiResponse<boolean>> => {
    let body: ResetPasswordPayload
    if (typeof payload === 'string') {
      body = { email: payload, newPassword: newPassword || '' }
    } else {
      body = payload
    }
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/reset-password', body)
    return response.data
  },

  resendPasswordResetOtp: async (email: string): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/resend-password-reset-otp', { email, purpose: 'PasswordReset' })
    return response.data
  },

  // Email Change Endpoints
  requestEmailChange: async (newEmail: string): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/request-email-change', { newEmail })
    return response.data
  },

  verifyEmailChange: async (newEmail: string, code: string): Promise<ApiResponse<boolean>> => {
    const response = await api.post<ApiResponse<boolean>>('/api/v1/auth/verify-email-change', { newEmail, code })
    return response.data
  }
}
