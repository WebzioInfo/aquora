import React, { useState } from 'react'
import PageContainer from '../../components/ui/layout/PageContainer'
import PageHeader from '../../components/ui/layout/PageHeader'
import { PriceListsManager } from './settings/PriceListsManager'
import { DiscountGroupsManager } from './settings/DiscountGroupsManager'
import { Settings as SettingsIcon, Tag, Percent } from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pricelists' | 'discountgroups'>('pricelists')

  return (
    <PageContainer>
      <PageHeader 
        title="Settings" 
        description="Manage company settings and configuration." 
      />

      <div className="mt-6 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-slate-500" />
                Configuration
              </h3>
            </div>
            <nav className="p-2 flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('pricelists')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'pricelists' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Tag className={`w-4 h-4 ${activeTab === 'pricelists' ? 'text-blue-600' : 'text-slate-400'}`} />
                Price Lists
              </button>
              <button
                onClick={() => setActiveTab('discountgroups')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'discountgroups' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Percent className={`w-4 h-4 ${activeTab === 'discountgroups' ? 'text-blue-600' : 'text-slate-400'}`} />
                Discount Groups
              </button>
            </nav>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'pricelists' && <PriceListsManager />}
          {activeTab === 'discountgroups' && <DiscountGroupsManager />}
        </div>
      </div>
    </PageContainer>
  )
}
