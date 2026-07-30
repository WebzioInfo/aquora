import React, { useState, useEffect } from 'react'
import { Building, Globe, Mail, Phone, MapPin, DollarSign, Clock, ShieldCheck, X } from 'lucide-react'
import EnterpriseInput from '../ui/EnterpriseInput'
import EnterpriseSelect from '../ui/EnterpriseSelect'
import EnterpriseButton from '../ui/EnterpriseButton'

interface TenantModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  initialData?: any
  isEditing?: boolean
}

export const TenantModal: React.FC<TenantModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false
}) => {
  const [formData, setFormData] = useState({
    companyName: '',
    companyCode: '',
    subdomain: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: '',
    gstNumber: '',
    panNumber: '',
    licenseNumber: '',
    subscriptionPlan: 'Starter',
    status: 'Active',
    timezone: 'UTC',
    currency: 'USD',
    language: 'en',
    theme: 'light',
    logoUrl: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFormData({
        companyName: initialData.name || initialData.companyName || '',
        companyCode: initialData.code || initialData.companyCode || '',
        subdomain: initialData.subdomain || '',
        ownerName: initialData.ownerName || '',
        ownerEmail: initialData.ownerEmail || '',
        ownerPhone: initialData.ownerPhone || '',
        address: initialData.address || '',
        gstNumber: initialData.gstNumber || '',
        panNumber: initialData.panNumber || '',
        licenseNumber: initialData.licenseNumber || '',
        subscriptionPlan: initialData.subscriptionPlan || 'Starter',
        status: initialData.status || (initialData.isActive ? 'Active' : 'Inactive'),
        timezone: initialData.timezone || 'UTC',
        currency: initialData.currency || 'USD',
        language: initialData.language || 'en',
        theme: initialData.theme || 'light',
        logoUrl: initialData.logoUrl || ''
      })
    } else {
      setFormData({
        companyName: '',
        companyCode: '',
        subdomain: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        address: '',
        gstNumber: '',
        panNumber: '',
        licenseNumber: '',
        subscriptionPlan: 'Starter',
        status: 'Active',
        timezone: 'UTC',
        currency: 'USD',
        language: 'en',
        theme: 'light',
        logoUrl: ''
      })
    }
    setError(null)
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleCompanyNameChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      companyName: val,
      subdomain: isEditing ? prev.subdomain : val.toLowerCase().replace(/[^a-z0-9]/g, '-')
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.companyName.trim()) {
      setError('Company Name is required.')
      return
    }
    if (!formData.ownerEmail.trim()) {
      setError('Owner Email is required.')
      return
    }
    if (!formData.subdomain.trim()) {
      setError('Subdomain prefix is required.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSubmit(formData)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Operation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" />

      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Tenant & Company Configuration' : 'Provision New Enterprise Tenant'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Section 1: Company Profile */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" /> Corporate Profile & Subdomain
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EnterpriseInput 
                label="Company Name *" 
                value={formData.companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                placeholder="e.g. Acme Aqua Industries"
                required
              />
              <EnterpriseInput 
                label="Subdomain Prefix *" 
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="acme"
                required
              />
              <EnterpriseInput 
                label="Company Code" 
                value={formData.companyCode}
                onChange={(e) => setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })}
                placeholder="ACME_CORP"
              />
              <EnterpriseInput 
                label="GST / Tax Registration Number" 
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="29ABCDE1234F1ZH"
              />
              <EnterpriseInput 
                label="PAN Identifier" 
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                placeholder="ABCDE1234F"
              />
              <EnterpriseInput 
                label="SaaS License Number" 
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                placeholder="LIC-2026-9910"
              />
            </div>
          </div>

          {/* Section 2: Owner Contact Details */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-600" /> Primary Owner / Super Admin Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <EnterpriseInput 
                label="Owner Full Name *" 
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="John Doe"
                required
              />
              <EnterpriseInput 
                label="Owner Corporate Email *" 
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                placeholder="admin@acme.com"
                required
              />
              <EnterpriseInput 
                label="Owner Phone Number" 
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                placeholder="+1 (555) 019-2834"
              />
            </div>
            <EnterpriseInput 
              label="Headquarters Address" 
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="100 Enterprise Boulevard, Suite 400"
            />
          </div>

          {/* Section 3: Subscription & Localization Settings */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" /> Subscription & Regional Preferences
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <EnterpriseSelect
                label="Subscription Plan Tier"
                value={formData.subscriptionPlan}
                onChange={(val) => setFormData({ ...formData, subscriptionPlan: val })}
                options={[
                  { label: 'Starter Tier ($199/mo)', value: 'Starter' },
                  { label: 'Professional Tier ($499/mo)', value: 'Professional' },
                  { label: 'Enterprise Custom SLA', value: 'Enterprise' }
                ]}
              />
              <EnterpriseSelect
                label="Clearance Status"
                value={formData.status}
                onChange={(val) => setFormData({ ...formData, status: val })}
                options={[
                  { label: 'Active (Provisioned)', value: 'Active' },
                  { label: 'Inactive (Suspended)', value: 'Inactive' }
                ]}
              />
              <EnterpriseSelect
                label="System Timezone"
                value={formData.timezone}
                onChange={(val) => setFormData({ ...formData, timezone: val })}
                options={[
                  { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
                  { label: 'Asia/Kolkata (IST +05:30)', value: 'Asia/Kolkata' },
                  { label: 'America/New_York (EST -05:00)', value: 'America/New_York' },
                  { label: 'Europe/London (GMT +00:00)', value: 'Europe/London' }
                ]}
              />
              <EnterpriseSelect
                label="Default Currency"
                value={formData.currency}
                onChange={(val) => setFormData({ ...formData, currency: val })}
                options={[
                  { label: 'USD ($)', value: 'USD' },
                  { label: 'INR (₹)', value: 'INR' },
                  { label: 'EUR (€)', value: 'EUR' },
                  { label: 'GBP (£)', value: 'GBP' }
                ]}
              />
              <EnterpriseSelect
                label="System UI Theme"
                value={formData.theme}
                onChange={(val) => setFormData({ ...formData, theme: val })}
                options={[
                  { label: 'Light Theme', value: 'light' },
                  { label: 'Dark Mode', value: 'dark' }
                ]}
              />
              <EnterpriseInput 
                label="Logo Image URL" 
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://cdn.aquora.com/logos/acme.png"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <EnterpriseButton type="submit" disabled={loading}>
              {loading ? 'Provisioning...' : isEditing ? 'Save Changes' : 'Provision Database Schema'}
            </EnterpriseButton>
          </div>

        </form>

      </div>
    </div>
  )
}

export default TenantModal
