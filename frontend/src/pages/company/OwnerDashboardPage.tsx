import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package, DollarSign, AlertTriangle, AlertCircle, RefreshCw,
  TrendingDown, ArrowUpRight, ChevronRight, Users,
  ShieldAlert, FileText, Activity, Factory, Info,
  Droplets, Box, BarChart3
} from 'lucide-react'
import { api } from '../../services/api'
import { twentyLService } from '../../services/twentyL'
import { simpleAccountsService } from '../../services/simpleAccounts'
import { salesService } from '../../services/sales'
import { rawMaterialsService } from '../../services/rawMaterials'
import { productsService } from '../../services/products'
import { useAuthStore } from '../../store/useAuthStore'
import PageContainer from '../../components/ui/layout/PageContainer'

// ============================================================
// TRANSLATION DICTIONARY — EN / ML (Malayalam)
// ============================================================
type Lang = 'en' | 'ml'

const T: Record<string, Record<Lang, string>> = {
  // Header
  businessOverview:     { en: 'Business Overview',                    ml: 'ബിസിനസ് ചുരുക്കം' },
  ownerView:            { en: 'Owner View',                           ml: 'ഉടമ വ്യൂ' },
  refreshData:          { en: 'Refresh Data',                         ml: 'ഡാറ്റ പുതുക്കുക' },
  refreshing:           { en: 'Refreshing...',                        ml: 'പുതുക്കുന്നു...' },
  operationsHub:        { en: '20L Operations',                       ml: '20L പ്രവർത്തനങ്ങൾ' },
  transparencyNote:     { en: 'Some numbers shown here are from operations and haven\'t been added to the official accounts book yet.', ml: 'ഇവിടെ കാണിക്കുന്ന ചില സംഖ്യകൾ പ്രവർത്തനങ്ങളിൽ നിന്നുള്ളതാണ്, ഇത് ഇതുവരെ ഔദ്യോഗിക അക്കൗണ്ട്‌സ് ബുക്കിൽ ചേർത്തിട്ടില്ല.' },
  note:                 { en: 'Note:',                                ml: 'കുറിപ്പ്:' },

  // Time filter
  today:                { en: 'Today',                                ml: 'ഇന്ന്' },
  thisWeek:             { en: 'This Week',                            ml: 'ഈ ആഴ്ച' },
  thisMonth:            { en: 'This Month',                           ml: 'ഈ മാസം' },

  // KPI cards
  totalSales:           { en: 'Total Sales',                          ml: 'ആകെ വിൽപ്പന' },
  cashCollected:        { en: 'Cash Collected',                       ml: 'പിരിച്ച പണം' },
  moneyOwed:            { en: 'Money Owed To Us',                     ml: 'ഞങ്ങൾക്ക് കിട്ടാനുള്ള പണം' },
  productionOutput:     { en: 'Production Output',                    ml: 'ഉൽപ്പാദന ഫലം' },
  jarMovement:          { en: 'Jar Movement',                         ml: 'ജാർ ചലനം' },
  stockHealth:          { en: 'Stock Health',                         ml: 'സ്റ്റോക്ക് സ്ഥിതി' },

  // KPI sub-labels
  fromSales:            { en: 'From sales & supplies',                ml: 'വിൽപ്പനയിൽ നിന്ന്' },
  waitingToAdd:         { en: 'Waiting to be added to accounts',      ml: 'അക്കൗണ്ട്‌സിൽ ചേർക്കാനുള്ളത്' },
  fromDistributors:     { en: 'From distributors',                    ml: 'ഡിസ്ട്രിബ്യൂട്ടർമാരിൽ നിന്ന്' },
  debtors:              { en: 'Debtors',                              ml: 'കടക്കാർ' },
  activeBatches:        { en: 'Active Batches',                       ml: 'നടക്കുന്ന ബാച്ചുകൾ' },
  filledJars:           { en: 'filled jars',                          ml: 'നിറച്ച ജാറുകൾ' },
  out:                  { en: 'out',                                  ml: 'പുറത്ത്' },
  back:                 { en: 'back',                                 ml: 'തിരികെ' },
  netMovement:          { en: 'Net:',                                 ml: 'മൊത്തം:' },
  orders:               { en: 'orders',                               ml: 'ഓർഡറുകൾ' },
  allGood:              { en: 'All Good',                             ml: 'എല്ലാം ശരി' },
  lowStock:             { en: 'Low Stock',                            ml: 'സ്റ്റോക്ക് കുറവ്' },
  auditNeeded:          { en: 'Count Needed',                         ml: 'എണ്ണം വേണം' },

  // Sales section
  salesTitle:           { en: 'Sales',                                ml: 'വിൽപ്പന' },
  salesDesc:            { en: 'Revenue and orders for the selected period.',   ml: 'തിരഞ്ഞെടുത്ത കാലയളവിലെ വരുമാനവും ഓർഡറുകളും.' },
  totalRevenue:         { en: 'Total Revenue',                        ml: 'ആകെ വരുമാനം' },
  totalOrders:          { en: 'Total Orders',                         ml: 'ആകെ ഓർഡറുകൾ' },
  collected:            { en: 'Collected',                            ml: 'പിരിച്ചത്' },
  stillOwed:            { en: 'Still Owed',                           ml: 'ഇനിയും കിട്ടാനുള്ളത്' },
  dispatches:           { en: 'Dispatches',                           ml: 'അയച്ചവ' },
  returns:              { en: 'Returns',                              ml: 'മടക്കിയവ' },
  damages:              { en: 'Damages',                              ml: 'നഷ്ടപ്പെട്ടവ' },
  viewAllSales:         { en: 'View All Sales',                       ml: 'എല്ലാ വിൽപ്പനയും കാണുക' },

  // Production section
  productionTitle:      { en: 'Production',                           ml: 'ഉൽപ്പാദനം' },
  productionDesc:       { en: 'Bottling and manufacturing activity.', ml: 'ബോട്ടിലിങ്, ഉൽപ്പാദന പ്രവർത്തനങ്ങൾ.' },
  batchesCompleted:     { en: 'Batches Run',                          ml: 'ബാച്ചുകൾ നടത്തി' },
  totalProduced:        { en: 'Total Produced',                       ml: 'ആകെ ഉൽപ്പാദിപ്പിച്ചത്' },
  jarsUnit:             { en: 'jars',                                 ml: 'ജാറുകൾ' },
  noActiveBatches:      { en: 'No batches running right now',         ml: 'ഇപ്പോൾ ബാച്ചുകളൊന്നും നടക്കുന്നില്ല' },
  plantIdle:            { en: 'Plant is currently idle or shifts have ended.',  ml: 'പ്ലാന്റ് ഇപ്പോൾ നിശ്ചലമാണ് അല്ലെങ്കിൽ ഷിഫ്റ്റ് തീർന്നു.' },
  productionNote:       { en: 'Production output needs to be manually checked before dispatch until auto-sync is set up.',  ml: 'ഓട്ടോ-സിങ്ക് സെറ്റപ്പ് ചെയ്യുന്നത് വരെ ഉൽപ്പാദന ഔട്ട്‌പുട്ട് ഡിസ്‌പാച്ചിന് മുമ്പ് സ്വമേധയാ പരിശോധിക്കണം.' },
  viewProduction:       { en: 'Production Setup',                     ml: 'ഉൽപ്പാദന സെറ്റപ്പ്' },
  bottlingActive:       { en: 'Bottling Active',                      ml: 'ബോട്ടിലിങ് നടക്കുന്നു' },
  line:                 { en: 'Line',                                 ml: 'ലൈൻ' },
  operator:             { en: 'Operator',                             ml: 'ഓപ്പറേറ്റർ' },
  jarsOutput:           { en: 'Jars output',                          ml: 'ജാർ ഔട്ട്‌പുട്ട്' },

  // Accounts section
  accountsTitle:        { en: 'Accounts & Collections',               ml: 'അക്കൗണ്ട്‌സ് & പിരിവ്' },
  accountsDesc:         { en: 'Cash flow and outstanding balances.',   ml: 'പണ ഒഴുക്കും ബാക്കി തുകയും.' },
  cashInHand:           { en: 'Cash in Hand',                         ml: 'കയ്യിലുള്ള പണം' },
  bankBalance:          { en: 'Bank Balance',                         ml: 'ബാങ്ക് ബാലൻസ്' },
  expenses:             { en: 'Expenses',                             ml: 'ചെലവുകൾ' },
  topOwed:              { en: 'Who Owes Us the Most',                 ml: 'ഏറ്റവും കൂടുതൽ കടമുള്ളവർ' },
  totalOwed:            { en: 'Total owed to us:',                    ml: 'ആകെ ഞങ്ങൾക്ക് കിട്ടാനുള്ളത്:' },
  jarsHeld:             { en: 'jars held',                            ml: 'ജാറുകൾ പിടിച്ചിട്ടുണ്ട്' },
  noDebtors:            { en: 'No one owes us right now.',            ml: 'ഇപ്പോൾ ആരും ഞങ്ങൾക്ക് കടം തരാനില്ല.' },
  viewAccounts:         { en: 'View Accounts',                        ml: 'അക്കൗണ്ട്‌സ് കാണുക' },

  // Stock section
  stockTitle:           { en: 'Stock at a Glance',                    ml: 'സ്റ്റോക്ക് ചുരുക്കം' },
  twentyLOverview:      { en: '20L Jar Overview',                     ml: '20L ജാർ ചുരുക്കം' },
  totalJars:            { en: 'Total Jars in System',                 ml: 'സിസ്റ്റത്തിലെ ആകെ ജാറുകൾ' },
  filled:               { en: 'Filled',                               ml: 'നിറച്ചത്' },
  empty:                { en: 'Empty',                                ml: 'ശൂന്യം' },
  inCirculation:        { en: 'In Circulation',                       ml: 'വിതരണത്തിൽ' },
  damaged:              { en: 'Damaged',                              ml: 'കേടായത്' },
  noJarData:            { en: 'Jar balances not set up yet',          ml: 'ജാർ ബാലൻസ് ഇതുവരെ സെറ്റ് ചെയ്തിട്ടില്ല' },
  jarsNotCounted:       { en: 'Jars not counted yet',                 ml: 'ജാറുകൾ ഇതുവരെ എണ്ണിയിട്ടില്ല' },
  viewJarDetails:       { en: 'Full Jar Details',                     ml: 'മുഴുവൻ ജാർ വിവരങ്ങൾ' },
  rawMaterialStock:     { en: 'Raw Materials',                        ml: 'അസംസ്കൃത വസ്തുക്കൾ' },
  productStock:         { en: 'Finished Products',                    ml: 'തയ്യാറായ ഉൽപ്പന്നങ്ങൾ' },
  noRawMaterials:       { en: 'No raw materials added yet',           ml: 'അസംസ്കൃത വസ്തുക്കൾ ഇതുവരെ ചേർത്തിട്ടില്ല' },
  noProducts:           { en: 'No products added yet',                ml: 'ഉൽപ്പന്നങ്ങൾ ഇതുവരെ ചേർത്തിട്ടില്ല' },
  inStock:              { en: 'in stock',                             ml: 'സ്റ്റോക്കിൽ' },
  viewAll:              { en: 'View All',                             ml: 'എല്ലാം കാണുക' },

  // Alerts section
  alertsTitle:          { en: 'Needs Your Attention',                 ml: 'ശ്രദ്ധ വേണം' },
  alertsDesc:           { en: 'Things that need action today.',       ml: 'ഇന്ന് ചെയ്യേണ്ട കാര്യങ്ങൾ.' },
  priorityFeed:         { en: 'Priority',                             ml: 'മുൻഗണന' },
  stockCountOverdue:    { en: 'No Stock Count Done Yet',              ml: 'സ്റ്റോക്ക് എണ്ണം ഇതുവരെ എടുത്തിട്ടില്ല' },
  stockCountDesc:       { en: 'No physical jar count has been done this month. Without counting, you can\'t know if any jars are missing.',  ml: 'ഈ മാസം ജാറുകളുടെ ഫിസിക്കൽ എണ്ണം എടുത്തിട്ടില്ല. എണ്ണം എടുക്കാതെ ജാറുകൾ കാണാതായോ എന്ന് അറിയാൻ കഴിയില്ല.' },
  openJarLedger:        { en: 'Open Jar Ledger',                      ml: 'ജാർ ലെഡ്ജർ തുറക്കുക' },
  unpostedCash:         { en: 'Cash Waiting To Be Added',             ml: 'ചേർക്കാൻ ബാക്കിയുള്ള പണം' },
  unpostedCashDesc:     { en: 'Cash collected from today\'s deliveries and distributor supplies is not yet in the accounts book.', ml: 'ഇന്നത്തെ ഡെലിവറികളിൽ നിന്നും ഡിസ്ട്രിബ്യൂട്ടർ സപ്ലൈയിൽ നിന്നും ശേഖരിച്ച പണം ഇതുവരെ അക്കൗണ്ട്‌സ് ബുക്കിൽ ചേർത്തിട്ടില്ല.' },
  reviewCashBook:       { en: 'Review Cash Book',                     ml: 'ക്യാഷ് ബുക്ക് പരിശോധിക്കുക' },
  jarsInQuarantine:     { en: 'Jars in Quarantine',                   ml: 'ക്വാറന്റൈനിലുള്ള ജാറുകൾ' },
  quarantineDesc:       { en: 'Cracked or dirty jars kept aside. Decide if they can be fixed or need to be thrown away.',  ml: 'പൊട്ടിയതോ വൃത്തിയല്ലാത്തതോ ആയ ജാറുകൾ മാറ്റിവെച്ചിരിക്കുന്നു. അവ ശരിയാക്കാനാകുമോ അതോ ഉപേക്ഷിക്കണമോ എന്ന് തീരുമാനിക്കുക.' },
  inspectQuarantine:    { en: 'Inspect Quarantine',                   ml: 'ക്വാറന്റൈൻ പരിശോധിക്കുക' },

  // Shortcuts
  shortcuts:            { en: 'Quick Links',                          ml: 'ദ്രുത ലിങ്കുകൾ' },
  twentyLSupplies:      { en: '20L Supplies',                         ml: '20L സപ്ലൈ' },
  accountsCash:         { en: 'Accounts & Cash',                      ml: 'അക്കൗണ്ട്‌സ് & ക്യാഷ്' },
  reports:              { en: 'Reports',                              ml: 'റിപ്പോർട്ടുകൾ' },
  customers:            { en: 'Customers',                            ml: 'കസ്റ്റമർമാർ' },
}

// helper
const t = (key: string, lang: Lang): string => T[key]?.[lang] ?? T[key]?.en ?? key

// ============================================================
// DATE RANGE HELPERS
// ============================================================
type Period = 'today' | 'week' | 'month'

function getPeriodDates(period: Period): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  const todayStr = fmt(now)

  if (period === 'today') return { start: todayStr, end: todayStr }

  if (period === 'week') {
    const dayOfWeek = now.getDay() // 0=Sun
    const monday = new Date(y, m, d - ((dayOfWeek + 6) % 7))
    return { start: fmt(monday), end: todayStr }
  }

  // month
  return { start: `${y}-${pad(m + 1)}-01`, end: todayStr }
}

function isDateInPeriod(dateStr: string | undefined | null, period: Period): boolean {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  const { start, end } = getPeriodDates(period)
  return d >= start && d <= end
}

// ============================================================
// COMPONENT
// ============================================================
export const OwnerDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Language toggle — persisted to localStorage
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('aquzio_owner_lang') as Lang) || 'en'
  })
  useEffect(() => { localStorage.setItem('aquzio_owner_lang', lang) }, [lang])

  // Period filter
  const [period, setPeriod] = useState<Period>('today')

  // ========================================
  // DATA FETCHING
  // ========================================

  // 1. Plant balances (jar positions)
  const { data: plantBalances, refetch: refetchBalances } = useQuery({
    queryKey: ['ownerPlantBalances'],
    queryFn: twentyLService.getPlantBalances,
    staleTime: 30000
  })

  // 2. Distributor accounts (receivables)
  const { data: distributorAccounts = [], refetch: refetchDistributors } = useQuery({
    queryKey: ['ownerDistributors'],
    queryFn: twentyLService.getDistributorAccounts,
    staleTime: 30000
  })

  // 3. Distributor supplies (period-wide fetch — we filter client-side)
  const { data: suppliesResponse, refetch: refetchSupplies } = useQuery({
    queryKey: ['ownerSupplies'],
    queryFn: async () => {
      const res = await api.get('/api/v1/20l/distributor-supplies?pageSize=200')
      return res.data?.data || { items: [] }
    },
    staleTime: 30000
  })

  // 4. Active production batches
  const { data: activeBatches = [], refetch: refetchBatches } = useQuery({
    queryKey: ['ownerActiveBatches'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production/batches/active')
      return res.data?.data || []
    },
    staleTime: 30000
  })

  // 5. Accounts dashboard summary
  const { data: accountsSummary, refetch: refetchAccounts } = useQuery({
    queryKey: ['ownerAccountsSummary'],
    queryFn: simpleAccountsService.getDashboardSummary,
    staleTime: 30000
  })

  // 6. Sales transactions — large fetch for period aggregation
  const { data: salesData, refetch: refetchSales } = useQuery({
    queryKey: ['ownerSalesAll'],
    queryFn: async () => {
      const res = await salesService.getTransactions(1, 500, '', '', '', '', '', '', '', 'newest')
      return res?.data?.items || []
    },
    staleTime: 30000
  })

  // 7. Raw materials
  const { data: rawMaterialsData, refetch: refetchRawMaterials } = useQuery({
    queryKey: ['ownerRawMaterials'],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(1, 100)
      return res?.data?.items || []
    },
    staleTime: 60000
  })

  // 8. Products (finished goods)
  const { data: productsData, refetch: refetchProducts } = useQuery({
    queryKey: ['ownerProducts'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100)
      return res?.data?.items || []
    },
    staleTime: 60000
  })

  // Refresh all
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([
      refetchBalances(), refetchDistributors(), refetchSupplies(),
      refetchBatches(), refetchAccounts(), refetchSales(),
      refetchRawMaterials(), refetchProducts()
    ])
    setIsRefreshing(false)
  }, [refetchBalances, refetchDistributors, refetchSupplies, refetchBatches, refetchAccounts, refetchSales, refetchRawMaterials, refetchProducts])

  // ========================================
  // DERIVED — PERIOD-AWARE
  // ========================================

  // Supplies in period
  const suppliesInPeriod = useMemo(() => {
    const items = suppliesResponse?.items || []
    return items.filter((s: any) => isDateInPeriod(s.createdAt || s.dispatchedAt, period))
  }, [suppliesResponse, period])

  // Sales in period
  const salesInPeriod = useMemo(() => {
    return (salesData || []).filter((s: any) => isDateInPeriod(s.transactionDate || s.createdAt, period))
  }, [salesData, period])

  // -- Sales KPIs --
  const salesKpi = useMemo(() => {
    let totalRevenue = 0, totalCollected = 0, orderCount = 0
    let dispatchCount = 0, returnCount = 0, damageCount = 0

    salesInPeriod.forEach((s: any) => {
      const type = (s.transactionType || '').toUpperCase()
      if (type === 'DISPATCH' || type === 'SALE' || type === 'DELIVERY') {
        totalRevenue += Number(s.totalAmount) || 0
        totalCollected += Number(s.amountReceived) || 0
        dispatchCount++
      }
      if (type === 'RETURN' || type === 'SALES_RETURN') returnCount += Number(s.cases) || 0
      if (type === 'DAMAGE' || type === 'DAMAGE_REPORT') damageCount += Number(s.cases) || 0
      orderCount++
    })
    return {
      totalRevenue, totalCollected,
      outstanding: totalRevenue - totalCollected,
      orderCount, dispatchCount, returnCount, damageCount
    }
  }, [salesInPeriod])

  // -- Cash from distributor supplies in period --
  const cashFromSupplies = useMemo(() => {
    return suppliesInPeriod.reduce((sum: number, s: any) => sum + (Number(s.amountPaid) || 0), 0)
  }, [suppliesInPeriod])

  const totalOperationalCash = cashFromSupplies + salesKpi.totalCollected

  // -- Jar movement in period --
  const jarsSupplied = useMemo(() => {
    return suppliesInPeriod.reduce((sum: number, s: any) => sum + (Number(s.quantitySupplied) || 0), 0)
  }, [suppliesInPeriod])

  const emptiesReturned = useMemo(() => {
    return suppliesInPeriod.reduce((sum: number, s: any) => sum + (Number(s.quantityEmptyReturned) || 0), 0)
  }, [suppliesInPeriod])

  const netJarMovement = jarsSupplied - emptiesReturned

  // -- Plant balances (static / non-period) --
  const plantFilled = plantBalances?.plant?.filledAvailable ?? 0
  const plantEmpty = plantBalances?.plant?.emptyReusable ?? 0
  const withDistributors = plantBalances?.field?.withDistributors ?? 0
  const onVehicles = plantBalances?.field?.onVehicles ?? 0
  const withCustomers = plantBalances?.field?.withCustomers ?? 0
  const damagedQuarantine = plantBalances?.plant?.damagedQuarantined ?? 0
  const totalSystemJars = plantBalances?.grandTotalSystemJars ?? 0
  const totalInCirculation = withDistributors + onVehicles + withCustomers

  // -- Receivables --
  const totalReceivable = useMemo(() => {
    return (distributorAccounts || []).reduce((sum: number, d: any) => sum + (Number(d.commercial?.netReceivable) || 0), 0)
  }, [distributorAccounts])

  const topDebtors = useMemo(() => {
    return [...(distributorAccounts || [])]
      .filter((d: any) => (d.commercial?.netReceivable || 0) > 0)
      .sort((a: any, b: any) => (b.commercial?.netReceivable || 0) - (a.commercial?.netReceivable || 0))
      .slice(0, 5)
  }, [distributorAccounts])

  // -- Raw materials & products --
  const rawMaterials = rawMaterialsData || []
  const products = productsData || []

  const lowStockRawMaterials = useMemo(() => {
    return (rawMaterialsData || []).filter((rm: any) => (Number(rm.currentStock) || 0) <= 10 && rm.isActive)
  }, [rawMaterialsData])

  // Stock health flag
  const stockHealthStatus = useMemo(() => {
    if (totalSystemJars === 0) return 'audit'
    if (lowStockRawMaterials.length > 0) return 'low'
    return 'good'
  }, [totalSystemJars, lowStockRawMaterials])

  // ========================================
  // RENDER HELPERS
  // ========================================
  const L = (key: string) => t(key, lang)
  const curr = (n: number) => `₹${n.toLocaleString('en-IN')}`

  const periodLabels: Record<Period, string> = {
    today: L('today'),
    week: L('thisWeek'),
    month: L('thisMonth')
  }

  // ========================================
  // JSX
  // ========================================
  return (
    <PageContainer>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {L('businessOverview')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  {L('ownerView')}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {user?.fullName ? `${user.fullName} • ` : ''}{user?.companyName || user?.tenantName || 'Aquzio'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Time-range filter */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
              {(['today', 'week', 'month'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    period === p
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ml' : 'en')}
              className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200"
            >
              {lang === 'en' ? 'മല' : 'EN'}
            </button>

            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? L('refreshing') : L('refreshData')}</span>
            </button>
            <button
              onClick={() => navigate('/company/operations')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <span>{L('operationsHub')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Transparency Notice */}
        <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-bold">{L('note')}</strong> {L('transparencyNote')}
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">

        {/* Total Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('totalSales')}</span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><BarChart3 className="w-4 h-4" /></div>
            </div>
            <div className="text-2xl font-black text-slate-900">{curr(salesKpi.totalRevenue)}</div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{salesKpi.orderCount} {L('orders')}</span>
            <span className="text-slate-400 font-medium">{L('fromSales')}</span>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('cashCollected')}</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
            </div>
            <div className="text-2xl font-black text-slate-900">{curr(totalOperationalCash)}</div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{L('fromSales')}</span>
            <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">{L('waitingToAdd')}</span>
          </div>
        </div>

        {/* Money Owed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('moneyOwed')}</span>
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown className="w-4 h-4" /></div>
            </div>
            <div className="text-2xl font-black text-slate-900">{curr(totalReceivable)}</div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{L('fromDistributors')}</span>
            <span className="text-rose-600 font-bold">{topDebtors.length} {L('debtors')}</span>
          </div>
        </div>

        {/* Production Output */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('productionOutput')}</span>
              <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg"><Factory className="w-4 h-4" /></div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {plantFilled}
              <span className="text-xs font-semibold text-slate-400 ml-1">{L('filledJars')}</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{L('activeBatches')}:</span>
            <span className="font-bold text-cyan-700">{activeBatches.length}</span>
          </div>
        </div>

        {/* Jar Movement */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('jarMovement')}</span>
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Package className="w-4 h-4" /></div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{jarsSupplied}</span>
              <span className="text-xs font-semibold text-slate-400">{L('out')} /</span>
              <span className="text-lg font-bold text-emerald-600">{emptiesReturned}</span>
              <span className="text-xs font-semibold text-slate-400">{L('back')}</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{L('netMovement')}</span>
            <span className={`font-bold ${netJarMovement > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
              {netJarMovement > 0 ? `+${netJarMovement}` : `${netJarMovement}`}
            </span>
          </div>
        </div>

        {/* Stock Health */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('stockHealth')}</span>
              <div className={`p-1.5 rounded-lg ${
                stockHealthStatus === 'good' ? 'bg-emerald-50 text-emerald-600' :
                stockHealthStatus === 'low' ? 'bg-amber-50 text-amber-600' :
                'bg-rose-50 text-rose-600'
              }`}>
                <Box className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-lg font-black ${
              stockHealthStatus === 'good' ? 'text-emerald-700' :
              stockHealthStatus === 'low' ? 'text-amber-700' :
              'text-rose-700'
            }`}>
              {stockHealthStatus === 'good' ? L('allGood') : stockHealthStatus === 'low' ? L('lowStock') : L('auditNeeded')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{totalSystemJars} {L('totalJars').toLowerCase()}</span>
            {lowStockRawMaterials.length > 0 && (
              <span className="font-bold text-amber-600">{lowStockRawMaterials.length} {L('lowStock').toLowerCase()}</span>
            )}
          </div>
        </div>

      </div>

      {/* ── SALES + PRODUCTION (TWO COLUMNS) ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* SALES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                {L('salesTitle')}
              </h2>
              <p className="text-xs text-slate-500">{L('salesDesc')}</p>
            </div>
            <button
              onClick={() => navigate('/company/sales')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {L('viewAllSales')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sales summary grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
              <span className="text-[11px] font-bold text-blue-800 block">{L('totalRevenue')}</span>
              <div className="text-lg font-black text-blue-950 mt-0.5">{curr(salesKpi.totalRevenue)}</div>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-800 block">{L('collected')}</span>
              <div className="text-lg font-black text-emerald-950 mt-0.5">{curr(salesKpi.totalCollected)}</div>
            </div>
            <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl">
              <span className="text-[11px] font-bold text-rose-800 block">{L('stillOwed')}</span>
              <div className="text-lg font-black text-rose-950 mt-0.5">{curr(salesKpi.outstanding)}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-700 block">{L('totalOrders')}</span>
              <div className="text-lg font-black text-slate-900 mt-0.5">{salesKpi.orderCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {salesKpi.dispatchCount} {L('dispatches')} • {salesKpi.returnCount} {L('returns')} • {salesKpi.damageCount} {L('damages')}
              </div>
            </div>
          </div>
        </div>

        {/* PRODUCTION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Factory className="w-5 h-5 text-cyan-600" />
                {L('productionTitle')}
              </h2>
              <p className="text-xs text-slate-500">{L('productionDesc')}</p>
            </div>
            <button
              onClick={() => navigate('/company/production-setup')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {L('viewProduction')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeBatches.length > 0 ? (
            <div className="space-y-2.5">
              {activeBatches.slice(0, 3).map((b: any) => (
                <div key={b.id || b.batchId} className="p-3 bg-cyan-50/40 border border-cyan-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>Batch #{b.batchNumber || b.code || 'B-ACTIVE'}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">{L('bottlingActive')}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {L('line')}: {b.productionLineName || '20L Auto Line'} • {L('operator')}: {b.operatorName || 'Plant Operator'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-cyan-900 text-sm">{b.casesProduced || b.outputCases || 0}</span>
                    <span className="text-[10px] text-slate-500 block">{L('jarsOutput')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              <Factory className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">{L('noActiveBatches')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{L('plantIdle')}</p>
            </div>
          )}

          {/* Production footnote */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{L('productionNote')}</span>
          </div>
        </div>
      </div>

      {/* ── ACCOUNTS & COLLECTIONS (FULL WIDTH) ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              {L('accountsTitle')}
            </h2>
            <p className="text-xs text-slate-500">{L('accountsDesc')}</p>
          </div>
          <button
            onClick={() => navigate('/company/accounts/dashboard')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            {L('viewAccounts')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Summary cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <span className="text-[11px] font-bold text-emerald-800 block">{L('cashInHand')}</span>
            <div className="text-lg font-black text-emerald-950 mt-0.5">{curr(accountsSummary?.cashBalance ?? 0)}</div>
          </div>
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
            <span className="text-[11px] font-bold text-blue-800 block">{L('bankBalance')}</span>
            <div className="text-lg font-black text-blue-950 mt-0.5">{curr(accountsSummary?.totalBankBalance ?? 0)}</div>
          </div>
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
            <span className="text-[11px] font-bold text-amber-800 block">{L('expenses')}</span>
            <div className="text-lg font-black text-amber-950 mt-0.5">{curr(accountsSummary?.thisMonthExpense ?? 0)}</div>
            <span className="text-[10px] text-amber-700">{L('thisMonth')}</span>
          </div>
        </div>

        {/* Top debtors */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{L('topOwed')}</span>
          {topDebtors.length > 0 ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {topDebtors.map((d: any) => (
                <div key={d.customerId} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-bold text-slate-900">{d.customerName}</div>
                    <div className="text-[11px] text-slate-400">
                      {d.physical?.totalJarsHeld || 0} {L('jarsHeld')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-rose-600">{curr(Number(d.commercial?.netReceivable || 0))}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-medium">
              {L('noDebtors')}
            </div>
          )}
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
          <span>{L('totalOwed')} <strong>{curr(totalReceivable)}</strong></span>
        </div>
      </div>

      {/* ── STOCK ROW (3 COMPACT CARDS) ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
          <Package className="w-5 h-5 text-blue-600" />
          {L('stockTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 20L Jar Overview */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-blue-600" />
                {L('twentyLOverview')}
              </span>
              <button
                onClick={() => navigate('/company/operations')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {L('viewJarDetails')} →
              </button>
            </div>

            {totalSystemJars > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{L('totalJars')}</span>
                  <span className="text-sm font-black text-slate-900">{totalSystemJars.toLocaleString('en-IN')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-sm font-black text-blue-700">{plantFilled}</div>
                    <span className="text-[10px] text-slate-500">{L('filled')}</span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-sm font-black text-emerald-700">{plantEmpty}</div>
                    <span className="text-[10px] text-slate-500">{L('empty')}</span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-sm font-black text-purple-700">{totalInCirculation}</div>
                    <span className="text-[10px] text-slate-500">{L('inCirculation')}</span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg text-center">
                    <div className="text-sm font-black text-rose-700">{damagedQuarantine}</div>
                    <span className="text-[10px] text-slate-500">{L('damaged')}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-center">
                <p className="text-xs font-bold text-amber-800">{L('noJarData')}</p>
              </div>
            )}
          </div>

          {/* Raw Materials */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-amber-600" />
                {L('rawMaterialStock')}
              </span>
              <button
                onClick={() => navigate('/company/raw-materials')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {L('viewAll')} →
              </button>
            </div>

            {rawMaterials.length > 0 ? (
              <div className="space-y-1.5">
                {rawMaterials.slice(0, 5).map((rm: any) => {
                  const stock = Number(rm.currentStock) || 0
                  const isLow = stock <= 10 && rm.isActive
                  return (
                    <div key={rm.id} className="flex items-center justify-between text-xs p-1.5 bg-white border border-slate-200 rounded-lg">
                      <span className="font-medium text-slate-700 truncate mr-2">{rm.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{stock} {rm.unit}</span>
                        {isLow && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      </div>
                    </div>
                  )
                })}
                {rawMaterials.length > 5 && (
                  <p className="text-[10px] text-slate-400 text-center">+{rawMaterials.length - 5} more</p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-100 rounded-lg text-center">
                <p className="text-xs text-slate-500">{L('noRawMaterials')}</p>
              </div>
            )}
          </div>

          {/* Finished Products */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                {L('productStock')}
              </span>
              <button
                onClick={() => navigate('/company/products')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {L('viewAll')} →
              </button>
            </div>

            {products.length > 0 ? (
              <div className="space-y-1.5">
                {products.slice(0, 5).map((p: any) => {
                  const stock = Number(p.currentStock) || 0
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs p-1.5 bg-white border border-slate-200 rounded-lg">
                      <span className="font-medium text-slate-700 truncate mr-2">{p.name}</span>
                      <span className="font-bold text-slate-900 shrink-0">{stock} {L('inStock')}</span>
                    </div>
                  )
                })}
                {products.length > 5 && (
                  <p className="text-[10px] text-slate-400 text-center">+{products.length - 5} more</p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-100 rounded-lg text-center">
                <p className="text-xs text-slate-500">{L('noProducts')}</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── ALERTS STRIP ───────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              {L('alertsTitle')}
            </h2>
            <p className="text-xs text-slate-500">{L('alertsDesc')}</p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            {L('priorityFeed')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">

          {/* Stock Count */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{L('stockCountOverdue')}</span>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">{L('stockCountDesc')}</p>
            </div>
            <button
              onClick={() => navigate('/company/operations')}
              className="self-start px-3 py-1.5 text-xs font-bold bg-white text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              {L('openJarLedger')}
            </button>
          </div>

          {/* Unposted Cash */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span>{curr(totalOperationalCash)} — {L('unpostedCash')}</span>
              </div>
              <p className="text-xs text-blue-900 mt-1 leading-relaxed">{L('unpostedCashDesc')}</p>
            </div>
            <button
              onClick={() => navigate('/company/accounts/dashboard')}
              className="self-start px-3 py-1.5 text-xs font-bold bg-white text-blue-900 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {L('reviewCashBook')}
            </button>
          </div>

          {/* Quarantine */}
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{damagedQuarantine} {L('jarsInQuarantine')}</span>
              </div>
              <p className="text-xs text-rose-900 mt-1 leading-relaxed">{L('quarantineDesc')}</p>
            </div>
            <button
              onClick={() => navigate('/company/operations')}
              className="self-start px-3 py-1.5 text-xs font-bold bg-white text-rose-900 border border-rose-300 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
            >
              {L('inspectQuarantine')}
            </button>
          </div>

        </div>
      </div>

      {/* ── QUICK SHORTCUTS ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{L('shortcuts')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/company/operations')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" /> {L('twentyLSupplies')}
            </button>
            <button onClick={() => navigate('/company/sales')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" /> {L('salesTitle')}
            </button>
            <button onClick={() => navigate('/company/production-setup')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-cyan-600" /> {L('viewProduction')}
            </button>
            <button onClick={() => navigate('/company/accounts/dashboard')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> {L('accountsCash')}
            </button>
            <button onClick={() => navigate('/company/customers')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" /> {L('customers')}
            </button>
            <button onClick={() => navigate('/company/reports')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" /> {L('reports')}
            </button>
          </div>
        </div>
      </div>

    </PageContainer>
  )
}

export default OwnerDashboardPage
