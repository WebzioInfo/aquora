import React from 'react'
import { List, Package, Wrench, BarChart3 } from 'lucide-react'

export type AssetTabKey = 'register' | 'stock' | 'maintenance' | 'reports'

interface AssetTabsProps {
  activeTab: AssetTabKey
  onTabChange: (tab: AssetTabKey) => void
  totalAssetsCount?: number
  attentionCount?: number
}

interface TabDefinition {
  key: AssetTabKey
  label: string
  icon: React.ElementType
  badge?: number
}

export const AssetTabs: React.FC<AssetTabsProps> = ({
  activeTab,
  onTabChange,
  totalAssetsCount = 0,
  attentionCount = 0
}) => {
  const tabs: TabDefinition[] = [
    {
      key: 'register',
      label: 'Register',
      icon: List,
      badge: totalAssetsCount > 0 ? totalAssetsCount : undefined
    },
    {
      key: 'stock',
      label: 'Stock valuation',
      icon: Package
    },
    {
      key: 'maintenance',
      label: 'Maintenance and warranty',
      icon: Wrench,
      badge: attentionCount > 0 ? attentionCount : undefined
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: BarChart3
    }
  ]

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIdx = (index + 1) % tabs.length
      onTabChange(tabs[nextIdx].key)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIdx = (index - 1 + tabs.length) % tabs.length
      onTabChange(tabs[prevIdx].key)
    }
  }

  return (
    <div className="border-b border-[#E5E9F2] shrink-0 select-none overflow-x-auto no-scrollbar">
      <div
        role="tablist"
        aria-label="Asset Management Sections"
        className="flex items-center gap-5 min-w-max"
      >
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.key
          const Icon = tab.icon

          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.key)}
              onKeyDown={e => handleKeyDown(e, idx)}
              className={`flex items-center gap-2 pb-2.5 text-[13px] font-medium transition-all relative cursor-pointer outline-none ${
                isActive
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full leading-none font-semibold ${
                    tab.key === 'maintenance' && tab.badge > 0
                      ? 'bg-amber-100 text-amber-800'
                      : isActive
                      ? 'bg-slate-200 text-slate-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}

              {/* 2px Underline in blue accent color */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1A56DB] rounded-t" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AssetTabs
