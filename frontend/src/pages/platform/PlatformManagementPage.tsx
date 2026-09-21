import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, RefreshCw, Eye, Edit3, Trash2, MoreVertical,
  Download, ChevronLeft, ChevronRight, Building, Users
} from 'lucide-react'
import { api } from '../../services/api'
import { toast } from '../../utils/toast'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../components/ui/EnterpriseCard'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'

import TenantDetailsDrawer from '../../components/platform/TenantDetailsDrawer'
import TenantModal from '../../components/platform/TenantModal'
import TenantDeleteModal from '../../components/platform/TenantDeleteModal'

import UserDetailsDrawer from '../../components/platform/UserDetailsDrawer'
import UserModal from '../../components/platform/UserModal'
import UserDeleteModal from '../../components/platform/UserDeleteModal'
import BulkOperationsBar from '../../components/platform/BulkOperationsBar'
import ImportExportModal from '../../components/platform/ImportExportModal'
import SubscriptionManagementTab from './subscriptions/SubscriptionManagementTab'

export const PlatformManagementPage: React.FC = () => {
  const location = useLocation()
  const path = location.pathname
  const queryClient = useQueryClient()

  const isTenants = path.includes('/tenants') || path === '/platform' || path === '/platform/'
  const isUsers = path.includes('/users')
  const isSubscriptions = path.includes('/subscriptions')

  // TENANT QUERY STATE
  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantStatus, setTenantStatus] = useState('')
  const [tenantPlan, setTenantPlan] = useState('')
  const [tenantSort, setTenantSort] = useState('Name')
  const [tenantPage, setTenantPage] = useState(1)
  const [tenantPageSize, setTenantPageSize] = useState(10)

  // USER QUERY STATE
  const [userSearch, setUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userDept, setUserDept] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(10)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  // MODAL & DRAWER STATES
  const [activeTenantDetails, setActiveTenantDetails] = useState<any | null>(null)
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<any | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null)

  const [activeUserDetails, setActiveUserDetails] = useState<any | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [deletingUser, setDeletingUser] = useState<any | null>(null)

  const [importExportModal, setImportExportModal] = useState<{ isOpen: boolean; type: 'tenant' | 'user' }>({
    isOpen: false,
    type: 'tenant'
  })

  // MOBILE OVERFLOW MENU STATE
  const [mobileMenuRowId, setMobileMenuRowId] = useState<string | null>(null)

  // FETCH TENANTS
  const { data: tenantsResult, isLoading: tenantsLoading, refetch: refetchTenants } = useQuery({
    queryKey: ['platformTenants', tenantSearch, tenantStatus, tenantPlan, tenantSort, tenantPage, tenantPageSize],
    queryFn: async () => {
      const res = await api.get('/api/v1/platform/tenants', {
        params: {
          search: tenantSearch,
          statusFilter: tenantStatus,
          planFilter: tenantPlan,
          sortBy: tenantSort,
          page: tenantPage,
          pageSize: tenantPageSize
        }
      })

      const d = res.data
      if (d?.data?.items) return d.data
      if (d?.items) return d
      if (Array.isArray(d?.data)) return { items: d.data, totalCount: d.data.length, totalPages: 1 }
      if (Array.isArray(d)) return { items: d, totalCount: d.length, totalPages: 1 }

      return d?.data || { items: [], totalCount: 0, totalPages: 0 }
    },
    enabled: isTenants
  })

  // FETCH USERS
  const { data: usersResult, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['platformUsers', userSearch, userStatus, userRole, userDept, userPage, userPageSize],
    queryFn: async () => {
      const res = await api.get('/api/v1/platform/users', {
        params: {
          search: userSearch,
          statusFilter: userStatus,
          roleFilter: userRole,
          departmentFilter: userDept,
          page: userPage,
          pageSize: userPageSize
        }
      })

      const d = res.data
      if (d?.data?.items) return d.data
      if (d?.items) return d
      if (Array.isArray(d?.data)) return { items: d.data, totalCount: d.data.length, totalPages: 1 }
      if (Array.isArray(d)) return { items: d, totalCount: d.length, totalPages: 1 }

      return d?.data || { items: [], totalCount: 0, totalPages: 0 }
    },
    enabled: isUsers
  })

  // BIODROPS PRODUCTION TOGGLE LOADING STATE
  const [updatingBiodropsTenantIds, setUpdatingBiodropsTenantIds] = useState<Set<string>>(new Set())

  const handleToggleBiodropsProduction = async (tenant: any) => {
    if (!tenant?.id || updatingBiodropsTenantIds.has(tenant.id)) return

    const newTargetState = !tenant.isBiodropsProduction

    setUpdatingBiodropsTenantIds(prev => new Set(prev).add(tenant.id))

    try {
      await api.put(`/api/v1/platform/tenants/${tenant.id}`, {
        isBiodropsProduction: newTargetState
      })
      toast.success(`BioDrops Production ${newTargetState ? 'enabled' : 'disabled'} for ${tenant.name}`)
      queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update BioDrops Production setting'
      toast.error(errMsg)
      queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
    } finally {
      setUpdatingBiodropsTenantIds(prev => {
        const next = new Set(prev)
        next.delete(tenant.id)
        return next
      })
    }
  }

  // TENANT ACTIONS HANDLERS
  const handleSaveTenant = async (data: any) => {
    if (editingTenant) {
      await api.put(`/api/v1/platform/tenants/${editingTenant.id}`, data)
    } else {
      await api.post('/api/v1/platform/tenants', data)
    }
    queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
  }

  const handleDeleteTenant = async (reason: string) => {
    if (!deletingTenant) return
    try {
      await api.delete(`/api/v1/platform/tenants/${deletingTenant.id}`, {
        params: { reason }
      })
      queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
    } catch (err: any) {
      throw err
    }
  }

  // USER ACTIONS HANDLERS
  const handleSaveUser = async (data: any) => {
    if (editingUser) {
      await api.put(`/api/v1/platform/users/${editingUser.id}`, data)
    } else {
      await api.post('/api/v1/platform/users', data)
    }
    queryClient.invalidateQueries({ queryKey: ['platformUsers'] })
    queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    await api.delete(`/api/v1/platform/users/${deletingUser.id}`)
    queryClient.invalidateQueries({ queryKey: ['platformUsers'] })
    queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
  }

  const handleBulkUserAction = async (action: string, targetValue?: string) => {
    if (selectedUserIds.length === 0) return
    await api.post('/api/v1/platform/users/bulk', {
      userIds: selectedUserIds,
      action,
      targetValue
    })
    setSelectedUserIds([])
    queryClient.invalidateQueries({ queryKey: ['platformUsers'] })
    queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
  }

  // IMPORT / EXPORT HANDLERS
  const handleExport = async (format: string) => {
    if (importExportModal.type === 'tenant') {
      const res = await api.post('/api/v1/platform/tenants/export', {
        search: tenantSearch,
        statusFilter: tenantStatus,
        planFilter: tenantPlan
      }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tenants_${new Date().toISOString().substring(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
    } else {
      const res = await api.post('/api/v1/platform/users/export', {
        search: userSearch,
        statusFilter: userStatus,
        roleFilter: userRole
      }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `users_${new Date().toISOString().substring(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
    }
    setImportExportModal({ isOpen: false, type: 'tenant' })
  }

  const handleImportPreview = async (file: File) => {
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length <= 1) return { previewItems: [], successCount: 0, errorCount: 0 }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const records = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const obj: any = {}
      headers.forEach((h, i) => { obj[h] = values[i] || '' })
      return obj
    })

    const endpoint = importExportModal.type === 'tenant' ? '/api/v1/platform/tenants/import' : '/api/v1/platform/users/import'
    const res = await api.post(endpoint, { records, commit: false })
    return res.data?.data || { previewItems: records, successCount: records.length, errorCount: 0 }
  }

  const handleImportCommit = async (records: any[]) => {
    const endpoint = importExportModal.type === 'tenant' ? '/api/v1/platform/tenants/import' : '/api/v1/platform/users/import'
    await api.post(endpoint, { records, commit: true })
    queryClient.invalidateQueries({ queryKey: importExportModal.type === 'tenant' ? ['platformTenants'] : ['platformUsers'] })
  }

  // RENDER TENANTS MANAGEMENT CONSOLE
  if (isTenants) {
    const tenantsList = tenantsResult?.items || []
    const totalCount = tenantsResult?.totalCount || 0
    const totalPages = tenantsResult?.totalPages || (Math.ceil(totalCount / tenantPageSize) || 1)

    return (
      <div className="flex flex-col gap-6 select-none bg-[#F8FAFC] min-h-screen -m-6 p-6">
        {/* Light Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <EnterpriseHeader
            title="Tenant Registry Console"
            description="Enterprise CRUD control, Postgres schema provisioner, and security clearance isolation."
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportExportModal({ isOpen: true, type: 'tenant' })}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4 text-blue-600" /> Export / Import
            </button>
            <EnterpriseButton onClick={() => { setEditingTenant(null); setIsTenantModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5 inline" /> Provision New Tenant
            </EnterpriseButton>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-[#E5E7EB] px-4 py-3 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by tenant name, schema, subdomain, owner email..."
                value={tenantSearch}
                onChange={(e) => { setTenantSearch(e.target.value); setTenantPage(1); }}
                className="w-full pl-9 pr-3 h-[32px] bg-white border border-[#E5E7EB] rounded-lg text-[12px] focus:outline-none focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <select
              value={tenantStatus}
              onChange={(e) => { setTenantStatus(e.target.value); setTenantPage(1); }}
              className="h-[32px] px-3 bg-white border border-[#E5E7EB] rounded-lg text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={tenantPlan}
              onChange={(e) => { setTenantPlan(e.target.value); setTenantPage(1); }}
              className="h-[32px] px-3 bg-white border border-[#E5E7EB] rounded-lg text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">All Plans</option>
              <option value="Starter">Starter Tier</option>
              <option value="Professional">Professional Tier</option>
              <option value="Enterprise">Enterprise Tier</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchTenants()}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
              title="Refresh Grid"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Grid Table */}
        <EnterpriseCard title={`Registered SaaS Tenants (${totalCount})`}>
          {tenantsLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : tenantsList.length > 0 ? (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="h-[48px] border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                    <th className="py-3 px-4">Tenant & Subdomain</th>
                    <th className="py-3 px-4">PostgreSQL Schema</th>
                    <th className="py-3 px-4">Owner Contact</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">BioDrops Production</th>
                    <th className="py-3 px-4">Active Users</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantsList.map((t: any) => (
                    <tr key={t.id} className="h-[52px] hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                            {t.name ? t.name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{t.name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">{t.subdomain}.aquora.com</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-700 font-medium px-2 py-0.5 bg-slate-100 border border-slate-200/60 rounded">
                          {t.schemaName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium text-slate-900 block">{t.ownerName || 'Not Available'}</span>
                          <span className="text-slate-400 text-[11px]">{t.ownerEmail || 'Not Available'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={t.subscriptionPlan === 'Enterprise' ? 'primary' : t.subscriptionPlan === 'Professional' ? 'info' : 'gray'}>
                          {t.subscriptionPlan || 'Starter'}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={t.isActive ? 'success' : 'danger'}>
                          {t.status || (t.isActive ? 'Active' : 'Inactive')}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={updatingBiodropsTenantIds.has(t.id)}
                            onClick={() => handleToggleBiodropsProduction(t)}
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              t.isBiodropsProduction ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                            title={t.isBiodropsProduction ? 'BioDrops Production Enabled (Click to disable)' : 'BioDrops Production Disabled (Click to enable)'}
                          >
                            <span className="sr-only">Toggle BioDrops Production</span>
                            {updatingBiodropsTenantIds.has(t.id) ? (
                              <span className="h-4 w-4 transform rounded-full bg-white shadow-sm flex items-center justify-center">
                                <span className="animate-spin h-2.5 w-2.5 rounded-full border-b border-blue-600" />
                              </span>
                            ) : (
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  t.isBiodropsProduction ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            )}
                          </button>
                          <span className={`text-[11px] font-semibold ${t.isBiodropsProduction ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
                            {t.isBiodropsProduction ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {t.activeUsersCount !== undefined && t.activeUsersCount !== null ? `${t.activeUsersCount} Users` : 'Not Available'}
                      </td>

                      {/* Desktop & Mobile Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="hidden md:flex items-center justify-end gap-1">
                          <button
                            onClick={() => setActiveTenantDetails(t)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingTenant(t); setIsTenantModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Tenant"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingTenant(t)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Tenant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Mobile Overflow Menu */}
                        <div className="relative md:hidden inline-block text-left">
                          <button
                            onClick={() => setMobileMenuRowId(mobileMenuRowId === t.id ? null : t.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {mobileMenuRowId === t.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-1 text-left text-xs">
                              <button
                                onClick={() => { setActiveTenantDetails(t); setMobileMenuRowId(null); }}
                                className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" /> Details
                              </button>
                              <button
                                onClick={() => { setEditingTenant(t); setIsTenantModalOpen(true); setMobileMenuRowId(null); }}
                                className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit
                              </button>
                              <button
                                onClick={() => { setDeletingTenant(t); setMobileMenuRowId(null); }}
                                className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 italic">
              No matching tenant registries provisioned in database.
            </div>
          )}

          {/* Server-Side Pagination Bar */}
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <span>Showing page <strong>{tenantPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total tenants)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTenantPage(p => Math.max(1, p - 1))}
                disabled={tenantPage === 1}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={() => setTenantPage(p => Math.min(totalPages, p + 1))}
                disabled={tenantPage >= totalPages}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-xs"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </EnterpriseCard>

        {/* DRAWERS & MODALS */}
        <TenantDetailsDrawer
          isOpen={!!activeTenantDetails}
          onClose={() => setActiveTenantDetails(null)}
          tenant={activeTenantDetails}
        />

        <TenantModal
          isOpen={isTenantModalOpen}
          onClose={() => { setIsTenantModalOpen(false); setEditingTenant(null); }}
          onSubmit={handleSaveTenant}
          initialData={editingTenant}
          isEditing={!!editingTenant}
        />

        <TenantDeleteModal
          isOpen={!!deletingTenant}
          onClose={() => setDeletingTenant(null)}
          onConfirm={handleDeleteTenant}
          tenant={deletingTenant}
        />

        <ImportExportModal
          isOpen={importExportModal.isOpen}
          onClose={() => setImportExportModal({ ...importExportModal, isOpen: false })}
          type={importExportModal.type}
          onExport={handleExport}
          onImportPreview={handleImportPreview}
          onImportCommit={handleImportCommit}
        />
      </div>
    )
  }

  // RENDER USER DIRECTORY CONSOLE
  if (isUsers) {
    const usersList = usersResult?.items || []
    const totalCount = usersResult?.totalCount || 0
    const totalPages = usersResult?.totalPages || (Math.ceil(totalCount / userPageSize) || 1)

    const isAllSelected = usersList.length > 0 && selectedUserIds.length === usersList.length

    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        setSelectedUserIds(usersList.map((u: any) => u.id))
      } else {
        setSelectedUserIds([])
      }
    }

    const handleToggleSelectUser = (id: string) => {
      setSelectedUserIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      )
    }

    return (
      <div className="flex flex-col gap-6 select-none bg-[#F8FAFC] min-h-screen -m-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <EnterpriseHeader
            title="Platform Administration User Directory"
            description="Full CRUD user management, role assignments, department authorization, and session control."
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportExportModal({ isOpen: true, type: 'user' })}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4 text-blue-600" /> Export / Import
            </button>
            <EnterpriseButton onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5 inline" /> Create User Account
            </EnterpriseButton>
          </div>
        </div>

        {/* Bulk Operations Bar */}
        <BulkOperationsBar
          selectedCount={selectedUserIds.length}
          onClearSelection={() => setSelectedUserIds([])}
          onBulkExecute={handleBulkUserAction}
        />

        {/* Search & Filters Bar */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, role, department, or tenant/company..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <select
              value={userRole}
              onChange={(e) => { setUserRole(e.target.value); setUserPage(1); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="">All Roles</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="CompanyAdmin">CompanyAdmin</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Operator">Operator</option>
              <option value="Standard">Standard</option>
            </select>
            <select
              value={userStatus}
              onChange={(e) => { setUserStatus(e.target.value); setUserPage(1); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <button
            onClick={() => refetchUsers()}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh User List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* User Directory Table */}
        <EnterpriseCard title={`Directory Accounts (${totalCount})`}>
          {usersLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : usersList.length > 0 ? (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="h-[48px] border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-3 px-4">User Identity</th>
                    <th className="py-3 px-4">Corporate Email & Phone</th>
                    <th className="py-3 px-4">Privilege Role</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Assigned Tenant</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u: any) => (
                    <tr key={u.id} className="h-[52px] hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => handleToggleSelectUser(u.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                            {(u.firstName || u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.name || u.email}</span>
                            <span className="text-slate-400 text-[11px] font-mono">@{u.username || 'user'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-slate-900 font-medium block">{u.email}</span>
                          {u.phone && <span className="text-slate-400 text-[11px]">{u.phone}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={u.roleName === 'SuperAdmin' ? 'primary' : u.roleName === 'CompanyAdmin' ? 'info' : 'gray'}>
                          {u.roleName || 'Standard'}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {u.department || 'Operations'}
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={u.isActive ? 'success' : 'danger'}>
                          {u.status || (u.isActive ? 'Active' : 'Inactive')}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {u.tenantName || 'Global Platform'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setActiveUserDetails(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 italic">
              No directory accounts found.
            </div>
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <span>Showing page <strong>{userPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total users)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUserPage(p => Math.max(1, p - 1))}
                disabled={userPage === 1}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={() => setUserPage(p => Math.min(totalPages, p + 1))}
                disabled={userPage >= totalPages}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 shadow-xs"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </EnterpriseCard>

        {/* USER DRAWERS & MODALS */}
        <UserDetailsDrawer
          isOpen={!!activeUserDetails}
          onClose={() => setActiveUserDetails(null)}
          user={activeUserDetails}
        />

        <UserModal
          isOpen={isUserModalOpen}
          onClose={() => { setIsUserModalOpen(false); setEditingUser(null); }}
          onSubmit={handleSaveUser}
          initialData={editingUser}
          isEditing={!!editingUser}
          tenantsList={tenantsResult?.items || []}
        />

        <UserDeleteModal
          isOpen={!!deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDeleteUser}
          user={deletingUser}
        />

        <ImportExportModal
          isOpen={importExportModal.isOpen}
          onClose={() => setImportExportModal({ ...importExportModal, isOpen: false })}
          type={importExportModal.type}
          onExport={handleExport}
          onImportPreview={handleImportPreview}
          onImportCommit={handleImportCommit}
        />
      </div>
    )
  }

  // OTHER PLATFORM TABS
  if (isSubscriptions) {
    return <SubscriptionManagementTab />
  }

  return (
    <div className="flex flex-col gap-6 select-none bg-[#F8FAFC] min-h-screen -m-6 p-6">
      <EnterpriseHeader title="System Telemetry & Settings" description="Global SaaS platform preferences and APIs." />
      <EnterpriseCard title="Platform Settings">
        <p className="text-sm text-slate-500">Select Tenant Console or User Directory from the navigation tree to manage enterprise resources.</p>
      </EnterpriseCard>
    </div>
  )
}

export default PlatformManagementPage
