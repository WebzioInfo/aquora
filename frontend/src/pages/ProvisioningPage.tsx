import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HubConnectionBuilder, HubConnection, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { getFriendlyError } from '../utils/getFriendlyError'
import { api, API_BASE_URL } from '../services/api'
import {
  Check, CheckCircle2, AlertCircle, HelpCircle, LogOut,
  Loader2, RefreshCw, Download, ArrowRight, Building2
} from 'lucide-react'

interface ProvisionStep {
  key: string
  name: string
  status: 'Pending' | 'Running' | 'Completed' | 'Failed'
  errorMessage?: string | null
}

interface ProvisioningStatusResponse {
  tenantId?: string | null
  status: 'Pending' | 'Provisioning' | 'Completed' | 'Failed'
  progress: number
  currentStep: string
  message: string
  failureReason?: string | null
  steps?: ProvisionStep[]
  estimatedRemainingSeconds?: number | null
}

export const ProvisioningPage: React.FC = () => {
  const navigate = useNavigate()
  const { token, updateUser, clearAuth } = useAuthStore()
  const { showToast } = useNotificationStore()

  // Real initial state: truthful, honest, no fake progress
  const [statusState, setStatusState] = useState<ProvisioningStatusResponse>({
    status: 'Pending',
    progress: 0,
    currentStep: '',
    message: 'Checking workspace provisioning status...',
    steps: [],
    estimatedRemainingSeconds: 0
  })

  const [connectionMode, setConnectionMode] = useState<'SignalR' | 'Polling' | 'Reconnecting'>('Polling')
  const [reconnectAttempt, setReconnectAttempt] = useState(1)
  const [isRetrying, setIsRetrying] = useState(false)
  const [noWorkspaceFound, setNoWorkspaceFound] = useState(false)

  const connectionRef = useRef<HubConnection | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const completionHandledRef = useRef(false)

  useEffect(() => {
    document.title = 'Setting up workspace · Aquzio'
  }, [])

  // Redirect to dashboard cleanly after backend signals completion
  const handleFinalRedirect = useCallback(async () => {
    if (completionHandledRef.current || !isMountedRef.current) return
    completionHandledRef.current = true

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (connectionRef.current && connectionRef.current.state === HubConnectionState.Connected) {
      try {
        await connectionRef.current.stop()
      } catch { }
      connectionRef.current = null
    }

    try {
      const response = await authService.getSession()
      if (response.success && response.data) {
        updateUser({
          tenantId: response.data.tenantId,
          roles: response.data.roles,
          permissions: response.data.permissions,
          ownsCompany: response.data.ownsCompany,
          isTenantInitialized: response.data.isTenantInitialized,
          tenantStatus: response.data.tenantStatus,
          emailVerified: response.data.emailVerified,
          assignedProductionLineId: response.data.assignedProductionLineId
        })
      }
    } catch (err) {
      console.error('[PROVISIONING]: Session refresh error, proceeding:', err)
    }

    showToast('Your workspace is initialized!', 'success')
    setTimeout(() => {
      if (isMountedRef.current) {
        navigate('/company/dashboard', { replace: true })
      }
    }, 600)
  }, [navigate, updateUser, showToast])

  const handleFinalRedirectRef = useRef(handleFinalRedirect)
  useEffect(() => {
    handleFinalRedirectRef.current = handleFinalRedirect
  }, [handleFinalRedirect])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    pollIntervalRef.current = setInterval(() => {
      fetchTelemetryStatusRef.current()
    }, 3000)
  }, [])

  // HTTP Polling: Queries /api/v1/onboarding/status
  const fetchTelemetryStatus = useCallback(async () => {
    if (!isMountedRef.current || completionHandledRef.current) return
    try {
      const res = await api.get('/api/v1/onboarding/status')
      const data: ProvisioningStatusResponse = res.data?.data
      if (!data || !isMountedRef.current) return

      if (data.status === 'Pending' && !data.tenantId) {
        setNoWorkspaceFound(true)
        setStatusState(prev => ({
          ...prev,
          status: 'Pending',
          progress: 0,
          currentStep: '',
          message: data.message || 'No workspace created yet.',
          steps: [],
          failureReason: null
        }))
        return
      }

      setNoWorkspaceFound(false)

      setStatusState(prev => {
        let mergedSteps = (data.steps && data.steps.length > 0 ? data.steps : prev.steps) || []

        if (data.status === 'Completed') {
          mergedSteps = mergedSteps.map(s => ({ ...s, status: 'Completed' }))
        } else if (data.currentStep && mergedSteps.length > 0) {
          let foundCurrent = false
          mergedSteps = mergedSteps.map(s => {
            if (s.name === data.currentStep || s.key === data.currentStep) {
              foundCurrent = true
              return { ...s, status: data.status === 'Failed' ? 'Failed' : 'Running' }
            }
            if (!foundCurrent) {
              return { ...s, status: 'Completed' }
            }
            return { ...s, status: 'Pending' }
          })
        }

        return {
          ...prev,
          tenantId: data.tenantId ?? prev.tenantId,
          status: data.status,
          progress: data.progress,
          currentStep: data.currentStep || prev.currentStep,
          message: data.message || prev.message,
          failureReason: data.failureReason || (data.status === 'Failed' ? 'Provisioning pipeline encountered an error.' : null),
          steps: mergedSteps,
          estimatedRemainingSeconds: data.estimatedRemainingSeconds
        }
      })

      if (data.status === 'Completed' || data.progress >= 100) {
        stopPolling()
        handleFinalRedirectRef.current()
      } else if (data.status === 'Failed') {
        stopPolling()
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNoWorkspaceFound(true)
      }
    }
  }, [stopPolling])

  const fetchTelemetryStatusRef = useRef(fetchTelemetryStatus)
  useEffect(() => {
    fetchTelemetryStatusRef.current = fetchTelemetryStatus
  }, [fetchTelemetryStatus])

  // Real-Time SignalR Stream Connection with Reconnection
  useEffect(() => {
    isMountedRef.current = true
    completionHandledRef.current = false

    fetchTelemetryStatusRef.current()

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/provisioning`, {
        accessTokenFactory: () => token || '',
        withCredentials: true
      })
      .configureLogging(LogLevel.None)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount >= 5) return null
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 10000)
        }
      })
      .build()

    connectionRef.current = connection

    connection.on('ReceiveProvisioningStatus', (payload: ProvisioningStatusResponse) => {
      if (!isMountedRef.current || completionHandledRef.current) return
      setConnectionMode('SignalR')

      setStatusState(prev => {
        let mergedSteps = (payload.steps && payload.steps.length > 0 ? payload.steps : prev.steps) || []

        if (payload.status === 'Completed') {
          mergedSteps = mergedSteps.map(s => ({ ...s, status: 'Completed' }))
        } else if (payload.currentStep && mergedSteps.length > 0) {
          let foundCurrent = false
          mergedSteps = mergedSteps.map(s => {
            if (s.name === payload.currentStep || s.key === payload.currentStep) {
              foundCurrent = true
              return { ...s, status: payload.status === 'Failed' ? 'Failed' : 'Running' }
            }
            if (!foundCurrent) {
              return { ...s, status: 'Completed' }
            }
            return { ...s, status: 'Pending' }
          })
        }

        return {
          ...prev,
          tenantId: payload.tenantId ?? prev.tenantId,
          status: payload.status,
          progress: payload.progress,
          currentStep: payload.currentStep || prev.currentStep,
          message: payload.message || prev.message,
          failureReason: payload.failureReason || (payload.status === 'Failed' ? 'Provisioning pipeline encountered an error.' : null),
          steps: mergedSteps,
          estimatedRemainingSeconds: payload.estimatedRemainingSeconds
        }
      })

      if (payload.status === 'Completed' || payload.progress >= 100) {
        stopPolling()
        handleFinalRedirectRef.current()
      } else if (payload.status === 'Failed') {
        stopPolling()
      }
    })

    connection.onreconnecting((error) => {
      if (!isMountedRef.current) return
      setConnectionMode('Reconnecting')
      setReconnectAttempt(prev => prev + 1)
      startPolling()
    })

    connection.onreconnected(() => {
      if (!isMountedRef.current) return
      setConnectionMode('SignalR')
      setReconnectAttempt(1)
      stopPolling()
      fetchTelemetryStatusRef.current()
    })

    connection.onclose(() => {
      if (!isMountedRef.current) return
      setConnectionMode('Polling')
      if (!completionHandledRef.current) {
        startPolling()
      }
    })

    connection
      .start()
      .then(() => {
        if (isMountedRef.current) {
          setConnectionMode('SignalR')
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setConnectionMode('Polling')
          startPolling()
        }
      })

    return () => {
      isMountedRef.current = false
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch(() => {})
      }
    }
  }, [token, startPolling, stopPolling])

  // Handle Retry
  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      const response = await api.post('/api/v1/onboarding/retry')
      if (response.data?.success) {
        showToast('Restarted workspace setup', 'info')
        setStatusState(prev => ({ ...prev, status: 'Provisioning', failureReason: null }))
        startPolling()
        fetchTelemetryStatus()
      } else {
        const friendly = getFriendlyError(response.data, 'provisioning')
        showToast(friendly.message, 'error')
      }
    } catch (err: any) {
      const friendly = getFriendlyError(err, 'provisioning')
      showToast(friendly.message, 'error')
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle Log Out
  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  // Diagnostic Log Download
  const handleDownloadLog = () => {
    const logContent = `AQUZIO WORKSPACE SETUP DIAGNOSTIC
Generated: ${new Date().toISOString()}
Status: ${statusState.status}
Progress: ${statusState.progress}%
Current Step: ${statusState.currentStep}
Error: ${statusState.failureReason || 'None'}
Pipeline Stages:
${(statusState.steps || []).map(s => `- [${s.status}] ${s.name}`).join('\n')}`

    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aquzio_setup_diagnostic_${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const isFailed = statusState.status === 'Failed'
  const isComplete = statusState.status === 'Completed' || statusState.progress >= 100
  const isPendingNoWorkspace = noWorkspaceFound || (statusState.status === 'Pending' && (statusState.steps || []).length === 0)
  const steps = statusState.steps || []
  const completedCount = steps.filter(s => s.status === 'Completed').length
  const calculatedProgress = isComplete ? 100 : (steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : statusState.progress)

  // Friendly failure message translation
  const friendlyFailure = isFailed
    ? getFriendlyError({ message: statusState.failureReason || 'Setup error' }, 'provisioning')
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="auth-card-wide"
      aria-live="polite"
    >
      {/* Circle mark header and title */}
      <div className="flex flex-col items-center text-center select-none mb-6">
        {isComplete ? (
          <div className="w-12 h-12 rounded-full bg-[#12A89A]/10 border border-[#12A89A]/30 flex items-center justify-center text-[#12A89A] mb-3">
            <Check className="w-6 h-6 stroke-[2.5]" />
          </div>
        ) : isFailed ? (
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
        ) : (
          <img
            src="/brand/aquzio-icon-light.png"
            alt="Aquzio"
            className="w-11 h-11 object-contain mb-3"
          />
        )}

        <h1 className="text-[22px] font-semibold text-[#05303B] tracking-tight leading-tight">
          {isPendingNoWorkspace
            ? 'Company setup required'
            : isFailed
            ? 'Workspace setup could not complete'
            : isComplete
            ? 'Your workspace is ready'
            : 'Setting up your workspace'}
        </h1>
        <p className="text-[14px] text-[#5B6B75] mt-1 leading-normal max-w-md">
          {isPendingNoWorkspace
            ? 'Please complete the initial company onboarding form to configure your workspace.'
            : isFailed
            ? (friendlyFailure?.message || 'Something went wrong while initializing your plant modules.')
            : isComplete
            ? 'All manufacturing modules, databases, and operational ledgers are initialized.'
            : 'Initializing production lines, quality benchmarks, and inventory ledgers.'}
        </p>
      </div>

      {/* Case 1: No Workspace Created Yet */}
      {isPendingNoWorkspace ? (
        <div className="space-y-4 select-none">
          <div className="p-4 bg-slate-50 border border-[#E3E8EC] rounded-xl flex items-start gap-3 text-xs text-[#5B6B75]">
            <Building2 className="w-4 h-4 text-[#05303B] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#05303B] block mb-0.5">Start with company details</span>
              <span>Enter your company name, employee count, and station profile to generate your workspace.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/onboarding', { replace: true })}
            className="auth-button-primary"
          >
            <span>Go to Company Onboarding</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Flat 4px Progress Bar (brand teal on #E3E8EC) */}
          {!isFailed && (
            <div className="space-y-1.5 select-none">
              <div className="w-full bg-[#E3E8EC] rounded-full h-1 overflow-hidden">
                <div
                  className="bg-[#12A89A] h-full transition-all duration-300"
                  style={{ width: `${calculatedProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[12px] text-[#5B6B75]">
                <span>{completedCount} of {steps.length || 8} stages finished</span>
                <span className="font-mono font-medium text-[#05303B]">{calculatedProgress}%</span>
              </div>
            </div>
          )}

          {/* Real, honest progress list of stages */}
          {steps.length > 0 && (
            <div className="space-y-2 select-none" role="list" aria-label="Workspace setup stages">
              <span className="auth-label">Setup Stages</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {steps.map((st, idx) => {
                  const isDone = st.status === 'Completed'
                  const isRunning = st.status === 'Running'
                  const hasFailed = st.status === 'Failed'

                  return (
                    <div
                      key={st.key || idx}
                      role="listitem"
                      className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        isDone
                          ? 'bg-slate-50/60 border-[#E3E8EC]'
                          : isRunning
                          ? 'bg-[#12A89A]/5 border-[#12A89A]/30'
                          : hasFailed
                          ? 'bg-red-50/60 border-red-200'
                          : 'bg-white border-[#E3E8EC]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {isDone ? (
                          <div className="w-4 h-4 rounded-full bg-[#12A89A] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : isRunning ? (
                          <Loader2 className="w-4 h-4 text-[#12A89A] animate-spin shrink-0" />
                        ) : hasFailed ? (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#CBD5DB] shrink-0" />
                        )}

                        <span
                          className={`truncate text-[13px] ${
                            isDone
                              ? 'text-[#05303B] font-medium'
                              : isRunning
                              ? 'text-[#05303B] font-semibold'
                              : hasFailed
                              ? 'text-red-900 font-semibold'
                              : 'text-[#5B6B75]'
                          }`}
                        >
                          {st.name}
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-medium ${
                          isDone
                            ? 'text-[#0B7A70]'
                            : isRunning
                            ? 'text-[#05303B] font-semibold'
                            : hasFailed
                            ? 'text-red-700'
                            : 'text-[#94A3AD]'
                        }`}
                      >
                        {isDone ? 'Completed' : isRunning ? 'In progress' : hasFailed ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Success State Action */}
          {isComplete && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleFinalRedirect}
                className="auth-button-primary"
              >
                <span>Go to dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Failure State Action & Diagnostics */}
          {isFailed && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="auth-button-primary"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Retrying setup...' : 'Try again'}</span>
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleDownloadLog}
                  className="auth-button-text"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download diagnostic log</span>
                </button>

                <a
                  href="mailto:support@aquzio.com?subject=Workspace Setup Issue"
                  className="auth-link text-xs"
                >
                  Contact support
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Sign Out */}
      <div className="pt-4 border-t border-[#E8EDF0] mt-6 text-center select-none">
        <button
          type="button"
          onClick={handleLogout}
          className="auth-button-text mx-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </motion.div>
  )
}

export default ProvisioningPage
