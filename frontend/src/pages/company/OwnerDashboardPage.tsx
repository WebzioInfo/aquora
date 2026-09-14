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
  countRequired:        { en: 'Count Required',                       ml: 'എണ്ണൽ ആവശ്യമാണ്' },
  initialCountNeeded:   { en: 'Initial count needed — baseline not established', ml: 'ആദ്യ എണ്ണൽ ആവശ്യമാണ്' },
  creditInvoicePending: { en: 'Uncollected (credit invoice)',         ml: 'കടം (പിരിക്കാനുള്ളത്)' },
  idleToday:            { en: 'Bottled today (Plant idle today)',     ml: 'ഇന്ന് ഉൽപ്പാദനം നടന്നില്ല' },
  inProgressActive:     { en: 'in progress',                          ml: 'നടപ്പിലുള്ളവ' },

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
  completedBatches:     { en: 'Completed Batches',                    ml: 'പൂർത്തിയായ ബാച്ചുകൾ' },
  recentCompleted:      { en: 'Recent Completed Batches',             ml: 'സമീപകാലത്ത് പൂർത്തിയായ ബാച്ചുകൾ' },
  line:                 { en: 'Line',                                 ml: 'ലൈൻ' },
  operator:             { en: 'Operator',                             ml: 'ഓപ്പറേറ്റർ' },
  jarsOutput:           { en: 'Jars output',                          ml: 'ജാർ ഔട്ട്‌പുട്ട്' },

  // Accounts section
  accountsTitle:        { en: 'Accounts & Collections',               ml: 'അക്കൗണ്ട്‌സ് & പിരിവ്' },
  accountsDesc:         { en: 'Cash flow and outstanding balances.',   ml: 'പണ ഒഴുക്കും ബാക്കി തുകയും.' },
  cashInHand:           { en: 'Cash in Hand',                         ml: 'കയ്യിലുള്ള പണം' },
  bankBalance:          { en: 'Bank Balance',                         ml: 'ബാങ്ക് ബാലൻസ്' },
  totalFunds:           { en: 'Total Available Funds',                ml: 'ലഭ്യമായ ആകെ പണം' },
  expenses:             { en: 'Expenses',                             ml: 'ചെലവുകൾ' },
  topOwed:              { en: 'Who Owes Us the Most',                 ml: 'ഏറ്റവും കൂടുതൽ കടമുള്ളവർ' },
  totalOwed:            { en: 'Total owed to us:',                    ml: 'ആകെ ഞങ്ങൾക്ക് കിട്ടാനുള്ളത്:' },
  jarsHeld:             { en: 'jars held',                            ml: 'ജാറുകൾ പിടിച്ചിട്ടുണ്ട്' },
  noDebtors:            { en: 'No one owes us right now.',            ml: 'ഇപ്പോൾ ആരും ഞങ്ങൾക്ക് കടം തരാനില്ല.' },
  viewAccounts:         { en: 'View Accounts',                        ml: 'അക്കൗണ്ട്‌സ് കാണുക' },
  customer:             { en: 'Customer',                             ml: 'കസ്റ്റമർ' },
  distributor:          { en: 'Distributor',                          ml: 'ഡിസ്ട്രിബ്യൂട്ടർ' },
  noMovementsInPeriod:  { en: 'No jar movements in this period',      ml: 'ഈ കാലയളവിൽ ജാർ ചലനങ്ങളില്ല' },

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

  // Error handling & diagnostics
  errorLoading:         { en: 'Failed to load',                       ml: 'ഡാറ്റ ലഭിച്ചില്ല' },
  errorNoticeTitle:     { en: 'Some dashboard data failed to load',   ml: 'ചില വിവരങ്ങൾ ലോഡ് ചെയ്യാനായില്ല' },
  errorNoticeDesc:      { en: 'One or more backend queries returned an error. Failed sections are highlighted below with retry options.', ml: 'ഒന്നോ അതിലധികമോ ബാക്കെൻഡ് ക്വറികൾ പരാജയപ്പെട്ടു. പരാജയപ്പെട്ട ഭാഗങ്ങൾ താഴെ അടയാളപ്പെടുത്തിയിരിക്കുന്നു.' },
  retry:                { en: 'Retry',                                ml: 'വീണ്ടും ശ്രമിക്കുക' },
  retryAll:             { en: 'Retry All',                            ml: 'എല്ലാം വീണ്ടും ശ്രമിക്കുക' },
  serverError:          { en: 'Server or network error occurred while loading this data.', ml: 'ഈ ഡാറ്റ ലോഡ് ചെയ്യുമ്പോൾ സെർവർ അല്ലെങ്കിൽ നെറ്റ്‌വർക്ക് തകരാർ ഉണ്ടായി.' },
  unableToCalculate:    { en: 'Unable to calculate due to query error', ml: 'ക്വറി പിശക് കാരണം കണക്കാക്കാനായില്ല' },
  databaseSchemaError:  { en: 'Database table or relation missing. Please ensure all tenant migrations have run.', ml: 'ഡാറ്റാബേസ് ടേബിൾ കണ്ടെത്താനായില്ല. എല്ലാ മൈഗ്രേഷനുകളും നടന്നിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക.' },
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
  const periodDates = useMemo(() => getPeriodDates(period), [period])

  // ========================================
  // DATA FETCHING (With full error tracking)
  // ========================================

  // 1. Authoritative plant balances (jar positions projection)
  const {
    data: plantBalances,
    isError: isBalancesError,
    error: balancesError,
    refetch: refetchBalances
  } = useQuery({
    queryKey: ['ownerPlantBalances'],
    queryFn: twentyLService.getPlantBalances,
    staleTime: 30000,
    retry: 1
  })

  // 2. Distributor accounts (receivables)
  const {
    data: distributorAccounts = [],
    isError: isDistributorsError,
    error: distributorsError,
    refetch: refetchDistributors
  } = useQuery({
    queryKey: ['ownerDistributors'],
    queryFn: twentyLService.getDistributorAccounts,
    staleTime: 30000,
    retry: 1
  })

  // 3. Authoritative Jar Movements Summary for Selected Period
  const {
    data: jarMovementData,
    isError: isJarMovementsError,
    error: jarMovementsError,
    refetch: refetchJarMovements
  } = useQuery({
    queryKey: ['ownerJarMovementsSummary', periodDates.start, periodDates.end],
    queryFn: () => twentyLService.getJarMovementsSummary({ dateFrom: periodDates.start, dateTo: periodDates.end }),
    staleTime: 30000,
    retry: 1
  })

  // 4. Distributor supplies
  const {
    data: suppliesResponse,
    isError: isSuppliesError,
    error: suppliesError,
    refetch: refetchSupplies
  } = useQuery({
    queryKey: ['ownerSupplies'],
    queryFn: async () => {
      const res = await api.get('/api/v1/20l/distributor-supplies?pageSize=200')
      return res.data?.data || { items: [] }
    },
    staleTime: 30000,
    retry: 1
  })

  // 5. Authoritative Batches Summary (Strictly active batches + recent completed history + produced outputs)
  const {
    data: batchesSummary,
    isError: isBatchesError,
    error: batchesError,
    refetch: refetchBatches
  } = useQuery({
    queryKey: ['ownerBatchesSummary', periodDates.start, periodDates.end],
    queryFn: async () => {
      const res = await api.get(`/api/v1/production/batches/summary?dateFrom=${periodDates.start}&dateTo=${periodDates.end}`)
      return res.data?.data || null
    },
    staleTime: 30000,
    retry: 1
  })

  // 6. Accounts dashboard summary (Cashbook authoritative balance + bank + expenses)
  const {
    data: accountsSummary,
    isError: isAccountsError,
    error: accountsError,
    refetch: refetchAccounts
  } = useQuery({
    queryKey: ['ownerAccountsSummary'],
    queryFn: simpleAccountsService.getDashboardSummary,
    staleTime: 30000,
    retry: 1
  })

  // 7. Sales transactions — large fetch for period aggregation & receivables
  const {
    data: salesData,
    isError: isSalesError,
    error: salesError,
    refetch: refetchSales
  } = useQuery({
    queryKey: ['ownerSalesAll'],
    queryFn: async () => {
      const res = await salesService.getTransactions(1, 500, '', '', '', '', '', '', '', 'newest')
      return res?.data?.items || []
    },
    staleTime: 30000,
    retry: 1
  })

  // 8. Raw materials
  const {
    data: rawMaterialsData,
    isError: isRawMaterialsError,
    error: rawMaterialsError,
    refetch: refetchRawMaterials
  } = useQuery({
    queryKey: ['ownerRawMaterials'],
    queryFn: async () => {
      const res = await rawMaterialsService.getRawMaterials(1, 100)
      return res?.data?.items || []
    },
    staleTime: 60000,
    retry: 1
  })

  // 9. Products (finished goods)
  const {
    data: productsData,
    isError: isProductsError,
    error: productsError,
    refetch: refetchProducts
  } = useQuery({
    queryKey: ['ownerProducts'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100)
      return res?.data?.items || []
    },
    staleTime: 60000,
    retry: 1
  })

  // Extract friendly error detail string
  const getErrorDetail = useCallback((err: any): string | null => {
    if (!err) return null
    return err?.response?.data?.message || err?.message || null
  }, [])

  // Identify any failure across the dashboard
  const hasAnyError = isBalancesError || isDistributorsError || isSuppliesError || isJarMovementsError || isBatchesError || isAccountsError || isSalesError || isRawMaterialsError || isProductsError

  const failedEndpointsCount = [
    isBalancesError, isDistributorsError, isSuppliesError, isJarMovementsError,
    isBatchesError, isAccountsError, isSalesError, isRawMaterialsError, isProductsError
  ].filter(Boolean).length

  // Check if any error indicates missing database tables/columns
  const isSchemaError = useMemo(() => {
    const errors = [balancesError, distributorsError, suppliesError, jarMovementsError, batchesError, accountsError, salesError, rawMaterialsError, productsError]
    return errors.some((e: any) => {
      const code = e?.response?.data?.code
      const msg = e?.response?.data?.message || ''
      return code === 'DATABASE_SCHEMA_MISSING_TABLE' || msg.includes('Database schema error') || msg.includes('42P01')
    })
  }, [balancesError, distributorsError, suppliesError, jarMovementsError, batchesError, accountsError, salesError, rawMaterialsError, productsError])

  // Refresh all
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([
      refetchBalances(), refetchDistributors(), refetchJarMovements(), refetchSupplies(),
      refetchBatches(), refetchAccounts(), refetchSales(),
      refetchRawMaterials(), refetchProducts()
    ])
    setIsRefreshing(false)
  }, [refetchBalances, refetchDistributors, refetchJarMovements, refetchSupplies, refetchBatches, refetchAccounts, refetchSales, refetchRawMaterials, refetchProducts])

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
      if (type === 'DISPATCH' || type === 'SALE' || type === 'DELIVERY' || type === 'SALES DISPATCH') {
        totalRevenue += Number(s.totalAmount) || 0
        totalCollected += Number(s.amountReceived) || 0
        dispatchCount++
      }
      if (type === 'RETURN' || type === 'SALES_RETURN' || type === 'CUSTOMER RETURN') returnCount += Number(s.cases) || 0
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

  // -- Jar movement in period (authoritative from ledger & supplies) --
  const jarsSupplied = useMemo(() => {
    if (jarMovementData?.totalOut !== undefined) return jarMovementData.totalOut
    return suppliesInPeriod.reduce((sum: number, s: any) => sum + (Number(s.quantitySupplied) || 0), 0)
  }, [jarMovementData, suppliesInPeriod])

  const emptiesReturned = useMemo(() => {
    if (jarMovementData?.totalBack !== undefined) return jarMovementData.totalBack
    return suppliesInPeriod.reduce((sum: number, s: any) => sum + (Number(s.quantityEmptyReturned) || 0), 0)
  }, [jarMovementData, suppliesInPeriod])

  const netJarMovement = jarsSupplied - emptiesReturned

  // -- Plant balances (authoritative positions) --
  const plantFilled = plantBalances?.plant?.filledAvailable ?? 0
  const plantEmpty = plantBalances?.plant?.emptyReusable ?? 0
  const withDistributors = plantBalances?.field?.withDistributors ?? 0
  const onVehicles = plantBalances?.field?.inTransitVehicles ?? plantBalances?.field?.onVehicles ?? 0
  const withCustomers = plantBalances?.field?.withCustomers ?? 0
  const damagedQuarantine = plantBalances?.plant?.damagedQuarantined ?? 0
  const totalSystemJars = plantBalances?.grandTotalSystemJars ?? 0
  const totalInCirculation = withDistributors + onVehicles + withCustomers

  // -- Production & Batches --
  const activeBatches = useMemo(() => batchesSummary?.activeBatches || [], [batchesSummary])
  const recentCompletedBatches = useMemo(() => batchesSummary?.recentCompletedBatches || [], [batchesSummary])
  const activeBatchCount = batchesSummary?.activeCount ?? activeBatches.length
  const completedBatchCount = batchesSummary?.completedCount ?? recentCompletedBatches.length

  // Output produced during selected period
  const productionOutputInPeriod = useMemo(() => {
    if (batchesSummary?.periodProducedQuantity !== undefined) {
      return batchesSummary.periodProducedQuantity
    }
    if (period === 'today') return batchesSummary?.todayProducedQuantity ?? 0
    return batchesSummary?.totalProducedQuantity ?? 0
  }, [batchesSummary, period])

  // -- Accounts & Balances --
  const cashInHand = accountsSummary?.cashBalance ?? 0
  const bankBalance = accountsSummary?.totalBankBalance ?? 0
  const totalAvailableFunds = cashInHand + bankBalance

  const periodExpense = useMemo(() => {
    if (period === 'today') return accountsSummary?.todaysExpense ?? 0
    if (period === 'week') return accountsSummary?.thisWeekExpense ?? 0
    return accountsSummary?.thisMonthExpense ?? 0
  }, [accountsSummary, period])

  // -- Receivables (Money Owed) --
  const distributorReceivables = useMemo(() => {
    return (distributorAccounts || []).reduce((sum: number, d: any) => sum + (Number(d.commercial?.netReceivable) || 0), 0)
  }, [distributorAccounts])

  const customerUnpaidSales = useMemo(() => {
    return (salesData || []).filter((s: any) => Number(s.outstandingAmount || 0) > 0)
  }, [salesData])

  const customerReceivables = useMemo(() => {
    return customerUnpaidSales.reduce((sum: number, s: any) => sum + (Number(s.outstandingAmount) || 0), 0)
  }, [customerUnpaidSales])

  const totalReceivable = distributorReceivables + customerReceivables

  // Top Debtors combining customers and distributors
  const topDebtors = useMemo(() => {
    const list: Array<{
      id: string
      name: string
      type: 'DISTRIBUTOR' | 'CUSTOMER'
      amount: number
      details: string
    }> = []

    // Distributors
    ;(distributorAccounts || []).forEach((d: any) => {
      const owed = Number(d.commercial?.netReceivable) || 0
      if (owed > 0) {
        list.push({
          id: d.customerId || d.id,
          name: d.customerName || 'Distributor',
          type: 'DISTRIBUTOR',
          amount: owed,
          details: `${d.physical?.totalJarsHeld || 0} jars held`
        })
      }
    })

    // Customers
    const customerMap = new Map<string, { name: string; amount: number; invoiceCount: number }>()
    customerUnpaidSales.forEach((s: any) => {
      const cId = s.customerId || s.customerName || 'Cust'
      const existing = customerMap.get(cId) || { name: s.customerName || 'Customer', amount: 0, invoiceCount: 0 }
      existing.amount += Number(s.outstandingAmount) || 0
      existing.invoiceCount += 1
      customerMap.set(cId, existing)
    })

    customerMap.forEach((val, id) => {
      list.push({
        id,
        name: val.name,
        type: 'CUSTOMER',
        amount: val.amount,
        details: `${val.invoiceCount} unpaid invoice${val.invoiceCount > 1 ? 's' : ''}`
      })
    })

    return list.sort((a, b) => b.amount - a.amount).slice(0, 5)
  }, [distributorAccounts, customerUnpaidSales])

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

      {/* ── ERROR NOTIFICATION BANNER (When any API call fails with 500/network error) ────────── */}
      {hasAnyError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-black text-rose-950 text-sm flex items-center gap-2">
                <span>{L('errorNoticeTitle')}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-200/80 text-rose-900 uppercase tracking-wide">
                  {failedEndpointsCount} {failedEndpointsCount === 1 ? 'service error' : 'service errors'}
                </span>
              </div>
              <p className="mt-0.5 text-rose-800 leading-relaxed">{L('errorNoticeDesc')}</p>
              {isSchemaError && (
                <p className="mt-1.5 font-bold text-rose-950 bg-rose-100/90 px-2.5 py-1 rounded-lg border border-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  <span>{L('databaseSchemaError')}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="self-start sm:self-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{L('retryAll')}</span>
          </button>
        </div>
      )}

      {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">

        {/* Total Sales */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          isSalesError ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-300'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('totalSales')}</span>
              <div className={`p-1.5 rounded-lg ${isSalesError ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                {isSalesError ? <AlertCircle className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
              </div>
            </div>
            {isSalesError ? (
              <div className="my-1">
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {L('errorLoading')}
                </span>
                <span className="text-[10px] text-rose-500 font-medium block">HTTP 500 / Error</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-slate-900">{curr(salesKpi.totalRevenue)}</div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {isSalesError ? (
              <>
                <span className="text-rose-500 font-medium">{L('unableToCalculate')}</span>
                <button onClick={() => refetchSales()} className="text-rose-600 font-bold hover:underline cursor-pointer">
                  {L('retry')}
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-500">{salesKpi.orderCount} {L('orders')}</span>
                <span className="text-slate-400 font-medium">{L('fromSales')}</span>
              </>
            )}
          </div>
        </div>

        {/* Cash Collected */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          (isSuppliesError || isSalesError) ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-300'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('cashCollected')}</span>
              <div className={`p-1.5 rounded-lg ${(isSuppliesError || isSalesError) ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {(isSuppliesError || isSalesError) ? <AlertCircle className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              </div>
            </div>
            {(isSuppliesError || isSalesError) ? (
              <div className="my-1">
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {L('errorLoading')}
                </span>
                <span className="text-[10px] text-rose-500 font-medium block">Failed to load cash data</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-slate-900">{curr(totalOperationalCash)}</div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {(isSuppliesError || isSalesError) ? (
              <>
                <span className="text-rose-500 font-medium">{L('unableToCalculate')}</span>
                <button onClick={() => { refetchSupplies(); refetchSales() }} className="text-rose-600 font-bold hover:underline cursor-pointer">
                  {L('retry')}
                </button>
              </>
            ) : totalOperationalCash === 0 ? (
              <>
                <span className="text-slate-500">{L('fromSales')}</span>
                <span className="font-semibold text-slate-400 text-[10px]">{L('creditInvoicePending')}</span>
              </>
            ) : (
              <>
                <span className="text-slate-500">{L('fromSales')}</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">{L('waitingToAdd')}</span>
              </>
            )}
          </div>
        </div>

        {/* Money Owed */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          (isDistributorsError && isSalesError) ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-300'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('moneyOwed')}</span>
              <div className={`p-1.5 rounded-lg ${(isDistributorsError && isSalesError) ? 'bg-rose-50 text-rose-600' : 'bg-rose-50 text-rose-600'}`}>
                {(isDistributorsError && isSalesError) ? <AlertCircle className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            {(isDistributorsError && isSalesError) ? (
              <div className="my-1">
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {L('errorLoading')}
                </span>
                <span className="text-[10px] text-rose-500 font-medium block">Failed to load receivables</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-slate-900">{curr(totalReceivable)}</div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {(isDistributorsError && isSalesError) ? (
              <>
                <span className="text-rose-500 font-medium">{L('unableToCalculate')}</span>
                <button onClick={() => { refetchDistributors(); refetchSales() }} className="text-rose-600 font-bold hover:underline cursor-pointer">
                  {L('retry')}
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-500">
                  {period === 'today' && salesKpi.outstanding > 0
                    ? `₹${salesKpi.outstanding} today + ₹${Math.max(0, totalReceivable - salesKpi.outstanding)} past`
                    : 'Total Debtor Ledgers'}
                </span>
                <span className="text-rose-600 font-bold">{topDebtors.length} {L('debtors')}</span>
              </>
            )}
          </div>
        </div>

        {/* Production Output */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          isBatchesError ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-300'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('productionOutput')}</span>
              <div className={`p-1.5 rounded-lg ${isBatchesError ? 'bg-rose-50 text-rose-600' : 'bg-cyan-50 text-cyan-600'}`}>
                {isBatchesError ? <AlertCircle className="w-4 h-4" /> : <Factory className="w-4 h-4" />}
              </div>
            </div>
            {isBatchesError ? (
              <div className="my-1">
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {L('errorLoading')}
                </span>
                <span className="text-[10px] text-rose-500 font-medium block">Production query error</span>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {productionOutputInPeriod.toLocaleString('en-IN')}
                  <span className="text-xs font-semibold text-slate-400 ml-1">{L('jarsUnit')}</span>
                </div>
                {period === 'today' && productionOutputInPeriod === 0 && (
                  <span className="text-[10px] text-slate-400 font-medium block">{L('idleToday')}</span>
                )}
              </div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {isBatchesError ? (
              <>
                <span className="text-rose-500 font-medium">{L('errorLoading')}</span>
                <button onClick={() => refetchBatches()} className="text-rose-600 font-bold hover:underline cursor-pointer">
                  {L('retry')}
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-500">
                  {L('activeBatches')}: <strong className="text-cyan-700">{activeBatchCount}</strong>
                  {Number(batchesSummary?.activeProducedQuantity || 0) > 0 && (
                    <span className="text-slate-400 ml-1">({Number(batchesSummary.activeProducedQuantity).toLocaleString('en-IN')} {L('inProgressActive')})</span>
                  )}
                </span>
                <span className="text-slate-400 font-medium">{plantFilled} {L('filled')}</span>
              </>
            )}
          </div>
        </div>

        {/* Jar Movement */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          isJarMovementsError ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-300'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('jarMovement')}</span>
              <div className={`p-1.5 rounded-lg ${isJarMovementsError ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {isJarMovementsError ? <AlertCircle className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </div>
            </div>
            {isJarMovementsError ? (
              <div className="my-1">
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {L('errorLoading')}
                </span>
                <span className="text-[10px] text-rose-500 font-medium block">Failed to load movements</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{jarsSupplied}</span>
                <span className="text-xs font-semibold text-slate-400">{L('out')} /</span>
                <span className="text-lg font-bold text-emerald-600">{emptiesReturned}</span>
                <span className="text-xs font-semibold text-slate-400">{L('back')}</span>
              </div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {isJarMovementsError ? (
              <>
                <span className="text-rose-500 font-medium">{L('unableToCalculate')}</span>
                <button onClick={() => refetchJarMovements()} className="text-rose-600 font-bold hover:underline cursor-pointer">
                  {L('retry')}
                </button>
              </>
            ) : jarsSupplied === 0 && emptiesReturned === 0 ? (
              <>
                <span className="text-slate-400 font-medium">{L('noMovementsInPeriod')}</span>
                <span className="font-bold text-slate-400">Net: 0</span>
              </>
            ) : (
              <>
                <span className="text-slate-500">{L('netMovement')}</span>
                <span className={`font-bold ${netJarMovement > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {netJarMovement > 0 ? `+${netJarMovement}` : `${netJarMovement}`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stock Health */}
        <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          (isBalancesError || isRawMaterialsError) ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-blue-300'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{L('stockHealth')}</span>
              <div className={`p-1.5 rounded-lg ${
                (isBalancesError || isRawMaterialsError) ? 'bg-rose-50 text-rose-600' :
                stockHealthStatus === 'good' ? 'bg-emerald-50 text-emerald-600' :
                stockHealthStatus === 'low' ? 'bg-amber-50 text-amber-600' :
                'bg-rose-50 text-rose-600'
              }`}>
                {(isBalancesError || isRawMaterialsError) ? <AlertCircle className="w-4 h-4" /> : <Box className="w-4 h-4" />}
              </div>
            </div>
            {(isBalancesError || isRawMaterialsError) ? (
              <div className="my-1">
                <span className="text-sm font-black text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {L('errorLoading')}
                </span>
                <span className="text-[10px] text-rose-500 font-medium block">Failed to load stock</span>
              </div>
            ) : (
              <div className={`text-lg font-black ${
                totalSystemJars === 0 && plantBalances?.hasPhysicalCount === false
                  ? 'text-amber-700'
                  : stockHealthStatus === 'good' ? 'text-emerald-700'
                  : stockHealthStatus === 'low' ? 'text-amber-700'
                  : 'text-rose-700'
              }`}>
                {totalSystemJars === 0 && plantBalances?.hasPhysicalCount === false
                  ? L('countRequired')
                  : stockHealthStatus === 'good' ? L('allGood')
                  : stockHealthStatus === 'low' ? L('lowStock')
                  : L('auditNeeded')}
              </div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {(isBalancesError || isRawMaterialsError) ? (
              <>
                <span className="text-rose-500 font-medium">{L('unableToCalculate')}</span>
                <button onClick={() => { refetchBalances(); refetchRawMaterials() }} className="text-rose-600 font-bold hover:underline cursor-pointer">
                  {L('retry')}
                </button>
              </>
            ) : totalSystemJars === 0 && plantBalances?.hasPhysicalCount === false ? (
              <span className="text-amber-600 font-medium text-[10px]">{L('initialCountNeeded')}</span>
            ) : (
              <>
                <span className="text-slate-500">{totalSystemJars.toLocaleString('en-IN')} {L('totalJars').toLowerCase()}</span>
                {lowStockRawMaterials.length > 0 && (
                  <span className="font-bold text-amber-600">{lowStockRawMaterials.length} {L('lowStock').toLowerCase()}</span>
                )}
              </>
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

          {/* Sales summary grid or error state */}
          {isSalesError ? (
            <div className="p-6 bg-rose-50/70 border border-rose-200 rounded-xl text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
              <div className="text-xs font-bold text-rose-900">{L('errorLoading')} — {L('salesTitle')}</div>
              <p className="text-[11px] text-rose-700">{getErrorDetail(salesError) || L('serverError')}</p>
              <button
                onClick={() => refetchSales()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> {L('retry')}
              </button>
            </div>
          ) : (
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
          )}
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

          {isBatchesError ? (
            <div className="p-6 bg-rose-50/70 border border-rose-200 rounded-xl text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
              <div className="text-xs font-bold text-rose-900">{L('errorLoading')} — {L('productionTitle')}</div>
              <p className="text-[11px] text-rose-700">{getErrorDetail(batchesError) || L('serverError')}</p>
              <button
                onClick={() => refetchBatches()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> {L('retry')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Batches */}
              {activeBatches.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>{L('activeBatches')} ({activeBatches.length})</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Genuinely Active</span>
                  </div>
                  <div className="space-y-2">
                    {activeBatches.map((b: any) => (
                      <div key={b.id || b.batchId} className="p-3 bg-cyan-50/40 border border-cyan-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>Batch #{b.batchNumber || b.code || 'B-ACTIVE'}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">{L('bottlingActive')}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {L('line')}: {b.productionLineName || 'Line 1'} • {L('operator')}: {b.operatorName || 'Operator'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-cyan-900 text-sm">{b.producedQuantity ?? b.casesProduced ?? 0}</span>
                          <span className="text-[10px] text-slate-500 block">{L('jarsOutput')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 rounded-xl text-center">
                  <Factory className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-600">{L('noActiveBatches')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{L('plantIdle')}</p>
                </div>
              )}

              {/* Recent Completed Batches (shown separately, NEVER classified as active) */}
              {recentCompletedBatches.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>{L('recentCompleted')} ({completedBatchCount})</span>
                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-medium">History</span>
                  </div>
                  <div className="space-y-1.5">
                    {recentCompletedBatches.slice(0, 3).map((b: any) => (
                      <div key={b.id || b.batchId} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-700 flex items-center gap-2">
                            <span>Batch #{b.batchNumber}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">Completed</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {b.completedAt ? new Date(b.completedAt).toLocaleDateString() : 'Finished'} • Line: {b.productionLineName || 'Line 1'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800 text-sm">{b.producedQuantity ?? 0}</span>
                          <span className="text-[10px] text-slate-400 block">{L('jarsUnit')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
        {isAccountsError ? (
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-center space-y-1.5">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <div className="text-xs font-bold text-rose-900">{L('errorLoading')} — {L('accountsTitle')}</div>
            <p className="text-[11px] text-rose-700">{getErrorDetail(accountsError) || L('serverError')}</p>
            <button
              onClick={() => refetchAccounts()}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> {L('retry')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-800 block">{L('cashInHand')}</span>
              <div className="text-lg font-black text-emerald-950 mt-0.5">{curr(cashInHand)}</div>
              <span className="text-[10px] text-emerald-700 font-medium">Cashbook balance</span>
            </div>
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
              <span className="text-[11px] font-bold text-blue-800 block">{L('bankBalance')}</span>
              <div className="text-lg font-black text-blue-950 mt-0.5">{curr(bankBalance)}</div>
              <span className="text-[10px] text-blue-700 font-medium">Active bank accounts</span>
            </div>
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
              <span className="text-[11px] font-bold text-indigo-800 block">{L('totalFunds')}</span>
              <div className="text-lg font-black text-indigo-950 mt-0.5">{curr(totalAvailableFunds)}</div>
              <span className="text-[10px] text-indigo-700 font-medium">Cash + Bank total</span>
            </div>
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <span className="text-[11px] font-bold text-amber-800 block">{L('expenses')}</span>
              <div className="text-lg font-black text-amber-950 mt-0.5">{curr(periodExpense)}</div>
              <span className="text-[10px] text-amber-700 font-medium">{periodLabels[period]}</span>
            </div>
          </div>
        )}

        {/* Top debtors */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{L('topOwed')}</span>
            <span className="text-[11px] text-slate-400 font-medium">Customer & Distributor Receivables</span>
          </div>
          {(isDistributorsError && isSalesError) ? (
            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-center space-y-1.5">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
              <div className="text-xs font-bold text-rose-900">{L('errorLoading')} — {L('topOwed')}</div>
              <p className="text-[11px] text-rose-700">{getErrorDetail(distributorsError || salesError) || L('serverError')}</p>
              <button
                onClick={() => { refetchDistributors(); refetchSales() }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> {L('retry')}
              </button>
            </div>
          ) : topDebtors.length > 0 ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {topDebtors.map((d: any) => (
                <div key={d.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{d.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        d.type === 'DISTRIBUTOR' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {d.type === 'DISTRIBUTOR' ? L('distributor') : L('customer')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{d.details}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-rose-600">{curr(Number(d.amount || 0))}</div>
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
          {(isDistributorsError && isSalesError) ? (
            <span className="text-rose-600 font-semibold">{L('unableToCalculate')}</span>
          ) : (
            <span>{L('totalOwed')} <strong>{curr(totalReceivable)}</strong></span>
          )}
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

            {isBalancesError ? (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-center space-y-1.5">
                <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                <p className="text-xs font-bold text-rose-800">{L('errorLoading')}</p>
                <p className="text-[10px] text-rose-700">{getErrorDetail(balancesError) || L('serverError')}</p>
                <button
                  onClick={() => refetchBalances()}
                  className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> {L('retry')}
                </button>
              </div>
            ) : totalSystemJars > 0 ? (
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

            {isRawMaterialsError ? (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-center space-y-1.5">
                <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                <p className="text-xs font-bold text-rose-800">{L('errorLoading')}</p>
                <button
                  onClick={() => refetchRawMaterials()}
                  className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> {L('retry')}
                </button>
              </div>
            ) : rawMaterials.length > 0 ? (
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

            {isProductsError ? (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-center space-y-1.5">
                <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                <p className="text-xs font-bold text-rose-800">{L('errorLoading')}</p>
                <button
                  onClick={() => refetchProducts()}
                  className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> {L('retry')}
                </button>
              </div>
            ) : products.length > 0 ? (
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
