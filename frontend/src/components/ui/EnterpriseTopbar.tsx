import React from 'react'
import { Menu, Bell, LogOut } from 'lucide-react'

interface EnterpriseTopbarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  breadcrumbs?: React.ReactNode
  notificationsOpen: boolean
  onToggleNotifications: () => void
  profileMenuOpen: boolean
  onToggleProfileMenu: () => void
  user: any
  onLogout: () => void
  notificationsCount?: number
}

export const EnterpriseTopbar: React.FC<EnterpriseTopbarProps> = ({
  sidebarCollapsed: _sidebarCollapsed,
  onToggleSidebar,
  breadcrumbs,
  notificationsOpen,
  onToggleNotifications,
  profileMenuOpen,
  onToggleProfileMenu,
  user,
  onLogout,
  notificationsCount = 2
}) => {
  return (
    <header className="h-16 border-b border-[#E5E9F2] bg-white sticky top-0 z-30 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Breadcrumbs */}
        {breadcrumbs && (
          <div className="hidden md:flex items-center select-none text-xs font-semibold text-[#667085]">
            {breadcrumbs}
          </div>
        )}
      </div>

      {/* Right nav items */}
      <div className="flex items-center gap-4 select-none relative">
        {/* Notifications Icon */}
        <div className="relative">
          <button 
            onClick={onToggleNotifications}
            className="p-2 rounded-full hover:bg-slate-55 text-slate-400 hover:text-slate-600 relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {notificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#F04438] text-white font-extrabold text-[9px] rounded-full flex items-center justify-center">
                {notificationsCount}
              </span>
            )}
          </button>

          {/* Simple Dropdown list */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E5E9F2] shadow-lg py-2 rounded-[8px] text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <span className="font-semibold text-[#344054] px-4 py-2 block border-b border-[#E5E9F2] uppercase text-[10px] tracking-wider">
                Notifications
              </span>
              <div className="divide-y divide-[#E5E9F2] max-h-48 overflow-y-auto">
                <div className="p-3 hover:bg-[#EFF4FF] cursor-pointer">
                  <span className="font-semibold block text-slate-800">Batch #31 finalized</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Line A processed 12,500 L</span>
                </div>
                <div className="p-3 hover:bg-[#EFF4FF] cursor-pointer">
                  <span className="font-semibold block text-slate-800">Sales order finalized</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">1,200 cases dispatched to Apex</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu dropdown */}
        <div className="relative">
          <button 
            onClick={onToggleProfileMenu}
            className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-50 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-sm bg-[#1A56DB] text-white flex items-center justify-center font-bold text-xs uppercase">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E5E9F2] shadow-lg py-1 rounded-[8px] text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="px-4 py-2 border-b border-[#E5E9F2]">
                <span className="font-bold block text-[#101828] truncate">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate block mt-0.5">
                  {user?.roles?.[0] || 'Company Admin'}
                </span>
              </div>
              <button 
                onClick={onLogout}
                className="w-full text-left px-4 py-2.5 text-[#F04438] hover:bg-red-500/10 cursor-pointer flex items-center gap-2 font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default EnterpriseTopbar
