import React from 'react'
import { Menu, Bell, LogOut } from 'lucide-react'
import BRAND from '../../config/brand'

export interface TopbarNotificationItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  reportedByName: string;
  reportedAt: string;
  machineName?: string;
  productionLineName?: string;
}

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
  notificationsList?: TopbarNotificationItem[]
  onNotificationClick?: (id: string) => void
  onMarkAllRead?: () => void
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
  notificationsCount = 0,
  notificationsList = [],
  onNotificationClick,
  onMarkAllRead
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
      </div>

      {/* Right nav items */}
      <div className="flex items-center gap-4 select-none relative">
        <div className="hidden md:flex flex-col text-right select-none mr-1">
          <span className="text-xs font-bold text-[#101828]">
            {user?.companyName || user?.tenantName || BRAND.name}
          </span>
          <span className="text-[10px] font-medium text-slate-500">
            {user?.firstName} {user?.lastName} • {user?.roles?.[0] || 'User'}
          </span>
        </div>

        {/* Notifications Icon */}
        <div className="relative">
          <button 
            onClick={onToggleNotifications}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 relative cursor-pointer transition-colors"
          >
            <Bell className="w-5 h-5" />
            {notificationsCount > 0 && (
              <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-[#F04438] text-white font-black text-[9px] rounded-full flex items-center justify-center animate-pulse shadow-sm min-w-[18px]">
                {notificationsCount > 99 ? '99+' : notificationsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E5E9F2] shadow-xl rounded-[12px] text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-[#E5E9F2] flex items-center justify-between">
                <span className="font-extrabold text-[#344054] uppercase text-[10px] tracking-wider">
                  Unread Incidents ({notificationsCount})
                </span>
                {notificationsCount > 0 && onMarkAllRead && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#E5E9F2] max-h-72 overflow-y-auto">
                {notificationsList.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-[11px] italic">
                    No unread operations notifications.
                  </div>
                ) : (
                  notificationsList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNotificationClick && onNotificationClick(item.id)}
                      className="p-3 hover:bg-amber-50/70 cursor-pointer transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{item.title}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          item.priority === 'Critical' || item.priority === 'Emergency' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {item.category} {item.machineName ? `• ${item.machineName}` : ''}
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                        <span>Reported by {item.reportedByName}</span>
                        <span>{new Date(item.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                )}
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
