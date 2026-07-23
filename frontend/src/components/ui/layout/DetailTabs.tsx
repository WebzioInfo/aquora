import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface DetailTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const DetailTabs: React.FC<DetailTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="sticky top-0 z-10 bg-[#F8FAFC] pt-2 pb-0 mb-4 border-b border-slate-200">
      <div className="flex gap-1 overflow-x-auto scrollbar-none w-full">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 min-w-[120px] pb-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 cursor-pointer ${
                isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DetailTabs;
