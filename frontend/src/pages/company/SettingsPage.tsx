import React, { useState } from 'react'
import PageContainer from '../../components/ui/layout/PageContainer'
import PageHeader from '../../components/ui/layout/PageHeader'
import { Building2, Shield, Settings2, Users } from 'lucide-react'

// Import the new settings components
import { CompanyProfileForm } from './settings/CompanyProfileForm'
import { SecuritySettings } from './settings/SecuritySettings'
import { StationConfiguration } from './settings/StationConfiguration'
import { UserSecurityStats } from './settings/UserSecurityStats'
import BackupRestorePage from '../admin/BackupRestorePage'
import { Database } from 'lucide-react'

type TabKeys = 'profile' | 'security' | 'stations' | 'user-security' | 'backup-restore'

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKeys>('profile')

  const tabs: { key: TabKeys; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Company Profile', icon: <Building2 className="w-4 h-4" /> },
    { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { key: 'stations', label: 'Station Configuration', icon: <Settings2 className="w-4 h-4" /> },
    { key: 'user-security', label: 'User Security', icon: <Users className="w-4 h-4" /> },
    { key: 'backup-restore', label: 'Backup & Restore', icon: <Database className="w-4 h-4" /> },
  ]

  return (
    <PageContainer>
      <PageHeader 
        title="Company Settings" 
        description="Manage company profile, security, and enterprise configuration." 
      />

      <div className="mt-6 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-500" />
                Administration
              </h3>
            </div>
            <nav className="p-2 flex flex-col gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={activeTab === tab.key ? 'text-blue-600' : 'text-slate-400'}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && <CompanyProfileForm />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'stations' && <StationConfiguration />}
          {activeTab === 'user-security' && <UserSecurityStats />}
          {activeTab === 'backup-restore' && <BackupRestorePage />}
        </div>
      </div>
    </PageContainer>
  )
}
