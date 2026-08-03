import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import BRAND from '../../config/brand'

export interface SubSidebarItem {
  label: string
  path: string
}

export interface SidebarItem {
  label: string
  path?: string
  icon: React.ReactNode
  children?: SubSidebarItem[]
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
  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>({
    Accounts: true
  })

  const toggleSubMenu = (label: string) => {
    setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-[#E5E9F2] bg-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Logo Banner */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E9F2]">
        <Link to="/company" className="flex items-center gap-2 font-bold text-lg text-slate-900 select-none">
          <img src={BRAND.logo} alt={BRAND.name} className="h-9 w-auto object-contain shrink-0" />
          {!collapsed && <span className="tracking-tight font-extrabold uppercase text-[15px] text-slate-900">{BRAND.name}</span>}
        </Link>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto select-none">
        {items.map((item) => {
          if (item.children && item.children.length > 0) {
            const isAnyChildActive = item.children.some(child => location.pathname === child.path)
            const isOpen = openSubMenus[item.label] ?? isAnyChildActive

            return (
              <div key={item.label} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleSubMenu(item.label)}
                  className={`flex items-center justify-between gap-3.5 px-3.5 py-2.5 rounded-[8px] transition-all relative cursor-pointer text-left ${isAnyChildActive
                    ? 'bg-[#EFF4FF] text-[#1A56DB] font-semibold'
                    : 'text-[#667085] hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="shrink-0">{item.icon}</div>
                    {!collapsed && <span className="text-xs tracking-wide font-bold">{item.label}</span>}
                  </div>
                  {!collapsed && (
                    <span className="text-[10px] text-slate-400">
                      {isOpen ? '▼' : '▶'}
                    </span>
                  )}
                </button>

                {(!collapsed && isOpen) && (
                  <div className="pl-9 flex flex-col gap-1 mt-0.5">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.path
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs transition-all relative ${isChildActive
                            ? 'bg-[#1A56DB] text-white font-bold shadow-sm'
                            : 'text-[#667085] hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                          <span>{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const currentFullPath = location.pathname + location.search
          const isActive = currentFullPath === item.path || (location.pathname === item.path && !location.search && !item.path?.includes('?'))
          return (
            <Link
              key={item.path}
              to={item.path || '#'}
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
