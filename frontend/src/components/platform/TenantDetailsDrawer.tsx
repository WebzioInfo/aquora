import React, { useState } from 'react'
import { X, Building, ShieldCheck, Database, BarChart3, Clock, Lock, Cpu, CheckCircle2, UserCheck, HardDrive, KeyRound } from 'lucide-react'
import EnterpriseBadge from '../ui/EnterpriseBadge'

interface TenantDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  tenant: any
}

export const TenantDetailsDrawer: React.FC<TenantDetailsDrawerProps> = ({
  isOpen,
  onClose,
  tenant
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'tenant' | 'logs'>('company')

  if (!isOpen || !tenant) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-6 py-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-600 flex items-center justify-center font-bold text-lg">
                {tenant.name ? tenant.name.charAt(0).toUpperCase() : 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{tenant.name}</h2>
                  <EnterpriseBadge variant={tenant.isActive ? 'success' : 'danger'}>
                    {tenant.status || (tenant.isActive ? 'Active' : 'Inactive')}
                  </EnterpriseBadge>
                </div>
                <p className="text-xs text-slate-500 font-mono">Schema: {tenant.schemaName} | Domain: {tenant.subdomain}.aquora.com</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-400 overflow-x-auto">
            <button
              onClick={() => setActiveTab('company')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'company' 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building className="w-4 h-4" /> Company Info
            </button>
            <button
              onClick={() => setActiveTab('tenant')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'tenant' 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" /> Tenant Details
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'logs' 
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" /> Recent Activity
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* TAB 1: COMPANY INFO */}
            {activeTab === 'company' && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Corporate Identity</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Company Name</span>
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{tenant.name || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Company Code</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{tenant.code || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Owner / Admin Name</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.ownerName || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Primary Email</span>
                      <span className="font-medium text-blue-600">{tenant.ownerEmail || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Phone Number</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.ownerPhone || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">GST / Tax Registration</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{tenant.gstNumber || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PAN Identifier</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{tenant.panNumber || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">SaaS License Number</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{tenant.licenseNumber || 'Not Available'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-xs text-slate-500 block">Headquarters Address</span>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {tenant.address || 'Not Available'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: TENANT INFO */}
            {activeTab === 'tenant' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center gap-3">
                    <Database className="w-8 h-8 text-blue-600" />
                    <div>
                      <span className="text-xs text-slate-500 block">PostgreSQL Schema</span>
                      <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">{tenant.schemaName || 'Not Available'}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    <div>
                      <span className="text-xs text-slate-500 block">Database Pool Status</span>
                      <span className="text-sm font-bold text-emerald-600">{tenant.isActive ? 'Healthy (Pool Active)' : 'Suspended'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Metadata & Provisioning</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Tenant GUID</span>
                      <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">{tenant.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Subscription Tier</span>
                      <span className="font-semibold text-blue-600">{tenant.subscriptionPlan || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Allocated Storage Used</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {tenant.storageUsedMb !== undefined && tenant.storageUsedMb !== null ? `${tenant.storageUsedMb} MB` : 'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Active Provisioned Users</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {tenant.activeUsersCount !== undefined && tenant.activeUsersCount !== null ? `${tenant.activeUsersCount} Active Users` : 'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Timezone</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.timezone || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Default Currency</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.currency || 'Not Available'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Provisioned Date</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {tenant.createdAt ? new Date(tenant.createdAt).toLocaleString() : 'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Last Active Session / Updated</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleString() : 'Not Available'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: RECENT ACTIVITY LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Log Traceback (Last 10 Actions)</h3>
                {tenant.recentActivity && tenant.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {tenant.recentActivity.map((log: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 dark:text-white">{log.action || 'System Action'}</span>
                          <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">{log.reason || `Table modification in ${log.tableName}`}</p>
                        <div className="flex gap-4 text-[10px] text-slate-400">
                          <span>User: {log.userEmail || 'System'}</span>
                          <span>IP: {log.ipAddress || '127.0.0.1'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    No recent audit activity recorded for this tenant schema.
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
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
