import { api } from '../api'

export interface UserProfile {
  id: string
  email: string
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  displayName: string
  phone?: string | null
  photoUrl?: string | null
  department?: string | null
  designation?: string | null
  shift?: string | null
  joiningDate?: string | null
  isActive: boolean
  emailVerified: boolean
  emailVerifiedAt?: string | null
  lastLoginAt?: string | null
  createdAt: string
  updatedAt?: string | null
  isPlatformAdmin: boolean
  tenantId?: string | null
  companyName?: string | null
  tenantSchema?: string | null
  roleName?: string | null
  roles: string[]
  permissions: string[]
  devicesCount: number
  ownsCompany: boolean
  assignedProductionLineId?: string | null

  // QC / Professional Profile Fields
  qualification?: string | null
  certificationDetails?: string | null
  experienceYears?: number | null
  assignedLabStation?: string | null
  qcResponsibilities?: string | null
  signatureUrl?: string | null
}

export interface UpdateUserProfileRequest {
  firstName?: string
  lastName?: string
  username?: string
  phone?: string
  photoUrl?: string
  department?: string
  qualification?: string
  certificationDetails?: string
  experienceYears?: number
  assignedLabStation?: string
  qcResponsibilities?: string
  signatureUrl?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface UserAuditEvent {
  action: string
  timestamp: string
  ipAddress?: string | null
  device?: string | null
  reason?: string | null
}

export interface UserSecuritySummary {
  lastLoginAt?: string | null
  emailVerified: boolean
  emailVerifiedAt?: string | null
  devicesCount: number
  tokenVersion: number
  twoFactorEnabled: boolean
  recentAuditEvents: UserAuditEvent[]
}

export const userProfileApi = {
  getMyProfile: async (): Promise<UserProfile> => {
    const res = await api.get('/api/v1/users/me')
    if (res.data?.success && res.data?.data) {
      return res.data.data
    }
    return res.data
  },

  updateMyProfile: async (payload: UpdateUserProfileRequest): Promise<UserProfile> => {
    const res = await api.put('/api/v1/users/me', payload)
    if (res.data?.success && res.data?.data) {
      return res.data.data
    }
    return res.data
  },

  changePassword: async (payload: ChangePasswordRequest): Promise<boolean> => {
    const res = await api.post('/api/v1/users/me/change-password', payload)
    return res.data?.success ?? true
  },

  getSecuritySummary: async (): Promise<UserSecuritySummary> => {
    const res = await api.get('/api/v1/users/me/security')
    if (res.data?.success && res.data?.data) {
      return res.data.data
    }
    return res.data
  },

  updateAvatar: async (photoUrl: string | null): Promise<UserProfile> => {
    if (photoUrl) {
      const res = await api.post('/api/v1/users/me/avatar', { photoUrl })
      return res.data?.data ?? res.data
    } else {
      const res = await api.delete('/api/v1/users/me/avatar')
      return res.data?.data ?? res.data
    }
  },

  uploadAvatarFile: async (file: File): Promise<UserProfile> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/api/v1/users/me/avatar/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return res.data?.data ?? res.data
  },

  removeAvatar: async (): Promise<UserProfile> => {
    const res = await api.delete('/api/v1/users/me/avatar')
    return res.data?.data ?? res.data
  },

  uploadSignatureFile: async (file: File): Promise<UserProfile> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/api/v1/users/me/signature/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return res.data?.data ?? res.data
  },

  removeSignature: async (): Promise<UserProfile> => {
    const res = await api.delete('/api/v1/users/me/signature')
    return res.data?.data ?? res.data
  },

  uploadCompanyLogoFile: async (file: File): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/api/v1/company/logo/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return res.data?.data ?? res.data
  },

  removeCompanyLogo: async (): Promise<any> => {
    const res = await api.delete('/api/v1/company/logo')
    return res.data?.data ?? res.data
  }
}
