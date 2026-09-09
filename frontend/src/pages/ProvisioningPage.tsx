import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HubConnectionBuilder, HubConnection, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { api, API_BASE_URL } from '../services/api'
import BRAND from '../config/brand'
import {
  CheckCircle2, AlertCircle, HelpCircle, LogOut, Wifi, WifiOff,
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
  estimatedRemainingSeconds?: number
}

export const ProvisioningPage: React.FC = () => {
  const navigate = useNavigate()
  const { token, updateUser, clearAuth } = useAuthStore()
  const { showToast } = useNotificationStore()

  // Authentic Initial State: Clean, truthful, no fake optimistic running steps
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
        if (prev.status === 'Completed' && data.status !== 'Completed') return prev
        return {
          tenantId: data.tenantId,
          status: data.status,
          progress: data.progress ?? 0,
          currentStep: data.currentStep ?? '',
          message: data.message || 'Provisioning workspace...',
          failureReason: data.status === 'Failed' ? (data.failureReason || null) : null,
          steps: Array.isArray(data.steps) ? data.steps : [],
          estimatedRemainingSeconds: data.estimatedRemainingSeconds
        }
      })

      if (data.status === 'Completed' || data.progress >= 100) {
        handleFinalRedirectRef.current()
      }
    } catch (err) {
      console.warn('[PROVISIONING POLLING]: Telemetry fetch failed:', err)
    }
  }, [])

  const fetchTelemetryStatusRef = useRef(fetchTelemetryStatus)
  useEffect(() => {
    fetchTelemetryStatusRef.current = fetchTelemetryStatus
  }, [fetchTelemetryStatus])

  // SignalR Hub Connection Setup
  useEffect(() => {
    isMountedRef.current = true

    // Initial telemetry check
    fetchTelemetryStatusRef.current()

    const hubUrl = `${API_BASE_URL}/hub/provisioning`
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000])
      .configureLogging(LogLevel.Warning)
      .build()

    connectionRef.current = connection

    const updateSignalRState = (payload: any) => {
      if (!isMountedRef.current) return

      const newStatus = payload.status || (payload.progress >= 100 ? 'Completed' : 'Provisioning')
      setStatusState(prev => {
        if (prev.status === 'Completed' && newStatus !== 'Completed') return prev
        const nextProgress = payload.progress !== undefined && payload.progress !== null ? Math.max(prev.progress, payload.progress) : prev.progress
        const nextMessage = payload.message || prev.message
        return {
          ...prev,
          status: newStatus,
          progress: nextProgress,
          currentStep: payload.stage || prev.currentStep,
          message: nextMessage,
          failureReason: newStatus === 'Failed' ? (payload.failureReason || prev.failureReason) : null
        }
      })

      if (newStatus === 'Completed' || payload.progress >= 100) {
        handleFinalRedirectRef.current()
      } else {
        // Fetch full updated step list from telemetry endpoint
        fetchTelemetryStatusRef.current()
      }
    }

    connection.on('ProvisionProgressUpdated', updateSignalRState)
    connection.on('ProvisionStepCompleted', updateSignalRState)
    connection.on('ProvisionFinished', updateSignalRState)
    connection.on('ProvisionFailed', (payload) => {
      if (!isMountedRef.current) return
      setStatusState(prev => ({
        ...prev,
        status: 'Failed',
        failureReason: payload.failureReason || payload.message || 'Provisioning pipeline failed.'
      }))
    })

    connection.onreconnecting((error) => {
      console.warn('[SIGNALR RECONNECTING]:', error)
      if (isMountedRef.current) {
        setConnectionMode('Reconnecting')
        setReconnectAttempt(prev => prev + 1)
      }
    })

    connection.onreconnected(() => {
      if (isMountedRef.current) {
        setConnectionMode('SignalR')
        setReconnectAttempt(1)
        fetchTelemetryStatusRef.current()
      }
    })

    connection.onclose(() => {
      if (isMountedRef.current) {
        setConnectionMode('Polling')
      }
    })

    // Start connection safely if disconnected
    if (connection.state === HubConnectionState.Disconnected) {
      connection.start()
        .then(() => {
          if (isMountedRef.current) {
            setConnectionMode('SignalR')
            fetchTelemetryStatusRef.current()
          }
        })
        .catch((err) => {
          console.warn('[SIGNALR CONNECT FAILED]: Falling back to HTTP polling:', err)
          if (isMountedRef.current) {
            setConnectionMode('Polling')
            fetchTelemetryStatusRef.current()
          }
        })
    }

    // Background fallback polling every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchTelemetryStatusRef.current()
    }, 3000)

    return () => {
      isMountedRef.current = false
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (connectionRef.current) {
        const conn = connectionRef.current
        connectionRef.current = null
        if (conn.state === HubConnectionState.Connected) {
          conn.stop().catch(() => {})
        }
      }
    }
  }, [token])

  // Handle Retry
  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      const response = await api.post('/api/v1/onboarding/retry')
      if (response.data?.success) {
        showToast('Restarted workspace provisioning pipeline.', 'info')
        setStatusState(prev => ({ ...prev, status: 'Provisioning', failureReason: null }))
        fetchTelemetryStatus()
      } else {
        showToast('Retry request failed.', 'error')
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Retry request failed.', 'error')
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle Log Out
  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  // Download Diagnostic Log
  const handleDownloadLog = () => {
    const logContent = `AQUZIO ERP PROVISIONING DIAGNOSTIC LOG
Timestamp: ${new Date().toISOString()}
Status: ${statusState.status}
Progress: ${statusState.progress}%
Current Step: ${statusState.currentStep}
Failure Reason: ${statusState.failureReason || 'N/A'}
Pipeline Steps:
${(statusState.steps || []).map(s => `- [${s.status}] ${s.name} (${s.key})`).join('\n')}`

    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aquora_provisioning_log_${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const isFailed = statusState.status === 'Failed'
  const isComplete = statusState.status === 'Completed' || statusState.progress >= 100
  const isPendingNoWorkspace = noWorkspaceFound || (statusState.status === 'Pending' && (statusState.steps || []).length === 0)
  const steps = statusState.steps || []
  const completedCount = steps.filter(s => s.status === 'Completed').length
  const calculatedProgress = isComplete ? 100 : (steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : statusState.progress)

  return (
    <div className="w-full flex justify-center items-center font-sans">

      {/* FRESH WHITE SURFACE CARD */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[480px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xs p-8 sm:p-9 space-y-5 relative z-10"
      >

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 select-none">
          <img src={BRAND.logo} alt={BRAND.name} className="h-14 w-auto object-contain mb-1" />
          <div>
            <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
              {isPendingNoWorkspace
                ? 'No Workspace Found'
                : isFailed
                  ? 'Setup Failed'
                  : isComplete
                    ? 'Workspace Ready'
                    : 'Creating Workspace'}
            </h2>
            <p className="text-xs font-medium text-[#6B7280]">
              {isPendingNoWorkspace
                ? 'You have not initialized a company workspace yet.'
                : isFailed
                  ? 'An error occurred during workspace provisioning'
                  : isComplete
                    ? 'All manufacturing modules initialized'
                    : statusState.message}
            </p>
          </div>
        </div>

        {/* Pending / No Workspace Callout */}
        {isPendingNoWorkspace ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed text-left flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950 mb-1">Company Setup Required</p>
                <p className="text-blue-800">
                  Please complete the initial company onboarding form to specify your company details and manufacturing stations.
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate('/onboarding', { replace: true })}
              className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Company Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        ) : (
          <>
            {/* Real-time Connection Badge */}
            <div className="flex items-center justify-between p-2.5 bg-[#FAFBFC] border border-[#E5E7EB] rounded-xl text-xs select-none">
              <span className="text-[#6B7280] font-medium flex items-center gap-1.5">
                {connectionMode === 'SignalR' ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                ) : connectionMode === 'Reconnecting' ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>
                  {connectionMode === 'SignalR' && 'Real-Time Pipeline (SignalR)'}
                  {connectionMode === 'Reconnecting' && `Reconnecting... Attempt ${reconnectAttempt} of 5`}
                  {connectionMode === 'Polling' && 'HTTP Telemetry Stream (Active)'}
                </span>
              </span>
              <span className="font-bold text-[#111827] font-mono">{calculatedProgress}%</span>
            </div>

            {/* Dynamic Progress Bar */}
            {!isFailed && (
              <div className="space-y-1.5 select-none">
                <div className="w-full bg-[#E5E7EB] rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${calculatedProgress}%` }}
                    transition={{ duration: 0.4 }}
                    className={`h-full rounded-full ${isComplete ? 'bg-emerald-600' : 'bg-[#2563EB]'}`}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#6B7280]">
                  <span>{completedCount} of {steps.length || 9} steps finished</span>
                  {!isComplete && (
                    <span>~{statusState.estimatedRemainingSeconds || Math.max(3, ((steps.length || 9) - completedCount) * 2)}s remaining</span>
                  )}
                </div>
              </div>
            )}

            {/* Pipeline Step-by-Step Checklist */}
            {steps.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-[#111827] block select-none">
                  Provisioning Pipeline Steps
                </span>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {steps.map((st, idx) => {
                    const isStepDone = st.status === 'Completed'
                    const isStepRunning = st.status === 'Running'
                    const isStepFailed = st.status === 'Failed'

                    return (
                      <div
                        key={st.key || idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${isStepDone ? 'bg-emerald-50/40 border-emerald-200/60' :
                          isStepRunning ? 'bg-blue-50/50 border-blue-200' :
                            isStepFailed ? 'bg-rose-50 border-rose-200' :
                              'bg-[#FAFBFC] border-[#E5E7EB]'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {isStepDone && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {isStepRunning && <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin shrink-0" />}
                          {isStepFailed && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                          {!isStepDone && !isStepRunning && !isStepFailed && (
                            <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                          )}
                          <span className={`truncate font-medium ${isStepDone ? 'text-emerald-950 font-semibold' :
                            isStepRunning ? 'text-[#2563EB] font-bold' :
                              isStepFailed ? 'text-rose-950 font-bold' :
                                'text-[#6B7280]'
                            }`}>
                            {st.name}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isStepDone ? 'bg-emerald-100 text-emerald-800' :
                          isStepRunning ? 'bg-blue-100 text-blue-800' :
                            isStepFailed ? 'bg-rose-100 text-rose-800' :
                              'bg-slate-100 text-slate-500'
                          }`}>
                          {st.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Failed Diagnostics Box */}
            {isFailed && (
              <div className="space-y-3 pt-2">
                {statusState.failureReason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-mono leading-relaxed max-h-24 overflow-y-auto">
                    <strong className="block font-bold mb-0.5">Failure Reason:</strong>
                    {statusState.failureReason}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>Retry Workspace Provisioning</span>
                  </motion.button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadLog}
                      className="flex-1 h-10 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#111827] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Download Logs</span>
                    </button>

                    <a
                      href="mailto:webzio.info@gmail.com?subject=Workspace Provisioning Issue"
                      className="flex-1 h-10 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#111827] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span>Contact Support</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Sign Out Option */}
        <div className="pt-2 border-t border-[#E5E7EB] text-center select-none">
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-[#6B7280] hover:text-[#2563EB] transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </motion.div>

    </div>
  )
}

export default ProvisioningPage
