import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut, Sun, Moon, Droplet } from 'lucide-react'

interface SidebarItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface EnterpriseSidebarProps {
  collapsed: boolean
  items: SidebarItem[]
  user: any
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogout: () => void
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  collapsed,
  items,
  user,
  theme,
  onToggleTheme,
  onLogout
}) => {
  const location = useLocation()

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-[#E5E9F2] bg-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Logo Banner */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-[#E5E9F2]">
        <Link to="/company" className="flex items-center gap-2.5 font-bold text-lg text-[#1A56DB] select-none">
          <div className="w-8 h-8 rounded-sm bg-[#1A56DB] flex items-center justify-center text-white shrink-0">
            <Droplet className="w-5 h-5 fill-white" />
          </div>
          {!collapsed && <span className="tracking-tight font-extrabold uppercase text-[15px]">Aquaflow ERP</span>}
        </Link>
      </div>

      {/* User profile card */}
      <div className="p-4 border-b border-[#E5E9F2] flex items-center gap-3 overflow-hidden select-none">
        <div className="w-10 h-10 rounded-sm bg-[#EFF4FF] text-[#1A56DB] flex items-center justify-center font-bold text-sm shrink-0 uppercase">
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-none text-[#101828]">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] font-bold text-slate-455 truncate mt-1 uppercase tracking-wide">
              {user?.roles?.[0] || 'Company Admin'}
            </p>
          </div>
        )}
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-220px)] select-none">
        {items.map((item) => {
          const currentFullPath = location.pathname + location.search
          const isActive = currentFullPath === item.path || (location.pathname === item.path && !location.search && !item.path.includes('?'))
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-[8px] transition-all relative ${isActive
                  ? 'bg-[#EFF4FF] text-[#1A56DB] font-semibold pl-4'
                  : 'text-[#667085] hover:bg-slate-50 hover:text-slate-800'
                }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] bg-[#1A56DB] rounded-r-md" />
              )}
              <div className="shrink-0">{item.icon}</div>
              {!collapsed && <span className="text-xs tracking-wide">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom controls */}
      <div className="p-3 border-t border-[#E5E9F2] flex flex-col gap-1 select-none">
        <button
          onClick={onLogout}
          className="flex items-center gap-3.5 w-full px-3.5 py-2.5 rounded text-xs font-semibold text-error hover:bg-red-500/10 cursor-pointer transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}

export default EnterpriseSidebar
