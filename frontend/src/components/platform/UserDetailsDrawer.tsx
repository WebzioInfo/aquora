import React from 'react'
import { X, User, Mail, Phone, ShieldCheck, Building, Calendar, CheckCircle2 } from 'lucide-react'
import EnterpriseBadge from '../ui/EnterpriseBadge'

interface UserDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export const UserDetailsDrawer: React.FC<UserDetailsDrawerProps> = ({
  isOpen,
  onClose,
  user
}) => {
  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                {(user.firstName || user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 leading-snug">
                    {user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User Account'}
                  </h2>
                  <EnterpriseBadge variant={user.isActive ? 'success' : 'danger'}>
                    {user.status || (user.isActive ? 'Active' : 'Inactive')}
                  </EnterpriseBadge>
                </div>
                <p className="text-xs text-slate-500 font-mono">@{user.username || 'user'}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Account Overview
              </h3>

              <div className="divide-y divide-slate-100 text-xs">
                
                {/* User ID */}
                {user.id && (
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">User ID</span>
                    <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{user.id}</span>
                  </div>
                )}

                {/* Email */}
                {user.email && (
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Email Address</span>
                    <span className="font-medium text-blue-600 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {user.email}
                    </span>
                  </div>
                )}

                {/* Phone */}
                {user.phone && (
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Phone</span>
                    <span className="text-slate-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {user.phone}
                    </span>
                  </div>
                )}

                {/* Role */}
                {user.roleName && (
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Role</span>
                    <EnterpriseBadge variant={user.roleName === 'SuperAdmin' ? 'primary' : 'info'}>
                      {user.roleName}
                    </EnterpriseBadge>
                  </div>
                )}

                {/* Department */}
                {user.department && (
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Department</span>
                    <span className="font-semibold text-slate-800">{user.department}</span>
                  </div>
                )}

                {/* Tenant Association */}
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Assigned Scope</span>
                  <span className="font-semibold text-slate-800">{user.tenantName || 'Global Platform'}</span>
                </div>

                {/* Account Status */}
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Status</span>
                  <EnterpriseBadge variant={user.isActive ? 'success' : 'danger'}>
                    {user.status || (user.isActive ? 'Active' : 'Inactive')}
                  </EnterpriseBadge>
                </div>

                {/* Created Date */}
                {user.createdAt && (
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Created Date</span>
                    <span className="text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Close Profile
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default UserDetailsDrawer
