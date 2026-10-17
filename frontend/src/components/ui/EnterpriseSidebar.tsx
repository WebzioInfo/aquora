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
  badge?: number | string
  pulseBadge?: boolean
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
  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>({})

  // Automatically keep submenu open if any child route is active
  React.useEffect(() => {
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        const isAnyChildActive = item.children.some(child => location.pathname === child.path || location.pathname.startsWith(child.path + '/'))
        if (isAnyChildActive) {
          setOpenSubMenus(prev => ({ ...prev, [item.label]: true }))
        }
      }
    })
  }, [location.pathname, items])

  const toggleSubMenu = (label: string) => {
    setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-[#E5E9F2] bg-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Logo Banner */}
      <div className="h-16 flex items-center px-5 border-b border-[#E5E9F2]">
        <Link to="/company" className="flex items-center select-none" title="Aquzio">
          {collapsed ? (
            <img src={BRAND.iconLight} alt={BRAND.name} className="h-7 w-7 object-contain shrink-0 mx-auto" />
          ) : (
            <img src={BRAND.logo} alt={BRAND.name} className="h-7 w-auto object-contain shrink-0" />
          )}
        </Link>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto select-none">
        {items.map((item) => {
          if (item.children && item.children.length > 0) {
            const isAnyChildActive = item.children.some(child => location.pathname === child.path)
            const isOpen = !!openSubMenus[item.label]

            return (
              <div key={item.label} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleSubMenu(item.label)}
                  className={`flex items-center justify-between gap-3.5 px-3.5 py-2.5 rounded-[8px] transition-all relative cursor-pointer text-left ${isAnyChildActive
                    ? 'bg-[#E6F6F4] text-[#05303B] font-semibold'
                    : 'text-[#5B6B75] hover:bg-[#F4F7F8] hover:text-[#05303B]'
                    }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`shrink-0 ${isAnyChildActive ? 'text-[#0B7A70]' : ''}`}>{item.icon}</div>
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
                            ? 'bg-[#05303B] text-white font-bold shadow-xs'
                            : 'text-[#5B6B75] hover:bg-[#F4F7F8] hover:text-[#05303B]'
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
          const isExactFullPathMatch = currentFullPath === item.path
          const isExactBasePathMatch = location.pathname === item.path && !item.path?.includes('?')
          const hasAnotherExactFullPathMatch = !isExactFullPathMatch && items.some((other: any) => other.path === currentFullPath)

          const isActive = isExactFullPathMatch ||
            (!hasAnotherExactFullPathMatch && isExactBasePathMatch) ||
            (!!item.path && item.path !== '/' && item.path !== '/company' && item.path !== '/company/dashboard' && item.path !== '/qc' && item.path !== '/qc/dashboard' && location.pathname.startsWith(item.path + '/'))
          return (
            <Link
              key={item.path}
              to={item.path || '#'}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-[8px] transition-all relative ${isActive
                ? 'bg-[#E6F6F4] text-[#05303B] font-semibold pl-4'
                : 'text-[#5B6B75] hover:bg-[#F4F7F8] hover:text-[#05303B]'
                }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] bg-[#12A89A] rounded-r-md" />
              )}
              <div className={`shrink-0 relative ${isActive ? 'text-[#0B7A70]' : ''}`}>
                {item.icon}
                {collapsed && item.badge !== undefined && item.badge !== null && item.badge !== 0 && (
                  <span
                    className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white ${
                      item.pulseBadge ? 'animate-pulse' : ''
                    }`}
                  />
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs tracking-wide">{item.label}</span>
                  {item.badge !== undefined && item.badge !== null && item.badge !== 0 && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full text-white bg-red-600 shadow-sm flex items-center justify-center min-w-[20px] ${
                        item.pulseBadge ? 'animate-pulse ring-2 ring-red-300' : ''
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom controls */}
      <div className="p-3 border-t border-[#E5E9F2] flex flex-col gap-1 select-none">
        <Link
          to="/profile"
          className="flex items-center gap-3.5 w-full px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          title="My Profile"
        >
          <div className="w-5 h-5 rounded-md bg-[#05303B] text-white flex items-center justify-center text-[10px] font-bold shrink-0 uppercase">
            {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          {!collapsed && (
            <div className="flex flex-col text-left truncate">
              <span className="truncate text-xs font-bold text-slate-800">{user?.firstName ? `${user?.firstName} ${user?.lastName || ''}`.trim() : 'My Profile'}</span>
              <span className="text-[10px] text-slate-400 font-medium truncate">Account Profile</span>
            </div>
          )}
        </Link>
        <button
          onClick={onLogout}
          className="flex items-center gap-3.5 w-full px-3.5 py-2 rounded text-xs font-semibold text-error hover:bg-red-500/10 cursor-pointer transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}

export default EnterpriseSidebar
