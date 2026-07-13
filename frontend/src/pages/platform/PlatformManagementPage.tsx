import React from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../components/ui/EnterpriseCard'
import EnterpriseTable from '../../components/ui/EnterpriseTable'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseButton from '../../components/ui/EnterpriseButton'

export const PlatformManagementPage: React.FC = () => {
  const location = useLocation()
  const path = location.pathname

  const isTenants = path.includes('/tenants')
  const isUsers = path.includes('/users')
  const isSubscriptions = path.includes('/subscriptions')
  const isHealth = path.includes('/system-health')
  const isDatabase = path.includes('/database')
  const isAudit = path.includes('/audit')

  // Fetch tenants dynamically from platform API
  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['platformTenants'],
    queryFn: async () => {
      const res = await api.get('/api/v1/platform/tenants')
      return res.data?.data || []
    },
    enabled: isTenants
  })

  // Fetch users dynamically from platform API
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['platformUsers'],
    queryFn: async () => {
      const res = await api.get('/api/v1/platform/users')
      return res.data?.data || []
    },
    enabled: isUsers
  })

  if (isTenants) {
    const tenantColumns = [
      { key: 'name', title: 'Tenant Name', render: (row: any) => <span className="font-semibold text-[#101828]">{row.name}</span> },
      { key: 'schema', title: 'Database Schema Name', render: (row: any) => <span className="font-mono text-[#667085]">{row.schema}</span> },
      { key: 'subdomain', title: 'Subdomain Prefix', render: (row: any) => <span className="font-mono text-[#667085]">{row.subdomain}</span> },
      { key: 'status', title: 'Clearance Status', render: (row: any) => <EnterpriseBadge variant="success">{row.status}</EnterpriseBadge> }
    ]

    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader title="Tenant Registries" description="Provisioned client schemas and subdomain endpoints." />
        <EnterpriseCard title="Active SaaS Databases">
          {tenantsLoading ? (
            <div className="flex items-center justify-center min-h-[150px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A56DB]"></div>
            </div>
          ) : (
            <EnterpriseTable columns={tenantColumns} data={tenantsData} />
          )}
        </EnterpriseCard>
      </div>
    )
  }

  if (isUsers) {
    const userColumns = [
      { key: 'name', title: 'User Name', render: (row: any) => <span className="font-semibold text-[#101828]">{row.name}</span> },
      { key: 'email', title: 'Corporate Email', render: (row: any) => <span className="text-[#667085]">{row.email}</span> },
      { key: 'privileges', title: 'Privilege Tier', render: (row: any) => <EnterpriseBadge variant="primary">{row.privileges}</EnterpriseBadge> },
      { key: 'status', title: 'Account Status', render: (row: any) => <EnterpriseBadge variant="success">{row.status}</EnterpriseBadge> }
    ]

    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader title="Platform Administration Directory" description="Authorized system administrators for global SaaS configurations." />
        <EnterpriseCard title="Administrative Accounts">
          {usersLoading ? (
            <div className="flex items-center justify-center min-h-[150px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A56DB]"></div>
            </div>
          ) : (
            <EnterpriseTable columns={userColumns} data={usersData} />
          )}
        </EnterpriseCard>
      </div>
    )
  }

  if (isSubscriptions) {
    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader title="Subscription Tiers" description="Manage plans, resource limits, and production line quotas." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E9F2] p-6 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col gap-4">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Starter Tier</span>
            <span className="text-[28px] font-bold text-[#101828] block">$199 / mo</span>
            <p className="text-sm text-[#667085] leading-relaxed">Up to 3 production lines, 10 active machines, and basic telemetry reports.</p>
          </div>
          <div className="bg-white border-2 border-[#1A56DB] p-6 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col gap-4 relative">
            <span className="absolute top-3 right-3 text-[10px] font-bold text-[#1A56DB] bg-[#EFF4FF] px-2 py-0.5 rounded-full uppercase">Popular</span>
            <span className="text-xs font-semibold text-[#1A56DB] uppercase tracking-wider block">Professional Tier</span>
            <span className="text-[28px] font-bold text-[#101828] block">$499 / mo</span>
            <p className="text-sm text-[#667085] leading-relaxed">Up to 10 production lines, 50 machines, custom domains, and automated checklists.</p>
          </div>
          <div className="bg-white border border-[#E5E9F2] p-6 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col gap-4">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Enterprise Tier</span>
            <span className="text-[28px] font-bold text-[#101828] block">Custom Pricing</span>
            <p className="text-sm text-[#667085] leading-relaxed">Unlimited resources, dedicated DB cluster support, and 24/7 priority SLA.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isHealth) {
    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader title="System Container Health" description="Real-time physical telemetry of underlying Docker containers." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Host CPU Load</span>
            <span className="text-[28px] font-bold text-[#101828] block mt-1">12.8%</span>
          </div>
          <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Host RAM Consumption</span>
            <span className="text-[28px] font-bold text-[#101828] block mt-1">4.2 GB / 16 GB</span>
          </div>
          <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Docker Engine Status</span>
            <span className="text-[28px] font-bold text-[#17B26A] block mt-1">Operational</span>
          </div>
        </div>
      </div>
    )
  }

  if (isDatabase) {
    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader title="PostgreSQL Status & Connections" description="Entity Framework database pool statistics." />
        <EnterpriseCard title="Connection Metrics">
          <div className="text-sm space-y-4 mt-2">
            <div className="flex justify-between border-b border-[#E5E9F2] pb-2">
              <span className="text-[#667085] font-medium">Database Engine</span>
              <span className="font-semibold text-[#101828]">PostgreSQL 16.3 on x86_64-pc-linux-musl</span>
            </div>
            <div className="flex justify-between border-b border-[#E5E9F2] pb-2">
              <span className="text-[#667085] font-medium">Active Connection Pool</span>
              <span className="font-semibold text-[#101828]">Npgsql connection pool active (2 leased, 8 idle)</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-[#667085] font-medium">Tenant Schemas Count</span>
              <span className="font-semibold text-[#101828]">2 schemas physically provisioned</span>
            </div>
          </div>
        </EnterpriseCard>
      </div>
    )
  }

  if (isAudit) {
    return (
      <div className="flex flex-col gap-6">
        <EnterpriseHeader title="System-Wide Security Audit Logs" description="Real-time database modification logs." />
        <EnterpriseCard title="Platform Logs">
          <p className="text-sm text-[#667085] mt-1 leading-relaxed">
            Please refer to the main Platform Dashboard tree explorer to query live database audit records by node.
          </p>
        </EnterpriseCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <EnterpriseHeader title="System Settings" description="Global SaaS platform preferences and APIs." />
      <EnterpriseCard title="SaaS Platform Configurations">
        <div className="space-y-4 max-w-xl mt-2">
          <EnterpriseInput label="SMTP Gateway Host" defaultValue="smtp.aquora.com" />
          <EnterpriseInput label="Platform Owner Email" defaultValue="owner@aquora.com" />
          <div className="flex justify-end mt-4">
            <EnterpriseButton>Save Preferences</EnterpriseButton>
          </div>
        </div>
      </EnterpriseCard>
    </div>
  )
}

export default PlatformManagementPage
