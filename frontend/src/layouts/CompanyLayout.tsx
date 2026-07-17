import React, { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { useNotificationStore } from '../store/useNotificationStore'
import ToastContainer from '../components/ui/ToastContainer'
import { 
  LayoutDashboard, Factory, Package, TrendingUp, Users, Truck, 
  Settings, ChevronRight, Play, Plus
} from 'lucide-react'
import EnterpriseSidebar from '../components/ui/EnterpriseSidebar'
import EnterpriseTopbar from '../components/ui/EnterpriseTopbar'
import EnterpriseModal from '../components/ui/EnterpriseModal'

export const CompanyLayout: React.FC = () => {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme, initTheme } = useThemeStore()
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
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

  const sidebarItems = [
    { label: 'Dashboard', path: '/company/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Production', path: '/company/production', icon: <Factory className="w-5 h-5" /> },
    { label: '20L Operations', path: '/company/operations', icon: <Truck className="w-5 h-5" /> },
    { label: 'Inventory', path: '/company/inventory', icon: <Package className="w-5 h-5" /> },
    { label: 'Sales', path: '/company/sales', icon: <TrendingUp className="w-5 h-5" /> },
    { label: 'Business Partners', path: '/company/customers', icon: <Users className="w-5 h-5" /> },
    { label: 'Suppliers', path: '/company/suppliers', icon: <Truck className="w-5 h-5" /> },
    { label: 'Employees', path: '/company/employees', icon: <Users className="w-5 h-5" /> },
    { label: 'Company Settings', path: '/company/settings', icon: <Settings className="w-5 h-5" /> },
  ]

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(x => x)
    return (
      <div className="flex items-center select-none text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
        <Link to="/company" className="hover:text-[#111827] transition-colors">
          Aquaflow ERP
        </Link>
        {paths.map((path, idx) => {
          const isLast = idx === paths.length - 1
          const url = `/${paths.slice(0, idx + 1).join('/')}`
          const formattedName = path.charAt(0).toUpperCase() + path.slice(1)
          
          return (
            <span key={url} className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] mx-1 shrink-0" />
              {isLast ? (
                <span className="text-[#111827] font-bold">{formattedName}</span>
              ) : (
                <Link to={url} className="text-[#6B7280] hover:text-[#111827] transition-colors">
                  {formattedName}
                </Link>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  const triggerQuickAction = (actionName: string) => {
    showToast(`Quick Action triggered: ${actionName}`, 'success')
    setShowQuickActions(false)
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
          breadcrumbs={getBreadcrumbs()}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)}
          profileMenuOpen={profileMenuOpen}
          onToggleProfileMenu={() => setProfileMenuOpen(!profileMenuOpen)}
          user={user}
          onLogout={handleLogout}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-6 relative">
          {/* Quick Actions Portal Trigger Floating Button or Topbar Hook */}
          <div className="absolute right-6 top-0 -translate-y-12 select-none z-30">
            <button
              onClick={() => setShowQuickActions(true)}
              className="px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm rounded-[10px] h-[42px] cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Actions</span>
            </button>
          </div>

          <Outlet />
        </main>
      </div>

      {/* Reusable Enterprise Modal */}
      <EnterpriseModal
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        title="Quick Actions Portal"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
          <button onClick={() => triggerQuickAction('Create Production Batch')} className="p-3 bg-slate-50 dark:bg-slate-850 hover:bg-hydro-navy/5 dark:hover:bg-hydro-azure/10 text-left border border-slate-200 dark:border-slate-800 flex items-center gap-3 cursor-pointer rounded-sm">
            <Play className="w-5 h-5 text-hydro-navy dark:text-hydro-azure" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-hydro-navy dark:text-white">Create Batch</span>
              <span className="text-[10px] text-slate-400">Initialize a water run</span>
            </div>
          </button>
          <button onClick={() => triggerQuickAction('Create Sales Order')} className="p-3 bg-slate-50 dark:bg-slate-855 hover:bg-hydro-navy/5 dark:hover:bg-hydro-azure/10 text-left border border-slate-200 dark:border-slate-800 flex items-center gap-3 cursor-pointer rounded-sm">
            <TrendingUp className="w-5 h-5 text-hydro-navy dark:text-hydro-azure" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-hydro-navy dark:text-white">Sales Order</span>
              <span className="text-[10px] text-slate-400">Bill a wholesale buyer</span>
            </div>
          </button>
          <button onClick={() => triggerQuickAction('Receive Materials')} className="p-3 bg-slate-50 dark:bg-slate-855 hover:bg-hydro-navy/5 dark:hover:bg-hydro-azure/10 text-left border border-slate-200 dark:border-slate-800 flex items-center gap-3 cursor-pointer rounded-sm">
            <Package className="w-5 h-5 text-hydro-navy dark:text-hydro-azure" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-hydro-navy dark:text-white">Receive Stock</span>
              <span className="text-[10px] text-slate-400">Accept raw materials</span>
            </div>
          </button>
        </div>
      </EnterpriseModal>

      <ToastContainer />
    </div>
  )
}
export default CompanyLayout
