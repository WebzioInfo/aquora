import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

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

    // Catch other errors and provide a safe message
    let errorMessage = "Unable to complete your request. Please try again later."
    let errorDetails: string[] = []
    let errorCode = "UNKNOWN_ERROR"

    if (error.response) {
      const { status, data } = error.response
      
      if (data?.code) {
        errorCode = data.code
      } else if (status === 401) {
        errorCode = "SESSION_EXPIRED"
      } else if (status === 403) {
        errorCode = "PERMISSION_DENIED"
      } else if (status === 404) {
        errorCode = "NOT_FOUND"
      } else if (status >= 500) {
        errorCode = "SERVER_ERROR"
      }

      // Priority 1: errors[] if available
      if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        errorDetails = data.errors.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e))
        errorMessage = errorDetails[0]
      }
      // Priority 2: message if available
      else if (data?.message) {
        errorMessage = data.message
      }
      // Priority 3: Friendly fallbacks
      else {
        if (status === 401) {
          errorMessage = "Your session has expired. Please login again."
        } else if (status === 403) {
          errorMessage = "You don't have permission to perform this action."
        } else if (status === 404) {
          errorMessage = "Requested resource not found."
        } else if (status >= 500) {
          errorMessage = "Unable to complete your request. Please try again later."
        }
      }

      // Mutate the response data so that component-level checks are transparently updated
      if (!error.response.data) {
        error.response.data = {}
      }
      error.response.data.success = false
      error.response.data.message = errorMessage
      error.response.data.errors = errorDetails.length > 0 ? errorDetails : [errorMessage]
      error.response.data.code = errorCode

    } else if (error.request) {
      errorMessage = "Unable to connect to the server. Check your internet connection."
      errorCode = "NETWORK_ERROR"
      errorDetails = [errorMessage]

      // Populate error.response with virtual data for network failures
      error.response = {
        status: 0,
        statusText: "Network Error",
        headers: {},
        config: originalRequest || error.config,
        data: {
          success: false,
          message: errorMessage,
          errors: errorDetails,
          code: errorCode
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
          errors: [errorMessage],
          code: errorCode
        }
      }
    }

    // Mutate the error object to contain the safe message
    error.message = errorMessage
    error.details = errorDetails
    error.code = errorCode

    return Promise.reject(error)
  }
)
