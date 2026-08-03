import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { authService } from '../services/auth'
import AuthLayout from '../layouts/AuthLayout'
import PlatformLayout from '../layouts/PlatformLayout'
import CompanyLayout from '../layouts/CompanyLayout'
import OperatorLayout from '../layouts/OperatorLayout'
import FinanceDashboardPage from '../pages/company/finance/FinanceDashboardPage'
import ChartOfAccountsPage from '../pages/company/finance/ChartOfAccountsPage'
import JournalEntriesPage from '../pages/company/finance/JournalEntriesPage'
import BusinessFinanceDashboard from '../pages/company/business-finance/BusinessFinanceDashboard'
const LoginPage = React.lazy(() => import('../pages/LoginPage'))
const RegisterPage = React.lazy(() => import('../pages/RegisterPage'))
const OtpVerificationPage = React.lazy(() => import('../pages/OtpVerificationPage'))
const CompanyOnboardingPage = React.lazy(() => import('../pages/CompanyOnboardingPage'))
const PlatformDashboardPage = React.lazy(() => import('../pages/platform/PlatformDashboardPage'))
const PlatformManagementPage = React.lazy(() => import('../pages/platform/PlatformManagementPage'))
const SettingsPage = React.lazy(() => import('../pages/company/SettingsPage').then(module => ({ default: module.SettingsPage })))
const CompanyDashboardPage = React.lazy(() => import('../pages/company/CompanyDashboardPage'))
const BatchDetailsPage = React.lazy(() => import('../pages/company/BatchDetailsPage'))
const OperatorDashboardPage = React.lazy(() => import('../pages/operator/OperatorDashboardPage'))
const ProductSelectionPage = React.lazy(() => import('../pages/operator/ProductSelectionPage'))
const JarDashboardPage = React.lazy(() => import('../pages/operator/JarDashboardPage'))
const InviteTeamPage = React.lazy(() => import('../pages/InviteTeamPage'))
const AccessDeniedPage = React.lazy(() => import('../pages/AccessDeniedPage'))
const OperationsPage = React.lazy(() => import('../pages/company/OperationsPage'))
const ProvisioningPage = React.lazy(() => import('../pages/ProvisioningPage'))

// Simple Accounts V1 Pages
const AccountsDashboardPage = React.lazy(() => import('../pages/company/accounts/AccountsDashboardPage'))
const ExpenseManagementPage = React.lazy(() => import('../pages/company/accounts/ExpenseManagementPage'))
const BankAccountsPage = React.lazy(() => import('../pages/company/accounts/BankAccountsPage'))
const BankAccountDetailsPage = React.lazy(() => import('../pages/company/accounts/BankAccountDetailsPage'))
const OwnerListPage = React.lazy(() => import('../pages/company/accounts/OwnerListPage'))
const OwnerDetailsPage = React.lazy(() => import('../pages/company/accounts/OwnerDetailsPage'))
const AssetSummaryPage = React.lazy(() => import('../pages/company/accounts/AssetSummaryPage'))

export const getDefaultRouteForUser = (user: any): string => {
  const getRoute = () => {
    if (!user) return '/login'
    if (!user.emailVerified) {
      return '/verify-otp'
    }

    if (user.tenantId && !user.isTenantInitialized) {
      return '/account-setup'
    }

    const roles = user.roles || []
    
    if (roles.some((r: string) => ['SuperAdmin', 'PlatformAdmin', 'SupportEngineer', 'PlatformOwner'].includes(r))) {
      return '/platform/dashboard'
    }
    
    if (!user.tenantId) {
      return '/onboarding'
    }
    
    if (roles.includes('Operator')) return '/operator/product-selection'
    if (roles.includes('Worker')) return '/worker/dashboard'
    if (roles.some((r: string) => ['Store Keeper', 'StoreKeeper', 'STORE_KEEPER'].includes(r))) return '/store/dashboard'
    if (roles.includes('Sales')) return '/sales/dashboard'
    
    if (roles.includes('CompanyAdmin')) return '/company/dashboard'
    if (roles.includes('Manager')) return '/manager/dashboard'
    if (roles.includes('Supervisor')) return '/supervisor/dashboard'
    
    return '/company/dashboard'
  }
  const targetRoute = getRoute();
  console.log(`[REDIRECT DECISION]: Target route resolved to '${targetRoute}' for user ${user?.email} with roles: ${JSON.stringify(user?.roles)}`);
  return targetRoute;
}

// Guest Guard (Login, Register, OTP checks)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (isAuthenticated && user) {
    if (!user.emailVerified) {
      if (window.location.pathname === '/verify-otp') {
        return <>{children}</>
      }
      return <Navigate to="/verify-otp" replace state={{ email: user.email }} />
    }
    return <Navigate to={getDefaultRouteForUser(user)} replace />
  }

  return <>{children}</>
}

// Onboarding Guard
const OnboardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-otp" replace state={{ email: user.email }} />
  }

  if (user.isTenantInitialized) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />
  }

  const path = window.location.pathname
  if (user.tenantId && !user.isTenantInitialized && path !== '/account-setup') {
    return <Navigate to="/account-setup" replace />
  }

  if (!user.tenantId && path === '/account-setup') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

// Platform Portal Guard (SuperAdmin / PlatformAdmin / SupportEngineer)
const PlatformRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const roles = user.roles || []
  const hasAccess = roles.some(role => 
    ['SuperAdmin', 'PlatformAdmin', 'SupportEngineer', 'PlatformOwner'].includes(role)
  )

  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

// Company Portal Guard (CompanyAdmin, managers, corporate roles)
const CompanyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-otp" replace state={{ email: user.email }} />
  }

  if (user.tenantId && !user.isTenantInitialized) {
    return <Navigate to="/account-setup" replace />
  }

  if (!user.tenantId || !user.isTenantInitialized) {
    return <Navigate to="/onboarding" replace />
  }

  const roles = user.roles || []
  const hasAccess = roles.some(role => 
    ['CompanyAdmin', 'GeneralManager', 'ProductionManager', 'InventoryManager', 'HRManager', 'Supervisor', 'Employee', 'Manager'].includes(role)
  )

  if (!hasAccess && (roles.includes('Operator') || roles.some((r: string) => ['Store Keeper', 'StoreKeeper', 'STORE_KEEPER'].includes(r)) || roles.includes('Sales') || roles.includes('HR'))) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />
  }

  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

// Operator Terminal Guard
const OperatorRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-otp" replace state={{ email: user.email }} />
  }

  if (user.tenantId && !user.isTenantInitialized) {
    return <Navigate to="/account-setup" replace />
  }

  if (!user.tenantId || !user.isTenantInitialized) {
    return <Navigate to="/onboarding" replace />
  }

  const roles = user.roles || []
  const hasAccess = roles.some(role => 
    ['Operator', 'Store Keeper', 'StoreKeeper', 'STORE_KEEPER', 'Sales', 'HR'].includes(role)
  )

  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

export const AppRoutes: React.FC = () => {
  const { user, token, updateUser, clearAuth } = useAuthStore()
  const [syncing, setSyncing] = React.useState(!!token)

  React.useEffect(() => {
    const performSync = async () => {
      if (token) {
        try {
          const response = await authService.getSession()
          if (response.success && response.data) {
            updateUser({
              tenantId: response.data.tenantId,
              roles: response.data.roles,
              permissions: response.data.permissions,
              ownsCompany: response.data.ownsCompany,
              isTenantInitialized: response.data.isTenantInitialized,
              tenantStatus: response.data.tenantStatus,
              emailVerified: response.data.emailVerified,
              assignedProductionLineId: response.data.assignedProductionLineId
            })
          }
        } catch (err: any) {
          console.error('[SESSION SYNC ERROR]:', err)
          if (err.response?.status === 401) {
            clearAuth()
          }
        } finally {
          setSyncing(false)
        }
      } else {
        setSyncing(false)
      }
    }

    performSync()
  }, [token, updateUser, clearAuth])

  if (syncing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19] text-white select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Synchronizing Session...</div>
        </div>
      </div>
    )
  }

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19] text-white">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={user ? getDefaultRouteForUser(user) : '/login'} replace />} />

      {/* Guest Auth & Onboarding */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/verify-otp"
          element={
            <PublicRoute>
              <OtpVerificationPage />
            </PublicRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <CompanyOnboardingPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/invite-team"
          element={
            <OnboardingRoute>
              <InviteTeamPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/account-setup"
          element={
            <OnboardingRoute>
              <ProvisioningPage />
            </OnboardingRoute>
          }
        />
      </Route>

      {/* Access Denied */}
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* Operator/Worker Portals */}
      <Route
        path="/operator"
        element={
          <OperatorRoute>
            <OperatorLayout />
          </OperatorRoute>
        }
      >
        <Route index element={<Navigate to="/operator/product-selection" replace />} />
        <Route path="product-selection" element={<ProductSelectionPage />} />
        <Route path="production-allocation" element={<OperatorDashboardPage />} />
        <Route path="dashboard" element={<OperatorDashboardPage />} />
        <Route path="jar" element={<JarDashboardPage />} />
      </Route>

      <Route
        path="/worker"
        element={
          <OperatorRoute>
            <OperatorLayout />
          </OperatorRoute>
        }
      >
        <Route index element={<Navigate to="/worker/dashboard" replace />} />
        <Route path="dashboard" element={<OperatorDashboardPage />} />
      </Route>



      <Route
        path="/store"
        element={
          <OperatorRoute>
            <OperatorLayout />
          </OperatorRoute>
        }
      >
        <Route index element={<Navigate to="/store/dashboard" replace />} />
        <Route path="dashboard" element={<OperatorDashboardPage />} />
      </Route>

      <Route
        path="/sales"
        element={
          <OperatorRoute>
            <OperatorLayout />
          </OperatorRoute>
        }
      >
        <Route index element={<Navigate to="/sales/dashboard" replace />} />
        <Route path="dashboard" element={<OperatorDashboardPage />} />
      </Route>




      <Route
        path="/manager"
        element={
          <CompanyRoute>
            <CompanyLayout />
          </CompanyRoute>
        }
      >
        <Route index element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboardPage />} />
        <Route path="*" element={<CompanyDashboardPage />} />
      </Route>

      <Route
        path="/supervisor"
        element={
          <CompanyRoute>
            <CompanyLayout />
          </CompanyRoute>
        }
      >
        <Route index element={<Navigate to="/supervisor/dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboardPage />} />
        <Route path="*" element={<CompanyDashboardPage />} />
      </Route>



      {/* Platform Administration Portal */}
      <Route
        path="/platform"
        element={
          <PlatformRoute>
            <PlatformLayout />
          </PlatformRoute>
        }
      >
        <Route index element={<Navigate to="/platform/dashboard" replace />} />
        <Route path="dashboard" element={<PlatformDashboardPage />} />
        <Route path="tenants" element={<PlatformManagementPage />} />
        <Route path="users" element={<PlatformManagementPage />} />
        <Route path="subscriptions" element={<PlatformManagementPage />} />
        <Route path="system-health" element={<PlatformManagementPage />} />
        <Route path="database" element={<PlatformManagementPage />} />
        <Route path="audit" element={<PlatformManagementPage />} />
        <Route path="settings" element={<PlatformManagementPage />} />
      </Route>

      <Route
        path="/company"
        element={
          <CompanyRoute>
            <CompanyLayout />
          </CompanyRoute>
        }
      >
        <Route index element={<Navigate to="/company/dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboardPage />} />
        <Route path="production" element={<CompanyDashboardPage />} />
        <Route path="production/batches/:batchId" element={<BatchDetailsPage />} />
        <Route path="inventory" element={<CompanyDashboardPage />} />
        <Route path="sales" element={<CompanyDashboardPage />} />
        {/* Simple Accounts V1 Routes */}
        <Route path="accounts/dashboard" element={<AccountsDashboardPage />} />
        <Route path="accounts/expenses" element={<ExpenseManagementPage />} />
        <Route path="accounts/bank-accounts" element={<BankAccountsPage />} />
        <Route path="accounts/bank-accounts/:id" element={<BankAccountDetailsPage />} />
        <Route path="accounts/owners" element={<OwnerListPage />} />
        <Route path="accounts/owners/:id" element={<OwnerDetailsPage />} />
        <Route path="accounts/assets" element={<AssetSummaryPage />} />
        <Route path="business-finance" element={<BusinessFinanceDashboard />} />
        <Route path="finance" element={<FinanceDashboardPage />} />
        <Route path="finance/accounts" element={<ChartOfAccountsPage />} />
        <Route path="finance/journals" element={<JournalEntriesPage />} />
        <Route path="customers" element={<CompanyDashboardPage />} />
        <Route path="customers/profile/:customerId" element={<CompanyDashboardPage />} />
        <Route path="suppliers" element={<CompanyDashboardPage />} />
        <Route path="employees" element={<CompanyDashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="operations" element={<OperationsPage />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to={user ? getDefaultRouteForUser(user) : '/login'} replace />} />
    </Routes>
    </React.Suspense>
  )
}

export default AppRoutes
