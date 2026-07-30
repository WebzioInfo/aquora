import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, Search, Filter, RefreshCw, Eye, Edit3, Trash2, MoreVertical, 
  Download, Upload, ChevronLeft, ChevronRight, ShieldAlert, Building, Users 
} from 'lucide-react'
import { api } from '../../services/api'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../components/ui/EnterpriseCard'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseButton from '../../components/ui/EnterpriseButton'

import TenantDetailsDrawer from '../../components/platform/TenantDetailsDrawer'
import TenantModal from '../../components/platform/TenantModal'
import TenantDeleteModal from '../../components/platform/TenantDeleteModal'

import UserDetailsDrawer from '../../components/platform/UserDetailsDrawer'
import UserModal from '../../components/platform/UserModal'
import UserDeleteModal from '../../components/platform/UserDeleteModal'
import BulkOperationsBar from '../../components/platform/BulkOperationsBar'
import ImportExportModal from '../../components/platform/ImportExportModal'

export const PlatformManagementPage: React.FC = () => {
  const location = useLocation()
  const path = location.pathname
  const queryClient = useQueryClient()

  const isTenants = path.includes('/tenants') || path === '/platform' || path === '/platform/'
  const isUsers = path.includes('/users')
  const isSubscriptions = path.includes('/subscriptions')
  const isHealth = path.includes('/system-health')
  const isDatabase = path.includes('/database')
  const isAudit = path.includes('/audit')

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
      
      console.log('Raw tenant API response:', res.data);
      
      const d = res.data;
      if (d?.data?.items) return d.data;
      if (d?.items) return d;
      if (Array.isArray(d?.data)) return { items: d.data, totalCount: d.data.length, totalPages: 1 };
      if (Array.isArray(d)) return { items: d, totalCount: d.length, totalPages: 1 };
      
      return d?.data || { items: [], totalCount: 0, totalPages: 0 };
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
      
      console.log('Raw user API response:', res.data);
      
      const d = res.data;
      if (d?.data?.items) return d.data;
      if (d?.items) return d;
      if (Array.isArray(d?.data)) return { items: d.data, totalCount: d.data.length, totalPages: 1 };
      if (Array.isArray(d)) return { items: d, totalCount: d.length, totalPages: 1 };
      
      return d?.data || { items: [], totalCount: 0, totalPages: 0 };
    },
    enabled: isUsers
  })

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
    if (!deletingTenant) {
      console.error('[DELETE ERROR] No tenant selected for deletion.')
      return
    }
    console.log('[DELETE START] Requesting delete for Tenant ID:', deletingTenant.id, 'with reason:', reason)
    try {
      const res = await api.delete(`/api/v1/platform/tenants/${deletingTenant.id}`, {
        params: { reason }
      })
      console.log('[DELETE RESPONSE SUCCESS]:', res.data)
      queryClient.invalidateQueries({ queryKey: ['platformTenants'] })
    } catch (err: any) {
      console.error('[DELETE RESPONSE ERROR]:', err?.response || err)
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
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    await api.delete(`/api/v1/platform/users/${deletingUser.id}`)
    queryClient.invalidateQueries({ queryKey: ['platformUsers'] })
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
      <div className="flex flex-col gap-6 select-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <EnterpriseHeader 
            title="Tenant Registry Console" 
            description="Enterprise CRUD control, Postgres schema provisioner, and security clearance isolation." 
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportExportModal({ isOpen: true, type: 'tenant' })}
              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-blue-600" /> Export / Import
            </button>
            <EnterpriseButton onClick={() => { setEditingTenant(null); setIsTenantModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5 inline" /> Provision New Tenant
            </EnterpriseButton>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Global search by tenant name, schema, subdomain, owner email..."
                value={tenantSearch}
                onChange={(e) => { setTenantSearch(e.target.value); setTenantPage(1); }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={tenantStatus}
              onChange={(e) => { setTenantStatus(e.target.value); setTenantPage(1); }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={tenantPlan}
              onChange={(e) => { setTenantPlan(e.target.value); setTenantPage(1); }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
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
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
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
                  <tr className="h-[48px] border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-slate-950">
                    <th className="py-3 px-4">Tenant & Subdomain</th>
                    <th className="py-3 px-4">PostgreSQL Schema</th>
                    <th className="py-3 px-4">Owner Contact</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Active Users</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tenantsList.map((t: any) => (
                    <tr key={t.id} className="h-[52px] hover:bg-slate-50/80 dark:hover:bg-slate-950/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center text-sm">
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{t.name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">{t.subdomain}.aquora.com</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                          {t.schemaName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white block">{t.ownerName || 'Not Available'}</span>
                          <span className="text-slate-400 text-[11px]">{t.ownerEmail || 'Not Available'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={t.subscriptionPlan === 'Enterprise' ? 'purple' : t.subscriptionPlan === 'Professional' ? 'primary' : 'secondary'}>
                          {t.subscriptionPlan || 'Not Available'}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={t.isActive ? 'success' : 'danger'}>
                          {t.status || (t.isActive ? 'Active' : 'Inactive')}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {t.activeUsersCount !== undefined && t.activeUsersCount !== null ? `${t.activeUsersCount} Users` : 'Not Available'}
                      </td>

                      {/* Desktop & Mobile Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="hidden md:flex items-center justify-end gap-1">
                          <button
                            onClick={() => setActiveTenantDetails(t)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Full Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingTenant(t); setIsTenantModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Tenant Configuration"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingTenant(t)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hard Delete Tenant Schema"
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
                            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 p-1 text-left text-xs">
                              <button
                                onClick={() => { setActiveTenantDetails(t); setMobileMenuRowId(null); }}
                                className="w-full px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" /> View Details
                              </button>
                              <button
                                onClick={() => { setEditingTenant(t); setIsTenantModalOpen(true); setMobileMenuRowId(null); }}
                                className="w-full px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
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
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <span>Showing page <strong>{tenantPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total tenants)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTenantPage(p => Math.max(1, p - 1))}
                disabled={tenantPage === 1}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={() => setTenantPage(p => Math.min(totalPages, p + 1))}
                disabled={tenantPage >= totalPages}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
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
      <div className="flex flex-col gap-6 select-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <EnterpriseHeader 
            title="Platform Administration User Directory" 
            description="Full CRUD user management, role assignments, department authorization, and session control." 
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportExportModal({ isOpen: true, type: 'user' })}
              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Global search by user name, email, phone, role, department..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={userRole}
              onChange={(e) => { setUserRole(e.target.value); setUserPage(1); }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
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
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <button
            onClick={() => refetchUsers()}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
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
                  <tr className="h-[48px] border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-slate-950">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usersList.map((u: any) => (
                    <tr key={u.id} className="h-[52px] hover:bg-slate-50/80 dark:hover:bg-slate-950/60 transition-colors">
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
                          <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center text-xs">
                            {(u.firstName || u.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{u.name || u.email}</span>
                            <span className="text-slate-400 text-[11px] font-mono">@{u.username || 'user'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-slate-900 dark:text-white font-medium block">{u.email}</span>
                          <span className="text-slate-400 text-[11px]">{u.phone || '+1 (555) 010-0921'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={u.roleName === 'SuperAdmin' ? 'purple' : u.roleName === 'CompanyAdmin' ? 'primary' : 'secondary'}>
                          {u.roleName || 'Standard'}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {u.department || 'Operations'}
                      </td>
                      <td className="py-3 px-4">
                        <EnterpriseBadge variant={u.isActive ? 'success' : 'danger'}>
                          {u.status || (u.isActive ? 'Active' : 'Inactive')}
                        </EnterpriseBadge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                        {u.tenantName || 'Global Platform'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setActiveUserDetails(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Full Profile"
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
                            title="Delete User Account"
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
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <span>Showing page <strong>{userPage}</strong> of <strong>{totalPages}</strong> ({totalCount} total users)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUserPage(p => Math.max(1, p - 1))}
                disabled={userPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={() => setUserPage(p => Math.min(totalPages, p + 1))}
                disabled={userPage >= totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
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
    return (
      <div className="flex flex-col gap-6 select-none">
        <EnterpriseHeader title="Subscription Tiers" description="Manage plans, resource limits, and production line quotas." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E9F2] p-6 rounded-[12px] shadow-xs flex flex-col gap-4">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Starter Tier</span>
            <span className="text-[28px] font-bold text-[#101828] block">$199 / mo</span>
            <p className="text-sm text-[#667085] leading-relaxed">Up to 3 production lines, 10 active machines, and basic telemetry reports.</p>
          </div>
          <div className="bg-white border-2 border-[#1A56DB] p-6 rounded-[12px] shadow-xs flex flex-col gap-4 relative">
            <span className="absolute top-3 right-3 text-[10px] font-bold text-[#1A56DB] bg-[#EFF4FF] px-2 py-0.5 rounded-full uppercase">Popular</span>
            <span className="text-xs font-semibold text-[#1A56DB] uppercase tracking-wider block">Professional Tier</span>
            <span className="text-[28px] font-bold text-[#101828] block">$499 / mo</span>
            <p className="text-sm text-[#667085] leading-relaxed">Up to 10 production lines, 50 machines, custom domains, and automated checklists.</p>
          </div>
          <div className="bg-white border border-[#E5E9F2] p-6 rounded-[12px] shadow-xs flex flex-col gap-4">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Enterprise Tier</span>
            <span className="text-[28px] font-bold text-[#101828] block">Custom Pricing</span>
            <p className="text-sm text-[#667085] leading-relaxed">Unlimited resources, dedicated DB cluster support, and 24/7 priority SLA.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 select-none">
      <EnterpriseHeader title="System Telemetry & Settings" description="Global SaaS platform preferences and APIs." />
      <EnterpriseCard title="Platform Settings">
        <p className="text-sm text-slate-500">Select Tenant Console or User Directory from the navigation tree to manage enterprise resources.</p>
      </EnterpriseCard>
    </div>
  )
}

export default PlatformManagementPage
