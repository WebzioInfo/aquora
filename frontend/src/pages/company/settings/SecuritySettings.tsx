import React, { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { ShieldCheck, Eye, EyeOff, Copy, RefreshCw, Save, Lock } from 'lucide-react'

export const SecuritySettings: React.FC = () => {
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(true)
  const [savingPin, setSavingPin] = useState(false)
  const [regeneratingApi, setRegeneratingApi] = useState(false)

  // Security PIN state
  const [adminPin, setAdminPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isPinSet, setIsPinSet] = useState(false)
  const [apiKey, setApiKey] = useState('')
  
  const [revealPin, setRevealPin] = useState(false)
  const [revealApiKey, setRevealApiKey] = useState(false)

  const fetchSecurityConfig = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/company/security')
      if (res.data?.success && res.data?.data) {
        setIsPinSet(!!(res.data.data.isPinSet || res.data.data.hasAdminPin || res.data.data.hasSecretKey))
        setApiKey(res.data.data.apiKey || '')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load security settings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityConfig()
  }, [])

  const handlePinChange = (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const numeric = val.replace(/\D/g, '').slice(0, 4)
    setter(numeric)
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminPin || adminPin.length !== 4) {
      showToast('PIN must be exactly 4 digits.', 'error')
      return
    }
    if (adminPin !== confirmPin) {
      showToast('PINs do not match.', 'error')
      return
    }

    try {
      setSavingPin(true)
      const res = await api.put('/api/v1/company/security/admin-pin', {
        adminPin: adminPin,
        confirmAdminPin: confirmPin,
        pin: adminPin,
        confirmPin: confirmPin
      })
      if (res.data?.success) {
        showToast('Admin Security PIN saved successfully.', 'success')
        setAdminPin('')
        setConfirmPin('')
        setRevealPin(false)
        fetchSecurityConfig()
      } else {
        showToast(res.data?.message || 'Failed to save Admin PIN.', 'error')
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save Admin PIN.'
      showToast(msg, 'error')
    } finally {
      setSavingPin(false)
    }
  }

  const handleRegenerateApiKey = async () => {
    if (!window.confirm('Are you sure you want to regenerate the API Key? Any external systems using the current key will lose access immediately.')) {
      return
    }

    try {
      setRegeneratingApi(true)
      const res = await api.post('/api/v1/company/security/regenerate-api-key')
      if (res.data?.success && res.data?.data) {
        setApiKey(res.data.data.apiKey)
        showToast('API Key regenerated successfully. Click Copy to save it.', 'success')
        setRevealApiKey(true)
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to regenerate API Key.', 'error')
    } finally {
      setRegeneratingApi(false)
    }
  }

  const handleCopy = (text: string, type: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showToast(`${type} copied to clipboard.`, 'success')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ADMIN SECURITY PIN CONFIGURATION */}
      <form onSubmit={handleSavePin} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600" /> Admin Security PIN
            </h3>
            <p className="text-xs text-slate-500 mt-1">Set a 4-digit PIN required for sensitive administrator operations.</p>
          </div>
          {isPinSet ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Configured
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Not Set
            </span>
          )}
        </div>
        
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin PIN</label>
              <div className="relative">
                <input
                  type={revealPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => handlePinChange(e.target.value, setAdminPin)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 pr-10 border font-mono tracking-widest text-center"
                  placeholder="• • • •"
                />
                <button
                  type="button"
                  onClick={() => setRevealPin(!revealPin)}
                  className="absolute right-2 top-2.5 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {revealPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm PIN</label>
              <input
                type={revealPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border font-mono tracking-widest text-center"
                placeholder="• • • •"
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-900 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Sensitive Access</h4>
              <p className="leading-relaxed opacity-90">
                This PIN is required before viewing sensitive user credentials or performing protected administrator operations.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="submit"
            disabled={savingPin || adminPin.length !== 4 || confirmPin.length !== 4}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm active:scale-95"
          >
            {savingPin ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save PIN</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* API KEY CONFIGURATION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-800">API Key</h3>
          <p className="text-xs text-slate-500 mt-1">Credentials for integrating Aquzio ERP with third-party software.</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Active API Key</label>
            <div className="relative">
              <input
                type={revealApiKey ? 'text' : 'password'}
                readOnly
                value={apiKey || 'No API Key Generated'}
                className="w-full text-sm bg-slate-50 border-slate-200 text-slate-600 rounded-lg p-2.5 pr-20 border font-mono select-all"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!apiKey}
                  onClick={() => setRevealApiKey(!revealApiKey)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40"
                >
                  {revealApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  disabled={!apiKey}
                  onClick={() => handleCopy(apiKey, 'API Key')}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            disabled={regeneratingApi}
            onClick={handleRegenerateApiKey}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
          >
            {regeneratingApi ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Regenerate API Key
          </button>
        </div>
      </div>
    </div>
  )
}
