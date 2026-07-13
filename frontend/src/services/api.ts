import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Attach Token & Tenant ID
api.interceptors.request.use(
  (config) => {
    const { token, user } = useAuthStore.getState()
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    if (user?.tenantId) {
      config.headers['X-Tenant-Id'] = user.tenantId
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: Seamless Token Rotation on 401
let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const { refreshToken, token, setAuth, clearAuth } = useAuthStore.getState()

      if (!refreshToken || !token) {
        clearAuth()
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
          accessToken: token,
          refreshToken: refreshToken,
        })

        const data = response.data
        if (data.success && data.data) {
          const { user: currentUser } = useAuthStore.getState()
          const { 
            accessToken: newToken, 
            refreshToken: newRefreshToken, 
            userId, 
            email, 
            firstName, 
            lastName, 
            tenantId, 
            roles, 
            permissions,
            isTenantInitialized,
            tenantStatus,
            emailVerified,
            assignedProductionLineId
          } = data.data
          
          setAuth(newToken, newRefreshToken, {
            ...currentUser,
            userId,
            email,
            firstName,
            lastName,
            tenantId,
            roles,
            permissions,
            isTenantInitialized: isTenantInitialized ?? currentUser?.isTenantInitialized,
            tenantStatus: tenantStatus ?? currentUser?.tenantStatus,
            emailVerified: emailVerified ?? currentUser?.emailVerified,
            assignedProductionLineId: assignedProductionLineId ?? currentUser?.assignedProductionLineId
          })

          processQueue(null, newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuth()
        // Force redirect to login page if window is available
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
