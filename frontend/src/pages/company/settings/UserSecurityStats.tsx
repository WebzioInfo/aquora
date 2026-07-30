import React, { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useNavigate } from 'react-router-dom'
import { Users, Lock, UserPlus, ShieldAlert, ChevronRight } from 'lucide-react'

export const UserSecurityStats: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/company/user-security')
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data)
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load user security stats.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handlePasswordPolicyClick = () => {
    showToast('Password security policy: Minimum 8 characters, uppercase, lowercase, numbers, and special characters required.', 'info')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-800">User Security</h3>
        <p className="text-xs text-slate-500 mt-1">Real-time statistics of employee credentials and access control.</p>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-center">
            <Users className="w-5 h-5 text-blue-500 mb-2" />
            <span className="text-2xl font-bold text-slate-800">{stats?.totalEmployees ?? 0}</span>
            <span className="text-xs text-slate-500 font-medium mt-1">Total Employees</span>
          </div>

          <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-center">
            <UserPlus className="w-5 h-5 text-green-500 mb-2" />
            <span className="text-2xl font-bold text-slate-800">{stats?.activeEmployees ?? 0}</span>
            <span className="text-xs text-slate-500 font-medium mt-1">Active Users</span>
          </div>

          <div className="p-4 border border-slate-100 rounded-xl bg-red-50/40 flex flex-col items-center justify-center text-center border-red-100">
            <Lock className="w-5 h-5 text-red-500 mb-2" />
            <span className="text-2xl font-bold text-red-700">{stats?.lockedUsers ?? 0}</span>
            <span className="text-xs text-red-600 font-medium mt-1">Locked Users</span>
          </div>

          <div className="p-4 border border-slate-100 rounded-xl bg-orange-50/40 flex flex-col items-center justify-center text-center border-orange-100">
            <ShieldAlert className="w-5 h-5 text-orange-500 mb-2" />
            <span className="text-2xl font-bold text-orange-700">{stats?.pendingInvitations ?? 0}</span>
            <span className="text-xs text-orange-600 font-medium mt-1">Pending Invites</span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3">Quick Actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button 
              onClick={() => navigate('/company/employees')}
              className="flex items-center justify-between p-3 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/10 rounded-xl text-left transition-all"
            >
              <div>
                <span className="block text-xs font-bold text-slate-800">Manage Employees</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">Provision credentials</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button 
              onClick={() => navigate('/company/employees')}
              className="flex items-center justify-between p-3 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/10 rounded-xl text-left transition-all"
            >
              <div>
                <span className="block text-xs font-bold text-slate-800">Manage Roles</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">RBAC permissions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button 
              onClick={handlePasswordPolicyClick}
              className="flex items-center justify-between p-3 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/10 rounded-xl text-left transition-all"
            >
              <div>
                <span className="block text-xs font-bold text-slate-800">Password Policy</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">Global requirements</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
