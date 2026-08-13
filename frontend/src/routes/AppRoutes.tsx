import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { authService } from '../services/auth'
import AuthLayout from '../layouts/AuthLayout'
import PlatformLayout from '../layouts/PlatformLayout'
import CompanyLayout from '../layouts/CompanyLayout'
import OperatorLayout from '../layouts/OperatorLayout'
import { QCLayout } from '../layouts/QCLayout'
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
const ProductionSetupPage = React.lazy(() => import('../pages/company/ProductionSetupPage'))
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
const PayrollPage = React.lazy(() => import('../pages/company/accounts/PayrollPage'))
const BankAccountsPage = React.lazy(() => import('../pages/company/accounts/BankAccountsPage'))
const BankAccountDetailsPage = React.lazy(() => import('../pages/company/accounts/BankAccountDetailsPage'))
const LedgerPage = React.lazy(() => import('../pages/company/accounts/LedgerPage'))
const CashBooksPage = React.lazy(() => import('../pages/company/accounts/CashBooksPage'))
const CashBookDetailsPage = React.lazy(() => import('../pages/company/accounts/CashBookDetailsPage'))
const OwnerListPage = React.lazy(() => import('../pages/company/accounts/OwnerListPage'))
const OwnerDetailsPage = React.lazy(() => import('../pages/company/accounts/OwnerDetailsPage'))
const AssetSummaryPage = React.lazy(() => import('../pages/company/accounts/AssetSummaryPage'))
const PurchasesPage = React.lazy(() => import('../pages/company/accounts/PurchasesPage'))
const CreatePurchasePage = React.lazy(() => import('../pages/company/accounts/CreatePurchasePage'))
const PurchaseDetailsPage = React.lazy(() => import('../pages/company/accounts/PurchaseDetailsPage'))
const VendorsPage = React.lazy(() => import('../pages/company/accounts/VendorsPage'))
const VendorDetailsPage = React.lazy(() => import('../pages/company/accounts/VendorDetailsPage'))
const QualityDashboardPage = React.lazy(() => import('../pages/company/qc/QualityDashboardPage').then(module => ({ default: module.QualityDashboardPage })))
const WaterTestReportsListPage = React.lazy(() => import('../pages/company/qc/WaterTestReportsListPage').then(m => ({ default: m.WaterTestReportsListPage })))
const WaterTestReportFormPage = React.lazy(() => import('../pages/company/qc/WaterTestReportFormPage').then(m => ({ default: m.WaterTestReportFormPage })))
const WaterTestReportDetailPage = React.lazy(() => import('../pages/company/qc/WaterTestReportDetailPage').then(m => ({ default: m.WaterTestReportDetailPage })))
const CompliancePage = React.lazy(() => import('../pages/company/qc/CompliancePage').then(m => ({ default: m.CompliancePage })))
const ParametersManagementPage = React.lazy(() => import('../pages/company/qc/ParametersManagementPage').then(m => ({ default: m.ParametersManagementPage })))
const QCSettingsPage = React.lazy(() => import('../pages/company/qc/QCSettingsPage').then(m => ({ default: m.QCSettingsPage })))
const BackupRestorePage = React.lazy(() => import('../pages/admin/BackupRestorePage'))
const PlatformBackupCenterPage = React.lazy(() => import('../pages/platform/PlatformBackupCenterPage'))

// Operations Issues Pages
const OperationsIssuesListPage = React.lazy(() => import('../pages/company/operations/OperationsIssuesListPage'))
const OperationsIssueDetailPage = React.lazy(() => import('../pages/company/operations/OperationsIssueDetailPage'))
const OperatorQuickReportPage = React.lazy(() => import('../pages/company/operations/OperatorQuickReportPage'))
const OperationsIssueFormPage = React.lazy(() => import('../pages/company/operations/OperationsIssueFormPage'))

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

    if (roles.includes('Owner')) return '/company/dashboard'
    if (roles.includes('CompanyAdmin')) return '/company/dashboard'
    if (roles.includes('Manager')) return '/manager/dashboard'
    if (roles.includes('Supervisor')) return '/supervisor/dashboard'
    if (roles.includes('QC')) return '/qc/dashboard'

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
    ['Owner', 'CompanyAdmin', 'GeneralManager', 'ProductionManager', 'InventoryManager', 'HRManager', 'Supervisor', 'Employee', 'Manager'].includes(role)
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

// QC Guard
const QCRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    ['QC', 'CompanyAdmin', 'Admin'].includes(role)
  )

  if (!hasAccess) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

export const AppRoutes: React.FC = () => {
  const { user, token, updateUser, clearAuth } = useAuthStore()
  const [syncing, setSyncing] = React.useState(!!token && !user)
  const [syncError, setSyncError] = React.useState<string | null>(null)
  const syncExecutedRef = React.useRef(false)

  React.useEffect(() => {
    if (!token) {
      setSyncing(false)
      return
    }

    if (syncExecutedRef.current) return
    syncExecutedRef.current = true

    let isSubscribed = true
    const timer = setTimeout(() => {
      if (isSubscribed && syncing) {
        setSyncError('Session synchronization timed out. Please retry or sign in.')
      }
    }, 8000)

    const performSync = async () => {
      try {
        const response = await authService.getSession()
        if (isSubscribed) {
          const sessionData = response.data || (response as any)
          if (response.success !== false && sessionData) {
            updateUser({
              tenantId: sessionData.tenantId,
              roles: sessionData.roles || [],
              permissions: sessionData.permissions || [],
              ownsCompany: sessionData.ownsCompany,
              isTenantInitialized: sessionData.isTenantInitialized,
              tenantStatus: sessionData.tenantStatus,
              emailVerified: sessionData.emailVerified,
              assignedProductionLineId: sessionData.assignedProductionLineId
            })
            setSyncError(null)
          } else {
            setSyncError(response.message || 'Session synchronization failed.')
          }
        }
      } catch (err: any) {
        console.error('[SESSION SYNC ERROR]:', err)
        if (isSubscribed) {
          if (err.response?.status === 401) {
            clearAuth()
          } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response) {
            setSyncError('Unable to connect to Aquzio server. Please check server status or network connection.')
          } else {
            setSyncError(err.response?.data?.message || err.message || 'Unable to synchronize your session.')
          }
        }
      } finally {
        clearTimeout(timer)
        if (isSubscribed) {
          setSyncing(false)
        }
      }
    }

    performSync()

    return () => {
      isSubscribed = false
      clearTimeout(timer)
    }
  }, [token, user, updateUser, clearAuth])

  if (syncing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900 select-none">
        <div className="flex flex-col items-center max-w-sm text-center px-6 py-8 bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50">
          <div className="w-12 h-12 mb-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
            A
          </div>
          {syncError ? (
            <>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Session Synchronization Failed</h3>
              <p className="text-xs text-slate-500 mb-6">{syncError}</p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => {
                    setSyncError(null)
                    setSyncing(true)
                    syncExecutedRef.current = false
                  }}
                  className="flex-1 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-500/20"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    clearAuth()
                    setSyncing(false)
                  }}
                  className="flex-1 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Sign In
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="text-sm font-semibold text-slate-900">Preparing your workspace...</h3>
              <p className="text-xs text-slate-400 mt-1">Securely synchronizing your session</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900 select-none">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          <Route path="backups" element={<PlatformBackupCenterPage />} />
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
          <Route path="production-setup" element={<ProductionSetupPage />} />
          <Route path="production/batches/:batchId" element={<BatchDetailsPage />} />
          <Route path="inventory" element={<CompanyDashboardPage />} />
          <Route path="sales" element={<CompanyDashboardPage />} />
          {/* Simple Accounts V1 Routes */}
          <Route path="accounts/dashboard" element={<AccountsDashboardPage />} />
          <Route path="accounts/expenses" element={<ExpenseManagementPage />} />
          <Route path="accounts/purchases" element={<PurchasesPage />} />
          <Route path="accounts/purchases/new" element={<CreatePurchasePage />} />
          <Route path="accounts/purchases/edit/:id" element={<CreatePurchasePage />} />
          <Route path="accounts/purchases/:id" element={<PurchaseDetailsPage />} />
          <Route path="accounts/vendors" element={<VendorsPage />} />
          <Route path="accounts/vendors/:id" element={<VendorDetailsPage />} />
          <Route path="accounts/payroll" element={<PayrollPage />} />
          <Route path="accounts/ledger" element={<LedgerPage />}>
            <Route index element={<Navigate to="/company/accounts/ledger/bank-accounts" replace />} />
            <Route path="bank-accounts" element={<BankAccountsPage />} />
            <Route path="cash-books" element={<CashBooksPage />} />
          </Route>
          <Route path="accounts/bank-accounts" element={<Navigate to="/company/accounts/ledger/bank-accounts" replace />} />
          <Route path="accounts/bank-accounts/:id" element={<BankAccountDetailsPage />} />
          <Route path="accounts/cash-books/:id" element={<CashBookDetailsPage />} />
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
          <Route path="backups" element={<BackupRestorePage />} />
          <Route path="operations" element={<OperationsPage />} />
          {/* Operations Issues Module */}
          <Route path="operations-issues" element={<OperationsIssuesListPage />} />
          <Route path="operations-issues/quick-report" element={<OperatorQuickReportPage />} />
          <Route path="operations-issues/new" element={<OperationsIssueFormPage />} />
          <Route path="operations-issues/:id" element={<OperationsIssueDetailPage />} />
          <Route path="operations-issues/:id/edit" element={<OperationsIssueFormPage />} />
          {/* Water Test Reports */}
          <Route path="qc/water-test" element={<WaterTestReportsListPage />} />
          <Route path="qc/water-test/new" element={<WaterTestReportFormPage />} />
          <Route path="qc/water-test/:id" element={<WaterTestReportDetailPage />} />
          <Route path="qc/water-test/:id/edit" element={<WaterTestReportFormPage />} />
        </Route>

        {/* QC Portal */}
        <Route
          path="/qc"
          element={
            <QCRoute>
              <QCLayout />
            </QCRoute>
          }
        >
          <Route index element={<Navigate to="/qc/dashboard" replace />} />
          <Route path="dashboard" element={<QualityDashboardPage />} />
          <Route path="water-tests" element={<WaterTestReportsListPage />} />
          <Route path="water-tests/new" element={<WaterTestReportFormPage />} />
          <Route path="water-tests/:id" element={<WaterTestReportDetailPage />} />
          <Route path="water-tests/:id/edit" element={<WaterTestReportFormPage />} />
          <Route path="compliance" element={<CompliancePage />} />
          <Route path="parameters" element={<ParametersManagementPage />} />
          <Route path="settings" element={<QCSettingsPage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to={user ? getDefaultRouteForUser(user) : '/login'} replace />} />
      </Routes>
    </React.Suspense>
  )
}

export default AppRoutes
