import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HubConnectionBuilder, HubConnection, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { api, API_BASE_URL } from '../services/api'
import BRAND from '../config/brand'
import AuthWatermark from '../components/ui/AuthWatermark'
import {
  Server, Database, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, LogOut, Wifi, WifiOff,
  Loader2, RefreshCw, Download, ArrowRight, ShieldCheck
} from 'lucide-react'

interface ProvisionStep {
  key: string
  name: string
  status: 'Pending' | 'Running' | 'Completed' | 'Failed'
  errorMessage?: string | null
}

interface ProvisioningStatusResponse {
  tenantId?: string
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

  const [statusState, setStatusState] = useState<ProvisioningStatusResponse>({
    status: 'Provisioning',
    progress: 10,
    currentStep: 'TenantCreated',
    message: 'Initializing multi-step workspace pipeline...',
    steps: [
      { key: 'TenantCreated', name: 'Create Tenant Workspace Entry', status: 'Completed' },
      { key: 'DatabaseCreated', name: 'Create Multi-Tenant Database Schema', status: 'Running' },
      { key: 'SchemaMigrationsRun', name: 'Run Core System Migrations', status: 'Pending' },
      { key: 'SystemDataSeeded', name: 'Seed Master System Data', status: 'Pending' },
      { key: 'DefaultRolesCreated', name: 'Create Default Roles & Permissions', status: 'Pending' },
      { key: 'AdministratorUserInitialized', name: 'Initialize Company Admin Account', status: 'Pending' },
      { key: 'ManufacturingModulesInitialized', name: 'Configure Bottling & Production Lines', status: 'Pending' },
      { key: 'TenantSettingsSaved', name: 'Configure Regional & Industrial Settings', status: 'Pending' },
      { key: 'ProvisioningCompleted', name: 'Finalize Workspace Initialization', status: 'Pending' },
    ],
    estimatedRemainingSeconds: 16
  })

  const [connectionMode, setConnectionMode] = useState<'SignalR' | 'Polling' | 'Reconnecting'>('Polling')
  const [reconnectAttempt, setReconnectAttempt] = useState(1)
  const [isRetrying, setIsRetrying] = useState(false)

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
    if (connectionRef.current) {
      connectionRef.current.stop()
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

  // HTTP Polling Fallback (Hits /api/v1/onboarding/status)
  const fetchTelemetryStatus = useCallback(async () => {
    if (!isMountedRef.current || completionHandledRef.current) return
    try {
      const res = await api.get('/api/v1/onboarding/status')
      const data: ProvisioningStatusResponse = res.data?.data
      if (!data || !isMountedRef.current) return

      setStatusState(prev => ({
        ...prev,
        ...data,
        steps: data.steps && data.steps.length > 0 ? data.steps : prev.steps
      }))

      if (data.status === 'Completed' || data.progress >= 100) {
        handleFinalRedirect()
      }
    } catch (err) {
      console.warn('[PROVISIONING POLLING]: Telemetry fetch failed:', err)
    }
  }, [handleFinalRedirect])

  // SignalR Hub Connection Setup
  useEffect(() => {
    isMountedRef.current = true

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
        const nextProgress = payload.progress ?? prev.progress
        const nextMessage = payload.message || prev.message
        return {
          ...prev,
          status: newStatus,
          progress: nextProgress,
          currentStep: payload.stage || prev.currentStep,
          message: nextMessage,
          failureReason: payload.failureReason || prev.failureReason
        }
      })

      if (newStatus === 'Completed' || payload.progress >= 100) {
        handleFinalRedirect()
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
      setConnectionMode('Reconnecting')
      setReconnectAttempt(prev => prev + 1)
    })

    connection.onreconnected(() => {
      setConnectionMode('SignalR')
      setReconnectAttempt(1)
      fetchTelemetryStatus()
    })

    connection.onclose(() => {
      setConnectionMode('Polling')
    })

    connection.start()
      .then(() => {
        setConnectionMode('SignalR')
        fetchTelemetryStatus()
      })
      .catch((err) => {
        console.warn('[SIGNALR CONNECT FAILED]: Falling back to HTTP polling:', err)
        setConnectionMode('Polling')
        fetchTelemetryStatus()
      })

    // Start background fallback polling (every 3 seconds)
    pollIntervalRef.current = setInterval(fetchTelemetryStatus, 3000)

    return () => {
      isMountedRef.current = false
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (connectionRef.current) connectionRef.current.stop()
    }
  }, [token, fetchTelemetryStatus, handleFinalRedirect])

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
  const steps = statusState.steps || []
  const completedCount = steps.filter(s => s.status === 'Completed').length
  const calculatedProgress = isComplete ? 100 : Math.round((completedCount / (steps.length || 1)) * 100)

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
              {isFailed ? 'Setup Failed' : (isComplete ? 'Workspace Ready' : 'Creating Workspace')}
            </h2>
            <p className="text-xs font-medium text-[#6B7280]">
              {isFailed ? 'An error occurred during workspace provisioning' : (isComplete ? 'All manufacturing modules initialized' : statusState.message)}
            </p>
          </div>
        </div>

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
              <span>{completedCount} of {steps.length} steps finished</span>
              {!isComplete && (
                <span>~{statusState.estimatedRemainingSeconds || Math.max(3, (steps.length - completedCount) * 2)}s remaining</span>
              )}
            </div>
          </div>
        )}

        {/* Pipeline Step-by-Step Checklist */}
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
