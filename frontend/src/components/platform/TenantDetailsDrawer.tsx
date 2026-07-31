import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Building, Clock, ShieldCheck, Mail, Phone, Calendar, CreditCard, AlertTriangle, Check, Layers, Zap, HardDrive, Users } from 'lucide-react'
import EnterpriseBadge from '../ui/EnterpriseBadge'
import { api } from '../../services/api'

interface TenantDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  tenant: any
}

export const TenantDetailsDrawer: React.FC<TenantDetailsDrawerProps> = ({
  isOpen,
  onClose,
  tenant: initialTenant
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'audit'>('details')

  // Fetch full details (including single-request subscription join) on open
  const tenantId = initialTenant?.id
  const { data: fullTenantData, isLoading } = useQuery({
    queryKey: ['tenantDetails', tenantId],
    queryFn: async () => {
      if (!tenantId) return null
      const res = await api.get(`/api/v1/platform/tenants/${tenantId}`)
      return res.data?.data || null
    },
    enabled: isOpen && !!tenantId,
    staleTime: 0 // Always fetch fresh database data
  })

  if (!isOpen || !initialTenant) return null

  const tenant = fullTenantData || initialTenant
  const subscription = tenant.subscription

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Soft Light Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Light Header */}
          <div className="px-6 py-5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                {tenant.name ? tenant.name.charAt(0).toUpperCase() : 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 leading-snug">{tenant.name || 'Unnamed Tenant'}</h2>
                  <EnterpriseBadge variant={tenant.isActive ? 'success' : 'danger'}>
                    {tenant.status || (tenant.isActive ? 'Active' : 'Inactive')}
                  </EnterpriseBadge>
                </div>
                <p className="text-xs text-slate-500 font-mono">ID: {tenant.id}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'details' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4" /> Tenant Specification
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'audit' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" /> Audit Activity
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

            {activeTab === 'details' && (
              <div className="space-y-5">

                {/* Primary Meta Grid */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Company Information
                  </h3>

                  <div className="divide-y divide-slate-100 text-xs">
                    {tenant.name && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Company Name</span>
                        <span className="font-bold text-slate-900">{tenant.name}</span>
                      </div>
                    )}

                    {tenant.id && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Tenant ID</span>
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{tenant.id}</span>
                      </div>
                    )}

                    {tenant.schemaName && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Database Schema</span>
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {tenant.schemaName}
                        </span>
                      </div>
                    )}

                    {tenant.subdomain && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Subdomain</span>
                        <span className="font-mono text-slate-800">{tenant.subdomain}.aquora.com</span>
                      </div>
                    )}

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Status</span>
                      <EnterpriseBadge variant={tenant.isActive ? 'success' : 'danger'}>
                        {tenant.status || (tenant.isActive ? 'Active' : 'Inactive')}
                      </EnterpriseBadge>
                    </div>

                    {tenant.ownerEmail && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Owner Email</span>
                        <span className="font-medium text-blue-600 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {tenant.ownerEmail}
                        </span>
                      </div>
                    )}

                    {tenant.ownerPhone && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Owner Phone</span>
                        <span className="text-slate-700 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {tenant.ownerPhone}
                        </span>
                      </div>
                    )}

                    {tenant.createdAt && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Provisioned At</span>
                        <span className="text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(tenant.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SUBSCRIPTION INFORMATION CARD */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Subscription Information
                    </h3>

                    {subscription && (
                      <EnterpriseBadge 
                        variant={
                          subscription.status === 'Active' ? 'success' : 
                          subscription.status === 'Trial' ? 'info' : 
                          subscription.status === 'Expired' ? 'danger' : 'warning'
                        }
                      >
                        {subscription.status}
                      </EnterpriseBadge>
                    )}
                  </div>

                  {!subscription ? (
                    /* EMPTY STATE */
                    <div className="bg-slate-50/80 border border-dashed border-slate-200 rounded-xl p-5 text-center my-2">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <span className="text-xs font-bold text-slate-800 block">No Subscription Assigned</span>
                      <p className="text-[11px] text-slate-500 mt-1">This tenant company does not have an active subscription plan assigned.</p>
                    </div>
                  ) : (
                    /* DYNAMIC SUBSCRIPTION DETAILS */
                    <div className="space-y-4">
                      {/* Expiry / Warning Banners */}
                      {subscription.isExpired ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>Subscription Expired {subscription.daysExpired} days ago</span>
                        </div>
                      ) : subscription.isExpiringSoon ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Subscription Expires in {subscription.daysUntilExpiry} days</span>
                        </div>
                      ) : null}

                      {/* Details Key-Value List */}
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Current Plan</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subscription.planColor }} />
                            <span className="font-extrabold text-slate-900">{subscription.planName}</span>
                            <span className="font-mono text-[10px] text-slate-400">({subscription.planCode})</span>
                          </div>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Billing Cycle</span>
                          <span className="font-semibold text-slate-800">{subscription.billingCycle}</span>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Plan Status</span>
                          <span className="font-bold text-slate-900">{subscription.status}</span>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Start Date</span>
                          <span className="text-slate-800 font-medium">{formatDate(subscription.startDate)}</span>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Expiry Date</span>
                          <span className="text-slate-800 font-medium">{formatDate(subscription.endDate)}</span>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Remaining Days</span>
                          <span className="font-bold text-slate-900">{subscription.remainingDays} Days</span>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Trial</span>
                          <span className="font-semibold text-slate-800">
                            {subscription.isTrial 
                              ? `Trial (${subscription.trialDaysRemaining ?? 0} Days Remaining)` 
                              : 'No'}
                          </span>
                        </div>
                      </div>

                      {/* Resource Quotas / Limits Grid */}
                      <div className="pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Resource Limits</span>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium">Production Lines</span>
                            <span className="font-bold text-slate-900 mt-0.5">
                              {subscription.limits?.productionLines === -1 ? 'Unlimited' : `${subscription.productionLinesUsed ?? 0} / ${subscription.limits?.productionLines ?? 0}`}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium">Employees</span>
                            <span className="font-bold text-slate-900 mt-0.5">
                              {subscription.limits?.employees === -1 ? 'Unlimited' : `${subscription.employeesUsed ?? 0} / ${subscription.limits?.employees ?? 0}`}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium">Active Machines</span>
                            <span className="font-bold text-slate-900 mt-0.5">
                              {subscription.limits?.machines === -1 ? 'Unlimited' : `${subscription.machinesUsed ?? 0} / ${subscription.limits?.machines ?? 0}`}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium">Storage Quota</span>
                            <span className="font-bold text-slate-900 mt-0.5">
                              {subscription.limits?.storageGB === -1 ? 'Unlimited' : `${subscription.storageUsedGB ?? 0} GB / ${subscription.limits?.storageGB ?? 0} GB`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Highlighted Features Checklist */}
                      {subscription.highlightedFeatures && subscription.highlightedFeatures.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Included Features</span>
                          <div className="grid grid-cols-1 gap-1.5">
                            {subscription.highlightedFeatures.map((feat: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="font-medium text-slate-800">{feat.featureName}</span>
                                {feat.featureValue && feat.featureValue !== 'Yes' && (
                                  <span className="text-[10px] text-slate-400">({feat.featureValue})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: AUDIT LOG TRACE */}
            {activeTab === 'audit' && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Audit Log Records</h3>
                {tenant.recentActivity && tenant.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {tenant.recentActivity.map((log: any, i: number) => (
                      <div key={i} className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs space-y-1 shadow-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{log.action || 'System Action'}</span>
                          <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600">{log.reason || `Table modification in ${log.tableName}`}</p>
                        <div className="flex gap-4 text-[10px] text-slate-400 pt-1">
                          <span>User: {log.userEmail || 'System'}</span>
                          <span>IP: {log.ipAddress || '127.0.0.1'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic bg-white rounded-xl border border-slate-200">
                    No recent audit activity recorded for this tenant schema.
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
            >
              Close Details
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default TenantDetailsDrawer
