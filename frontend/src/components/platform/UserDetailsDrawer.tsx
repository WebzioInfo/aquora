import React, { useState } from 'react'
import { X, User, Briefcase, Key, Calendar, DollarSign, Clock, Laptop, ShieldCheck, Mail, Phone, Building } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'personal' | 'employment' | 'permissions' | 'devices' | 'history'>('personal')

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-6 py-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/10 border-2 border-blue-600/30 text-blue-600 flex items-center justify-center font-bold text-xl">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (user.firstName || user.name || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{user.name || user.email}</h2>
                  <EnterpriseBadge variant={user.isActive ? 'success' : 'danger'}>
                    {user.status || (user.isActive ? 'Active' : 'Inactive')}
                  </EnterpriseBadge>
                </div>
                <p className="text-xs text-slate-500 font-mono">{user.email} | {user.roleName || 'Standard User'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-400 overflow-x-auto">
            <button
              onClick={() => setActiveTab('personal')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'personal' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" /> Personal
            </button>
            <button
              onClick={() => setActiveTab('employment')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'employment' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" /> Employment & Salary
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'permissions' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Key className="w-4 h-4" /> Permissions
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'devices' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Laptop className="w-4 h-4" /> Active Devices
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 font-medium transition-colors ${
                activeTab === 'history' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" /> Login History
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* TAB 1: PERSONAL */}
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Personal Identity</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">First Name</span>
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{user.firstName || 'Platform'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Last Name</span>
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{user.lastName || 'User'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Username</span>
                      <span className="font-mono text-blue-600 font-semibold">{user.username || 'user'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Corporate Email</span>
                      <span className="font-medium text-slate-900 dark:text-white">{user.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Phone Number</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{user.phone || '+1 (555) 010-0921'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Account Status</span>
                      <span className="font-semibold text-emerald-600">{user.status || 'Active'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-xs text-slate-500 block">Assigned SaaS Tenant / Organization</span>
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                    <Building className="w-4 h-4 text-blue-600" />
                    {user.tenantName || 'Global Platform Administration'}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EMPLOYMENT & SALARY */}
            {activeTab === 'employment' && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employment Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Department</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{user.department || 'Operations'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Designation / Title</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{user.designation || 'Senior Operations Engineer'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Assigned Work Shift</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{user.shift || 'Day Shift (09:00 - 18:00)'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Joining Date</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{new Date(user.joiningDate || user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
                    <span className="text-xs font-medium text-slate-500 block">Monthly Base Compensation</span>
                    <span className="text-xl font-bold text-emerald-600 mt-1 block">${(user.salary || 75000).toLocaleString()}</span>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
                    <span className="text-xs font-medium text-slate-500 block">Attendance Regularity</span>
                    <span className="text-xl font-bold text-blue-600 mt-1 block">{user.attendanceSummary || '98.5% On-Time'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PERMISSIONS */}
            {activeTab === 'permissions' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Security Entitlements</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(user.permissions || ['TENANT_READ', 'TENANT_WRITE', 'USERS_READ', 'USERS_WRITE', 'REPORTS_VIEW', 'AUDIT_VIEW']).map((p: string, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2 font-mono font-medium text-blue-600">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: ACTIVE DEVICES */}
            {activeTab === 'devices' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Client Terminals</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <Laptop className="w-5 h-5 text-blue-600" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">Chrome 126.0 (Windows 11 x64)</span>
                        <span className="text-slate-400 text-[10px]">IP: 192.168.1.104 | Primary Desktop Session</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">Current Session</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: LOGIN HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authentication Traceback</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white">JWT Access Granted</span>
                      <span className="text-slate-400 text-[10px]">{new Date(user.lastLoginAt || user.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-500">Successful password validation from 127.0.0.1 (Web Portal)</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors">
              Close Profile
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default UserDetailsDrawer
