import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'
import { mapErrorToUserFriendly } from '../utils/errorMapper'

const getSanitizedApiBaseUrl = (): string => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  
  // 1. Prepend https:// if missing scheme
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Check if it's localhost to use http, else https
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      url = `http://${url}`
    } else {
      url = `https://${url}`
    }
  }

  // 2. Strip /api/v1 or trailing slashes if accidentally included in the environment variable
  // because all our service calls explicitly include /api/v1/...
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.origin // This returns just 'https://domain.com' without trailing slash or path
  } catch (e) {
    // Fallback if URL parsing fails
    return url.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
  }
}

export const API_BASE_URL = getSanitizedApiBaseUrl()

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
            assignedProductionLineId,
            companyName
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
            assignedProductionLineId: assignedProductionLineId ?? currentUser?.assignedProductionLineId,
            companyName: companyName ?? currentUser?.companyName,
            tenantName: companyName ?? currentUser?.companyName
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

    // Map any raw error, status code, or DB exception into clean user-friendly feedback
    const userFriendly = mapErrorToUserFriendly(error)
    const errorMessage = userFriendly.message
    const errorCode = userFriendly.code
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
      error.response.data.title = userFriendly.title
    } else if (error.request) {
      error.response = {
        status: 0,
        statusText: "Network Error",
        headers: {},
        config: originalRequest || error.config,
        data: {
          success: false,
          message: errorMessage,
          errors: errorDetails,
          code: errorCode,
          title: userFriendly.title
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
          title: userFriendly.title
        }
      }
    }

    // Mutate the error object to contain the safe user-friendly message & title
    error.message = errorMessage
    error.details = errorDetails
    error.code = errorCode
    error.title = userFriendly.title
    error.userFriendly = userFriendly

    return Promise.reject(error)
  }
)
