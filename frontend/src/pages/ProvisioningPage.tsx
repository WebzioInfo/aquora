import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HubConnectionBuilder, HubConnection, HubConnectionState } from '@microsoft/signalr'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { authService } from '../services/auth'
import { api } from '../services/api'
import { CheckCircle, AlertCircle, RefreshCw, HelpCircle, Loader2 } from 'lucide-react'

interface ProvisioningState {
  progress: number
  step: string
  message: string
  status: 'Pending' | 'Provisioning' | 'Completed' | 'Failed'
  failureReason: string
}

const ProvisioningPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, token, updateUser, clearAuth } = useAuthStore()
  const { showToast } = useNotificationStore()

  const [state, setState] = useState<ProvisioningState>({
    progress: 5,
    step: 'Starting',
    message: 'Getting things ready...',
    status: 'Provisioning',
    failureReason: ''
  })
  const [isRetrying, setIsRetrying] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const connectionRef = useRef<HubConnection | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const completionHandledRef = useRef(false)

  const getEstimatedTime = (progress: number): string => {
    if (progress >= 95) return 'Almost done...'
    if (progress >= 80) return '~10 seconds'
    if (progress >= 60) return '~20 seconds'
    if (progress >= 40) return '~30 seconds'
    if (progress >= 20) return '~45 seconds'
    return '~60 seconds'
  }

  const handleComplete = useCallback(async () => {
    if (completionHandledRef.current || !isMountedRef.current) return
    completionHandledRef.current = true
    setRedirecting(true)

    // Clean up connections
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (connectionRef.current) {
      connectionRef.current.stop()
      connectionRef.current = null
    }

    // Single session call to refresh roles/permissions before redirect
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
      console.error('[ACCOUNT SETUP]: Session refresh failed, redirecting anyway:', err)
    }

    showToast('Your workspace is ready!', 'success')
    setTimeout(() => {
      if (isMountedRef.current) {
        navigate('/company/dashboard', { replace: true })
      }
    }, 800)
  }, [navigate, updateUser, showToast])

  // Lightweight status poll — hits /onboarding/status (2 DB queries) not /auth/session (4+ queries)
  const fetchStatus = useCallback(async () => {
    if (!isMountedRef.current || completionHandledRef.current) return
    try {
      const res = await api.get('/api/v1/onboarding/status')
      const data = res.data?.data
      if (!data || !isMountedRef.current) return

      const status = data.status as ProvisioningState['status']
      setState({
        progress: data.progress ?? 0,
        step: data.step || 'Provisioning',
        message: data.message || 'Setting up...',
        status: status === 'Completed' ? 'Completed' : status,
        failureReason: data.failureReason || ''
      })

      if (status === 'Completed' || data.progress >= 100) {
        handleComplete()
      }
    } catch (err) {
      console.error('[ACCOUNT SETUP]: Status poll failed:', err)
    }
  }, [handleComplete])

  // SignalR + polling setup
  useEffect(() => {
    isMountedRef.current = true
    completionHandledRef.current = false

    // Fetch initial status immediately
    fetchStatus()

    // Smart fallback polling — only when SignalR is not connected
    pollIntervalRef.current = setInterval(() => {
      if (completionHandledRef.current) return
      const conn = connectionRef.current
      if (!conn || conn.state !== HubConnectionState.Connected) {
        fetchStatus()
      }
    }, 5000)

    // SignalR connection
    const hubUrl = `${window.location.protocol}//${window.location.hostname}:5000/hub/provisioning`
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token || '' })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ctx =>
          Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 10000)
      })
      .build()

    connectionRef.current = connection

    connection.on('ProvisionProgressUpdated', (data: any) => {
      if (!isMountedRef.current || completionHandledRef.current) return

      const rawStatus = data.status as string
      const uiStatus = (rawStatus === 'Ready' || rawStatus === 'Completed')
        ? 'Completed'
        : (rawStatus as ProvisioningState['status'])

      setState({
        progress: data.progress,
        step: data.stage,
        message: data.message,
        status: uiStatus,
        failureReason: data.failureReason || ''
      })

      if (rawStatus === 'Ready' || rawStatus === 'Completed' || data.progress >= 100) {
        handleComplete()
      }
    })

    connection.start().catch(err => {
      console.warn('[ACCOUNT SETUP]: SignalR failed to connect, relying on polling:', err)
    })

    return () => {
      isMountedRef.current = false
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (connectionRef.current) connectionRef.current.stop()
    }
  }, [token, fetchStatus, handleComplete])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    completionHandledRef.current = false
    setState({
      progress: 5,
      step: 'Starting',
      message: 'Restarting setup...',
      status: 'Provisioning',
      failureReason: ''
    })

    try {
      const res = await api.post('/api/v1/onboarding/retry')
      if (res.data?.success) {
        showToast('Setup restarted.', 'success')
        fetchStatus()
      } else {
        showToast(res.data?.message || 'Retry failed.', 'error')
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Retry failed.'
      showToast(msg, 'error')
      setState(prev => ({ ...prev, status: 'Failed', failureReason: msg }))
    } finally {
      setIsRetrying(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const isFailed = state.status === 'Failed'
  const isComplete = state.progress >= 100 || redirecting

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans select-none">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 space-y-6">

          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1.5">
            {isComplete ? (
              <>
                <div className="flex justify-center mb-3">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your workspace is ready!</h2>
                <p className="text-sm text-slate-500">Redirecting to your dashboard...</p>
              </>
            ) : isFailed ? (
              <>
                <div className="flex justify-center mb-3">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Setup couldn't be completed</h2>
                <p className="text-sm text-slate-500">We ran into an issue while setting up your workspace.</p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Setting up your workspace</h2>
                <p className="text-sm text-slate-500">{state.message}</p>
              </>
            )}
          </div>

          {/* Progress — only show when not failed */}
          {!isFailed && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isComplete
                      ? 'bg-green-500'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                  style={{ width: `${state.progress}%` }}
                />
              </div>

              {/* Percentage + estimated time */}
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-semibold text-slate-600">{state.progress}%</span>
                {!isComplete && (
                  <span>{getEstimatedTime(state.progress)}</span>
                )}
              </div>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="space-y-4">
              {state.failureReason && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600 font-mono max-h-24 overflow-y-auto break-words">
                  {state.failureReason}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </button>
                <a
                  href="mailto:support@aquora.com?subject=Workspace Setup Issue"
                  className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Support</span>
                </a>
              </div>
            </div>
          )}

          {/* Footer note */}
          {!isFailed && !isComplete && (
            <p className="text-center text-[11px] text-slate-400 leading-relaxed pt-2">
              Your account is already created.<br />
              Please keep this page open.
            </p>
          )}
        </div>

        {/* Sign out link below card */}
        <div className="text-center mt-6">
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  )
}

export default ProvisioningPage
