import React, { useState } from 'react'
import { X, Building, Database, Clock, CheckCircle2, ShieldCheck, Mail, Phone, Calendar, Globe, Tag } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'details' | 'audit'>('details')

  if (!isOpen || !tenant) return null

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
              <div className="space-y-4">

                {/* Primary Meta Grid */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Key Attributes
                  </h3>

                  <div className="divide-y divide-slate-100 text-xs">
                    
                    {/* Tenant Name */}
                    {tenant.name && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Company Name</span>
                        <span className="font-bold text-slate-900">{tenant.name}</span>
                      </div>
                    )}

                    {/* Tenant ID */}
                    {tenant.id && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Tenant ID</span>
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{tenant.id}</span>
                      </div>
                    )}

                    {/* Schema Name */}
                    {tenant.schemaName && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium font-sans">Database Schema</span>
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {tenant.schemaName}
                        </span>
                      </div>
                    )}

                    {/* Subdomain */}
                    {tenant.subdomain && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Subdomain</span>
                        <span className="font-mono text-slate-800">{tenant.subdomain}.aquora.com</span>
                      </div>
                    )}

                    {/* Status */}
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Status</span>
                      <EnterpriseBadge variant={tenant.isActive ? 'success' : 'danger'}>
                        {tenant.status || (tenant.isActive ? 'Active' : 'Inactive')}
                      </EnterpriseBadge>
                    </div>

                    {/* Owner Email */}
                    {tenant.ownerEmail && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Owner Email</span>
                        <span className="font-medium text-blue-600 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {tenant.ownerEmail}
                        </span>
                      </div>
                    )}

                    {/* Owner Phone */}
                    {tenant.ownerPhone && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Owner Phone</span>
                        <span className="text-slate-700 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {tenant.ownerPhone}
                        </span>
                      </div>
                    )}

                    {/* Created Date */}
                    {tenant.createdAt && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Provisioned At</span>
                        <span className="text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(tenant.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Updated Date */}
                    {tenant.updatedAt && (
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Last Modified</span>
                        <span className="text-slate-700">{new Date(tenant.updatedAt).toLocaleString()}</span>
                      </div>
                    )}

                  </div>
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
