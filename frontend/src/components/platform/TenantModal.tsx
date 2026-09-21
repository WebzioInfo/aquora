import React, { useState, useEffect } from 'react'
import { Building, Globe, Mail, Phone, MapPin, X } from 'lucide-react'

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
    isBiodropsProduction: false
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
        isBiodropsProduction: initialData.isBiodropsProduction ?? false
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
        isBiodropsProduction: false
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
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity" />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit Tenant Configuration' : 'Provision New Enterprise Tenant'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
              {error}
            </div>
          )}

          {/* Section 1: Tenant Identity */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tenant Identity</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subdomain Prefix *</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                    placeholder="acme"
                    className="w-full px-3 py-2 border border-slate-200 rounded-l-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                  />
                  <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-slate-500 font-mono text-[11px]">
                    .aquora.com
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Owner Contact Details */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner Contact Details</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Owner Name</label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Owner Email *</label>
                <input
                  type="email"
                  required
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  placeholder="owner@acme.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.ownerPhone}
                  onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status Configuration */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status & Configuration</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subscription Plan</label>
                <select
                  value={formData.subscriptionPlan}
                  onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                >
                  <option value="Starter">Starter Tier</option>
                  <option value="Professional">Professional Tier</option>
                  <option value="Enterprise">Enterprise Tier</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isBiodropsProduction}
                  onChange={(e) => setFormData({ ...formData, isBiodropsProduction: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">BioDrops Production Manufacturer</span>
                  <span className="text-slate-500 text-[11px] block">Expose this manufacturer to external consumers on the BioDrops Know Your Water platform API.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Provision Tenant'}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}

export default TenantModal
