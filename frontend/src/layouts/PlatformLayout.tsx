import React, { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { useNotificationStore } from '../store/useNotificationStore'
import ToastContainer from '../components/ui/ToastContainer'
import { 
  LayoutDashboard, Building2, Users, CreditCard, HeartPulse, Database, 
  History, Settings, ChevronRight, Archive
} from 'lucide-react'
import EnterpriseSidebar from '../components/ui/EnterpriseSidebar'
import EnterpriseTopbar from '../components/ui/EnterpriseTopbar'

export const PlatformLayout: React.FC = () => {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme, initTheme } = useThemeStore()
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  useEffect(() => {
    initTheme()
  }, [])

  const handleLogout = () => {
    clearAuth()
    showToast('Successfully logged out.', 'info')
    navigate('/login')
  }

  // Platform admin sidebar items
  const sidebarItems = [
    { label: 'Platform Dashboard', path: '/platform/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Tenants Manager', path: '/platform/tenants', icon: <Building2 className="w-5 h-5" /> },
    { label: 'Users Directory', path: '/platform/users', icon: <Users className="w-5 h-5" /> },
    { label: 'Subscriptions', path: '/platform/subscriptions', icon: <CreditCard className="w-5 h-5" /> },
    { label: 'System Health', path: '/platform/system-health', icon: <HeartPulse className="w-5 h-5" /> },
    { label: 'Database Status', path: '/platform/database', icon: <Database className="w-5 h-5" /> },
    { label: 'Disaster Recovery', path: '/platform/backups', icon: <Archive className="w-5 h-5" /> },
    { label: 'Audit Trails', path: '/platform/audit', icon: <History className="w-5 h-5" /> },
    { label: 'Settings', path: '/platform/settings', icon: <Settings className="w-5 h-5" /> },
  ]

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(x => x)
    return (
      <div className="flex items-center select-none text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <Link to="/platform/dashboard" className="hover:text-brand-primary dark:hover:text-white transition-colors">
          Platform Console
        </Link>
        {paths.map((path, idx) => {
          const isLast = idx === paths.length - 1
          const url = `/${paths.slice(0, idx + 1).join('/')}`
          const formattedName = path.charAt(0).toUpperCase() + path.slice(1)
          
          return (
            <span key={url} className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-1 shrink-0" />
              {isLast ? (
                <span className="text-brand-primary dark:text-white font-bold">{formattedName}</span>
              ) : (
                <Link to={url} className="text-slate-400 hover:text-brand-primary transition-colors">
                  {formattedName}
                </Link>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] text-[#101828]">
      
      {/* Reusable Enterprise Sidebar */}
      <EnterpriseSidebar 
        collapsed={sidebarCollapsed}
        items={sidebarItems}
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      {/* Main Panel Viewport */}
      <div 
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ paddingLeft: sidebarCollapsed ? '80px' : '256px' }}
      >
        {/* Reusable Enterprise Topbar */}
        <EnterpriseTopbar 
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)}
          profileMenuOpen={profileMenuOpen}
          onToggleProfileMenu={() => setProfileMenuOpen(!profileMenuOpen)}
          user={user}
          onLogout={handleLogout}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-6 relative">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
export default PlatformLayout
