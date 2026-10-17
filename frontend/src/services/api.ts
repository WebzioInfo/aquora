import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/useAuthStore'
import { getFriendlyError } from '../utils/getFriendlyError'
import type { ErrorContext } from '../utils/getFriendlyError'
import { envConfig } from '../config/env'

export const API_BASE_URL = envConfig.apiUrl

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// In-Flight GET Request Deduplication Cache
const inFlightGetRequests = new Map<string, Promise<any>>()

export const getDeduplicated = async <T = any>(url: string, config?: any): Promise<{ data: T }> => {
  const key = `${url}:${JSON.stringify(config?.params || {})}`
  if (inFlightGetRequests.has(key)) {
    return inFlightGetRequests.get(key)
  }

  const promise = api.get<T>(url, config)
    .then((res) => res)
    .finally(() => {
      setTimeout(() => {
        inFlightGetRequests.delete(key)
      }, 100)
    })

  inFlightGetRequests.set(key, promise)
  return promise
}

// Request Interceptor: Attach Bearer Token & Tenant Headers
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    const tenantId = useAuthStore.getState().user?.tenantId
    const storedTenantCode = localStorage.getItem('tenantCode')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId
    }

    if (storedTenantCode) {
      config.headers['X-Tenant-Code'] = storedTenantCode
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: any) => void
  reject: (reason?: any) => void
}> = []

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

function detectContextFromUrl(url: string = ''): ErrorContext {
  const lower = url.toLowerCase()
  if (lower.includes('/auth/login')) return 'login'
  if (lower.includes('/auth/register')) return 'register'
  if (lower.includes('/auth/forgot-password') || lower.includes('password-reset') || lower.includes('/otp')) return 'forgot-password'
  if (lower.includes('/payroll')) return 'payroll'
  if (lower.includes('/production') || lower.includes('/batch')) return 'production'
  if (lower.includes('/inventory') || lower.includes('/raw-material')) return 'inventory'
  if (lower.includes('/expense')) return 'expenses'
  if (lower.includes('/purchase')) return 'purchases'
  if (lower.includes('/sales') || lower.includes('/customer')) return 'sales'
  if (lower.includes('/backup')) return 'backup'
  return 'generic'
}

// Response Interceptor: Token Refresh & Central Friendly Error Normalization
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url || error.config?.url || ''
    const isLoginEndpoint = url.includes('/api/v1/auth/login')

    // Handle 401
    if (error.response?.status === 401 && !originalRequest?._retry && !isLoginEndpoint) {
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
        const friendly = getFriendlyError(error, detectContextFromUrl(url))
        error.message = friendly.message
        error.title = friendly.title
        if (error.response) {
          if (!error.response.data) error.response.data = {}
          error.response.data.message = friendly.message
          error.response.data.title = friendly.title
          error.response.data.success = false
        }
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
            assignedProductionLineId, 
            companyName 
          } = data.data

          setAuth(newToken, newRefreshToken, {
            userId: userId || currentUser?.userId || '',
            email: email || currentUser?.email || '',
            firstName: firstName || currentUser?.firstName || '',
            lastName: lastName || currentUser?.lastName || '',
            tenantId: tenantId ?? currentUser?.tenantId ?? null,
            roles: roles || currentUser?.roles || [],
            permissions: permissions || currentUser?.permissions || [],
            isTenantInitialized: currentUser?.isTenantInitialized ?? true,
            tenantStatus: currentUser?.tenantStatus || 'ACTIVE',
            emailVerified: currentUser?.emailVerified ?? true,
            assignedProductionLineId: assignedProductionLineId ?? currentUser?.assignedProductionLineId ?? null,
            companyName: companyName || currentUser?.companyName
          })

          processQueue(null, newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Central Error Normalization (Single Source of Truth)
    const context = detectContextFromUrl(url)
    const friendly = getFriendlyError(error, context)
    const errorMessage = friendly.message
    const errorCode = friendly.statusCode?.toString() || 'ERROR'
    let errorDetails: string[] = [errorMessage]

    if (error.response) {
      if (Array.isArray(error.response.data?.errors) && error.response.data.errors.length > 0) {
        errorDetails = error.response.data.errors.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e))
      }

      if (!error.response.data) {
        error.response.data = {}
      }
      error.response.data.success = false
      error.response.data.message = errorMessage
      error.response.data.errors = errorDetails
      error.response.data.code = errorCode
      error.response.data.title = friendly.title
      error.response.data.fieldErrors = friendly.fieldErrors
    } else if (error.request) {
      error.response = {
        status: 0,
        statusText: "Connection Error",
        headers: {},
        config: originalRequest || error.config,
        data: {
          success: false,
          message: errorMessage,
          errors: errorDetails,
          code: errorCode,
          title: friendly.title,
          fieldErrors: friendly.fieldErrors
        }
      }
    } else {
      error.response = {
        status: 0,
        statusText: "Client Error",
        headers: {},
        config: originalRequest || error.config,
        data: {
          success: false,
          message: errorMessage,
          errors: errorDetails,
          code: errorCode,
          title: friendly.title,
          fieldErrors: friendly.fieldErrors
        }
      }
    }

    // Guarantee that error.message is never a raw technical string
    error.message = errorMessage
    error.details = errorDetails
    error.code = errorCode
    error.title = friendly.title
    error.fieldErrors = friendly.fieldErrors
    error.friendly = friendly

    return Promise.reject(error)
  }
)

export default api
