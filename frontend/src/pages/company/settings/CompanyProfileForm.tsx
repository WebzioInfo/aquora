import React, { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { Building2, Mail, Phone, MapPin, Globe2, Calendar, ShieldCheck, Database, Layers } from 'lucide-react'

export const CompanyProfileForm: React.FC = () => {
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  // Editable fields state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [language, setLanguage] = useState('en')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [logoUrl, setLogoUrl] = useState('')

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/company/settings')
      if (res.data?.success && res.data?.data) {
        const data = res.data.data
        setProfile(data)
        setName(data.name || '')
        setDisplayName(data.displayName || '')
        setEmail(data.email || '')
        setPhone(data.phone || '')
        setGstNumber(data.gstNumber || '')
        setAddress(data.address || '')
        setTimezone(data.timezone || 'UTC')
        setLanguage(data.language || 'en')
        setDateFormat(data.dateFormat || 'YYYY-MM-DD')
        setLogoUrl(data.logoUrl || '')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load company profile.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await api.put('/api/v1/company/settings', {
        name,
        displayName,
        email,
        phone,
        gstNumber,
        address,
        timezone,
        language,
        dateFormat,
        logoUrl
      })
      if (res.data?.success) {
        showToast('Company profile updated successfully.', 'success')
        fetchProfile()
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT COLUMN: COMPANY PROFILE CARD */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
          <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50">
            <div className="relative w-24 h-24 mx-auto mb-4 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-12 h-12 text-slate-400" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-800">{displayName || name || 'Aquora Company'}</h3>
            <p className="text-xs text-slate-500 font-mono mt-1">Code: {profile?.tenantCode || 'N/A'}</p>
          </div>
          
          <div className="p-4 space-y-3.5 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] text-slate-400 font-medium">EMAIL</span>
                <span className="block truncate font-medium text-slate-700">{email || 'Not configured'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium">PHONE</span>
                <span className="block font-medium text-slate-700">{phone || 'Not configured'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium">TENANT ID</span>
                <span className="block font-mono text-slate-700 select-all">{profile?.tenantId || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium">SCHEMA NAME</span>
                <span className="block font-mono text-slate-700">{profile?.schemaName || 'public'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium">SUBSCRIPTION</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  {profile?.subscriptionPlan || 'Starter'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium">CREATED DATE</span>
                <span className="block font-medium text-slate-700">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: EDITABLE PROFILE FORM */}
      <div className="lg:col-span-2">
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-800">Edit Company Profile</h3>
            <p className="text-xs text-slate-500 mt-1">Configure identity and business metadata for your workspace.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                  placeholder="e.g. Aquora Industries Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                  placeholder="e.g. Aquora"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                  placeholder="GST Number (optional)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                  placeholder="e.g. info@aquora.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                  placeholder="e.g. +1 555-123-4567"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border resize-none"
                placeholder="Full corporate headquarters address..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Time Zone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                >
                  <option value="UTC">UTC</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">EST / EDT</option>
                  <option value="Europe/London">GMT / BST</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date Format</label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg p-2.5 border"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Currency (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={profile?.currency || 'USD'}
                  className="w-full text-sm bg-slate-50 border-slate-200 text-slate-400 rounded-lg p-2.5 border cursor-not-allowed"
                />
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
