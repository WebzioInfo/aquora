import React, { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { ShieldAlert, Key, Eye, EyeOff, Copy, RefreshCw, Save } from 'lucide-react'

export const SecuritySettings: React.FC = () => {
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(true)
  const [savingSecret, setSavingSecret] = useState(false)
  const [regeneratingApi, setRegeneratingApi] = useState(false)

  // Security keys state
  const [secretKey, setSecretKey] = useState('')
  const [confirmSecret, setConfirmSecret] = useState('')
  const [hasSecretKey, setHasSecretKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  
  const [revealSecret, setRevealSecret] = useState(false)
  const [revealApiKey, setRevealApiKey] = useState(false)

  const fetchSecurityConfig = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/company/security')
      if (res.data?.success && res.data?.data) {
        setHasSecretKey(res.data.data.hasSecretKey)
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

  const handleGenerateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-='
    let generated = ''
    const array = new Uint32Array(64)
    window.crypto.getRandomValues(array)
    for (let i = 0; i < array.length; i++) {
      generated += chars[array[i] % chars.length]
    }
    setSecretKey(generated)
    setConfirmSecret(generated)
    setRevealSecret(true)
    showToast('Secure secret generated. Verify details and save.', 'info')
  }

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secretKey) {
      showToast('Please enter a secret key.', 'error')
      return
    }
    if (secretKey.length < 64) {
      showToast('Secret key must be at least 64 characters long.', 'error')
      return
    }
    if (secretKey !== confirmSecret) {
      showToast('Secrets do not match.', 'error')
      return
    }

    try {
      setSavingSecret(true)
      const res = await api.put('/api/v1/company/security', {
        secretKey,
        confirmSecret
      })
      if (res.data?.success) {
        showToast('Company Secret Key saved securely.', 'success')
        setSecretKey('')
        setConfirmSecret('')
        setRevealSecret(false)
        fetchSecurityConfig()
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save secret key.', 'error')
    } finally {
      setSavingSecret(false)
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
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* COMPANY SECRET CONFIGURATION */}
      <form onSubmit={handleSaveSecret} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Company Secret</h3>
            <p className="text-xs text-slate-500 mt-1">Configure the main administrative key for authorized ERP operations.</p>
          </div>
          {hasSecretKey && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              Configured
            </span>
          )}
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Secret Key</label>
              <div className="relative">
                <input
                  type={revealSecret ? 'text' : 'password'}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 pr-20 border font-mono"
                  placeholder="At least 64 characters"
                />
                <div className="absolute right-2 top-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRevealSecret(!revealSecret)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    {revealSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    disabled={!secretKey}
                    onClick={() => handleCopy(secretKey, 'Secret Key')}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Secret</label>
              <input
                type={revealSecret ? 'text' : 'password'}
                value={confirmSecret}
                onChange={(e) => setConfirmSecret(e.target.value)}
                className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border font-mono"
                placeholder="Re-enter secret key"
              />
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Strict Requirements & Protection</h4>
              <p className="leading-relaxed">
                The Company Secret is used for secure back-channel operations (e.g. resetting employee passwords safely). 
                It is stored in the database as a non-reversible cryptographic hash. Generating a key must satisfy a minimum length of 64 characters.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between">
          <button
            type="button"
            onClick={handleGenerateSecret}
            className="border border-slate-200 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Key className="w-4 h-4 text-slate-500" />
            Generate Secure Secret
          </button>
          
          <button
            type="submit"
            disabled={savingSecret}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
          >
            {savingSecret && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <Save className="w-4 h-4" />
            Save Secret
          </button>
        </div>
      </form>

      {/* API KEY CONFIGURATION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-800">API Key</h3>
          <p className="text-xs text-slate-500 mt-1">Credentials for integrating Aquora ERP with third-party software.</p>
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
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
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
