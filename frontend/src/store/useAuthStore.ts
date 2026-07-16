import { create } from 'zustand'

export interface User {
  userId: string
  email: string
  firstName: string
  lastName: string
  tenantId: string | null
  roles: string[]
  permissions: string[]
  ownsCompany?: boolean
  username?: string | null
  assignedProductionLineId?: string | null
  isTenantInitialized?: boolean
  tenantStatus?: string | null
  emailVerified?: boolean
  onboardingProgress?: number
  onboardingStep?: string | null
  onboardingFailureReason?: string | null
  fullName?: string
  tenantName?: string
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, refreshToken: string, user: User) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set) => {
  const token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refreshToken')
  const rawUser = localStorage.getItem('user')
  let user: User | null = null
  
  try {
    user = rawUser ? JSON.parse(rawUser) : null
  } catch {
    // clear bad cache
    localStorage.removeItem('user')
  }

  return {
    token,
    refreshToken,
    user,
    isAuthenticated: !!token,
    setAuth: (token, refreshToken, user) => {
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      set({ token, refreshToken, user, isAuthenticated: true })
    },
    clearAuth: () => {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false })
    },
    updateUser: (updatedFields) => {
      set((state) => {
        if (!state.user) return state
        const newUser = { ...state.user, ...updatedFields }
        localStorage.setItem('user', JSON.stringify(newUser))
        return { user: newUser }
      })
    }
  }
})
