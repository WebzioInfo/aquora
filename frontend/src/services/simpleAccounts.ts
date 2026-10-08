import { api, getDeduplicated } from './api'

// ==========================================
// TYPES
// ==========================================
export interface SimpleExpense {
  id: string
  expenseNumber: string
  expenseDate: string
  category: string
  vendor?: string
  description: string
  amount: number
  paymentMethod: string
  bankAccountId?: string
  bankAccountName?: string
  cashBookId?: string
  cashBookName?: string
  paidFrom?: string
  notes?: string
  createdBy: string
  createdById?: string
  createdByName?: string
  createdDate: string
}

export interface CreateSimpleExpenseRequest {
  expenseDate: string
  category: string
  vendor?: string
  description: string
  amount: number
  paymentMethod: string
  bankAccountId?: string
  cashBookId?: string
  notes?: string
}

export interface UpdateSimpleExpenseRequest {
  expenseDate: string
  category: string
  vendor?: string
  description: string
  amount: number
  paymentMethod: string
  bankAccountId?: string
  cashBookId?: string
  notes?: string
}

export interface ExpenseCategory {
  id: string
  tenantId: string
  companyId: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface CreateExpenseCategoryRequest {
  name: string
  description?: string
  isActive?: boolean
}

export interface BankLedgerEntry {
  id: string
  bankAccountId: string
  transactionDate: string
  referenceNumber: string
  transactionType: string
  eventType?: string
  eventLabel?: string
  auditNotes?: string
  description: string
  debit: number
  credit: number
  runningBalance: number
  relatedEntityId?: string
  relatedEntityType?: string
  createdAt: string
  createdBy: string
}

export interface BankLedgerAuditEntry {
  id: string
  bankLedgerEntryId: string
  action: string
  oldAmount: number
  newAmount: number
  remarks?: string
  changedBy: string
  changedAt: string
}


export interface BankSummary {
  currentBalance: number
  totalMoneyReceived: number
  totalMoneyPaid: number
  totalTransactions: number
  largestDeposit: number
  largestExpense: number
  todaysTransactions: number
  thisMonthTransactions: number
  averageMonthlyFlow?: number
  lastTransactionDate?: string
  lastTransactionDescription?: string
  lastTransactionAmount?: number
}

export interface BankLedgerFilter {
  dateFrom?: string
  dateTo?: string
  transactionType?: string
  minAmount?: number
  maxAmount?: number
}

export interface BankAccount {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  ifscCode: string
  openingBalance: number
  currentBalance: number
  notes?: string
  status: string
  createdAt: string
  createdBy: string
}

export interface CreateBankAccountRequest {
  bankName: string
  accountName: string
  accountNumber: string
  ifscCode: string
  openingBalance: number
  notes?: string
  status: string
}

export interface UpdateBankAccountRequest {
  bankName: string
  accountName: string
  accountNumber: string
  ifscCode: string
  notes?: string
  status: string
}

export interface BankAccountDropdown {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  accountType?: string
  currentBalance: number
}


export interface CashBook {
  id: string
  name: string
  description?: string
  openingBalance: number
  currentBalance: number
  status: string
  notes?: string
  createdAt: string
  createdBy: string
}

export interface CreateCashBookRequest {
  name: string
  description?: string
  openingBalance: number
  notes?: string
  status: string
}

export interface UpdateCashBookRequest {
  name: string
  description?: string
  notes?: string
  status: string
}

export interface AddMoneyRequest {
  amount: number
  source: string
  referenceNo?: string
  date: string
  description?: string
}

export interface CashBookDropdown {
  id: string
  name: string
  currentBalance: number
}

export interface SettleCashBookRequest {
  amount: number
  settlementVia: 'Cash' | 'Bank'
  sourceCashBookId?: string
  sourceBankAccountId?: string
  date: string
  referenceNo?: string
  description?: string
}

export interface PagedCashBooksResponse {
  items: CashBook[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface OwnerInvestmentTransaction {
  id: string
  ownerId: string
  ownerName: string
  transactionDate: string
  amount: number
  transactionType: 'Investment' | 'Withdrawal'
  notes?: string
  createdAt: string
  createdBy: string
}

export interface Owner {
  id: string
  userId?: string | null
  name: string
  phone: string
  email?: string
  ownershipPercentage: number
  initialInvestment: number
  currentInvestment: number
  notes?: string
  createdAt: string
  createdBy: string
  transactions: OwnerInvestmentTransaction[]
}

export interface CreateOwnerRequest {
  userId?: string
  name: string
  phone: string
  email?: string
  ownershipPercentage: number
  initialInvestment: number
  notes?: string
}

export interface UpdateOwnerRequest {
  name: string
  phone: string
  email?: string
  ownershipPercentage: number
  notes?: string
}

export interface CreateOwnerTransactionRequest {
  transactionDate: string
  amount: number
  transactionType: 'Investment' | 'Withdrawal'
  notes?: string
}

export interface OwnerSummary {
  id: string
  name: string
  ownershipPercentage: number
  initialInvestment: number
  currentInvestment: number
  totalInvested: number
  totalWithdrawn: number
}

export interface CompanyTotalInvestment {
  totalInitialInvestment: number
  totalCurrentInvestment: number
  totalAdditionalInvested: number
  totalWithdrawn: number
  totalOwners: number
}

export interface CategoryAssetSummary {
  totalQuantity: number
  averageUnitCost: number
  totalStockValue: number
}

export interface AssetSummary {
  finishedGoods: CategoryAssetSummary
  rawMaterials: CategoryAssetSummary
  totalFinishedGoodsValue: number
  totalRawMaterialValue: number
  combinedInventoryValue: number
}

export interface SimpleAccountsDashboardSummary {
  todaysExpense: number
  thisWeekExpense?: number
  thisMonthExpense: number
  outstandingSales: number
  todaysSales: number
  todaysReturn: number
  todaysDamage: number
  finishedGoodsValue: number
  rawMaterialValue: number
  totalInventoryValue: number
  companyInvestment: number
  cashBalance?: number
  totalBankBalance?: number
  totalExpenses?: number
}

export interface PagedExpensesResponse {
  items: SimpleExpense[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PagedBankAccountsResponse {
  items: BankAccount[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// ==========================================
// API CLIENT METHODS
// ==========================================
export const simpleAccountsService = {
  // Expenses
  getExpenses: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    startDate?: string
    endDate?: string
    category?: string
    month?: number
    paymentMethod?: string
  }) => {
    const res = await api.get<{ data: PagedExpensesResponse }>('/api/v1/expenses', { params })
    return res.data.data
  },

  getExpenseById: async (id: string) => {
    const res = await api.get<{ data: SimpleExpense }>(`/api/v1/expenses/${id}`)
    return res.data.data
  },

  createExpense: async (request: CreateSimpleExpenseRequest) => {
    const res = await api.post<{ data: SimpleExpense }>('/api/v1/expenses', request)
    return res.data.data
  },

  updateExpense: async (id: string, request: UpdateSimpleExpenseRequest) => {
    const res = await api.put<{ data: SimpleExpense }>(`/api/v1/expenses/${id}`, request)
    return res.data.data
  },

  deleteExpense: async (id: string) => {
    const res = await api.delete(`/api/v1/expenses/${id}`)
    return res.data
  },

  // Expense Categories
  getExpenseCategories: async (includeInactive = false) => {
    const res = await api.get<{ data: ExpenseCategory[] }>('/api/v1/expense-categories', {
      params: { includeInactive }
    })
    return res.data.data
  },

  getExpenseCategoryById: async (id: string) => {
    const res = await api.get<{ data: ExpenseCategory }>(`/api/v1/expense-categories/${id}`)
    return res.data.data
  },

  createExpenseCategory: async (request: CreateExpenseCategoryRequest) => {
    const res = await api.post<{ data: ExpenseCategory }>('/api/v1/expense-categories', request)
    return res.data.data
  },

  updateExpenseCategory: async (id: string, request: Partial<CreateExpenseCategoryRequest>) => {
    const res = await api.put<{ data: ExpenseCategory }>(`/api/v1/expense-categories/${id}`, request)
    return res.data.data
  },

  deleteExpenseCategory: async (id: string) => {
    const res = await api.delete(`/api/v1/expense-categories/${id}`)
    return res.data
  },

  // Bank Accounts
  getBankAccounts: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    status?: string
  }) => {
    const res = await getDeduplicated<{ data: PagedBankAccountsResponse }>('/api/v1/bank-accounts', { params })
    return res.data.data
  },

  getBankAccountDropdown: async () => {
    const res = await getDeduplicated<{ data: BankAccountDropdown[] }>('/api/v1/bank-accounts/dropdown')
    return res.data.data
  },

  getBankAccountById: async (id: string) => {
    const res = await getDeduplicated<{ data: BankAccount }>(`/api/v1/bank-accounts/${id}`)
    return res.data.data
  },

  createBankAccount: async (request: CreateBankAccountRequest) => {
    const res = await api.post<{ data: BankAccount }>('/api/v1/bank-accounts', request)
    return res.data.data
  },

  updateBankAccount: async (id: string, request: UpdateBankAccountRequest) => {
    const res = await api.put<{ data: BankAccount }>(`/api/v1/bank-accounts/${id}`, request)
    return res.data.data
  },

  deleteBankAccount: async (id: string) => {
    const res = await api.delete(`/api/v1/bank-accounts/${id}`)
    return res.data
  },

  getCashBooks: async (params?: { pageNumber?: number, pageSize?: number, search?: string, status?: string }) => {
    const res = await getDeduplicated<{ data: PagedCashBooksResponse }>('/api/v1/cash-books', { params })
    return res.data.data
  },

  getCashBookDropdown: async () => {
    const res = await api.get<{ data: CashBookDropdown[] }>('/api/v1/cash-books/dropdown')
    return res.data.data
  },

  getCashBookById: async (id: string) => {
    const res = await api.get<{ data: CashBook }>(`/api/v1/cash-books/${id}`)
    return res.data.data
  },

  createCashBook: async (request: CreateCashBookRequest) => {
    const res = await api.post<{ data: CashBook }>('/api/v1/cash-books', request)
    return res.data.data
  },

  updateCashBook: async (id: string, request: UpdateCashBookRequest) => {
    const res = await api.put<{ data: CashBook }>(`/api/v1/cash-books/${id}`, request)
    return res.data.data
  },

  deleteCashBook: async (id: string) => {
    const res = await api.delete(`/api/v1/cash-books/${id}`)
    return res.data
  },

  settleCashBook: async (id: string, request: SettleCashBookRequest) => {
    const res = await api.post<{ data: string }>(`/api/v1/cash-books/${id}/settle`, request)
    return res.data.data
  },

  // Owners
  getOwners: async () => {
    const res = await api.get<{ data: Owner[] }>('/api/v1/owners')
    return res.data.data
  },

  getOwnerById: async (id: string) => {
    const res = await api.get<{ data: Owner }>(`/api/v1/owners/${id}`)
    return res.data.data
  },

  createOwner: async (request: CreateOwnerRequest) => {
    const res = await api.post<{ data: Owner }>('/api/v1/owners', request)
    return res.data.data
  },

  updateOwner: async (id: string, request: UpdateOwnerRequest) => {
    const res = await api.put<{ data: Owner }>(`/api/v1/owners/${id}`, request)
    return res.data.data
  },

  deleteOwner: async (id: string) => {
    const res = await api.delete(`/api/v1/owners/${id}`)
    return res.data
  },

  addOwnerTransaction: async (ownerId: string, request: CreateOwnerTransactionRequest) => {
    const res = await api.post<{ data: OwnerInvestmentTransaction }>(`/api/v1/owners/${ownerId}/transactions`, request)
    return res.data.data
  },

  getOwnerSummaries: async () => {
    const res = await api.get<{ data: OwnerSummary[] }>('/api/v1/owners/summary')
    return res.data.data
  },

  getCompanyTotalInvestment: async () => {
    const res = await api.get<{ data: CompanyTotalInvestment }>('/api/v1/owners/total-investment')
    return res.data.data
  },

  // Asset Summary
  getAssetSummary: async () => {
    const res = await api.get<{ data: AssetSummary }>('/api/v1/simple-accounts/asset-summary')
    return res.data.data
  },

  // Dashboard Summary
  getDashboardSummary: async () => {
    const res = await api.get<{ data: SimpleAccountsDashboardSummary }>('/api/v1/simple-accounts/dashboard-summary')
    return res.data.data
  },

  // Bank Ledger
  getBankLedger: async (bankAccountId: string, params: { pageNumber?: number, pageSize?: number, search?: string } & BankLedgerFilter) => {
    const res = await api.get<{ data: { items: BankLedgerEntry[], totalCount: number, totalPages: number } }>(`/api/v1/bank-accounts/${bankAccountId}/ledger`, { params })
    return res.data.data
  },

  getBankSummary: async (bankAccountId: string) => {
    const res = await api.get<{ data: BankSummary }>(`/api/v1/bank-accounts/${bankAccountId}/summary`)
    return res.data.data
  },

  getLedgerHistory: async (ledgerEntryId: string) => {
    const res = await api.get<{ data: BankLedgerAuditEntry[] }>(`/api/v1/bank-accounts/ledger/${ledgerEntryId}/history`)
    return res.data.data
  },

  getCashBookLedger: async (cashBookId: string, params: { pageNumber?: number, pageSize?: number, search?: string } & BankLedgerFilter) => {
    const res = await api.get<{ data: { items: BankLedgerEntry[], totalCount: number, totalPages: number } }>(`/api/v1/cash-books/${cashBookId}/ledger`, { params })
    return res.data.data
  },

  getCashBookSummary: async (cashBookId: string) => {
    const res = await api.get<{ data: BankSummary }>(`/api/v1/cash-books/${cashBookId}/summary`)
    return res.data.data
  },

  addBankMoney: async (bankAccountId: string, request: AddMoneyRequest) => {
    const res = await api.post<{ data: string }>(`/api/v1/bank-accounts/${bankAccountId}/deposit`, request)
    return res.data.data
  },

  updateBankDeposit: async (ledgerEntryId: string, request: AddMoneyRequest) => {
    const res = await api.put<{ data: boolean }>(`/api/v1/bank-accounts/deposit/${ledgerEntryId}`, request)
    return res.data.data
  },

  deleteBankDeposit: async (ledgerEntryId: string) => {
    const res = await api.delete<{ data: boolean }>(`/api/v1/bank-accounts/deposit/${ledgerEntryId}`)
    return res.data.data
  },

  addCashMoney: async (cashBookId: string, request: AddMoneyRequest) => {
    const res = await api.post<{ data: string }>(`/api/v1/cash-books/${cashBookId}/deposit`, request)
    return res.data.data
  },

  updateCashDeposit: async (ledgerEntryId: string, request: AddMoneyRequest) => {
    const res = await api.put<{ data: boolean }>(`/api/v1/cash-books/deposit/${ledgerEntryId}`, request)
    return res.data.data
  },

  deleteCashDeposit: async (ledgerEntryId: string) => {
    const res = await api.delete<{ data: boolean }>(`/api/v1/cash-books/deposit/${ledgerEntryId}`)
    return res.data.data
  },

  // Unified Accounts Ledger
  getUnifiedLedger: async (params?: UnifiedLedgerFilter) => {
    const res = await api.get<{ data: { items: UnifiedLedgerEntry[], totalCount: number, pageNumber: number, pageSize: number, totalPages: number } }>('/api/v1/accounts-ledger/transactions', { params })
    return res.data.data
  },

  getUnifiedLedgerSummary: async (params?: UnifiedLedgerFilter) => {
    const res = await api.get<{ data: UnifiedLedgerSummary }>('/api/v1/accounts-ledger/summary', { params })
    return res.data.data
  },

  getAccountsMetadata: async () => {
    const res = await api.get<{ data: AccountsMetadata }>('/api/v1/accounts-ledger/accounts')
    return res.data.data
  }
}

export interface UnifiedLedgerEntry {
  id: string
  accountType: 'BANK' | 'CASH'
  bankAccountId?: string
  cashBookId?: string
  accountName: string
  bankName?: string
  accountNumber?: string
  transactionDate: string
  referenceNumber: string
  transactionType: string
  eventType?: string
  eventLabel?: string
  auditNotes?: string
  description: string
  debit: number
  credit: number
  amount: number
  runningBalance: number
  relatedEntityId?: string
  relatedEntityType?: string
  ledgerSequence: number
  createdAt: string
  createdBy: string
}

export interface UnifiedLedgerFilter {
  accountType?: 'ALL' | 'BANK' | 'CASH'
  bankAccountId?: string
  cashBookId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  transactionType?: string
  createdBy?: string
  minAmount?: number
  maxAmount?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  pageNumber?: number
  pageSize?: number
}

export interface UnifiedLedgerSummary {
  accountType: string
  selectedAccountId?: string
  totalBalance: number
  totalBankBalance: number
  totalCashBalance: number
  activeBankAccountsCount: number
  activeCashBooksCount: number
  totalTransactions: number
  totalMoneyReceived: number
  totalMoneyPaid: number
  netCashFlow: number
  todaysTransactions: number
  thisMonthTransactions: number
}

export interface AccountsMetadata {
  bankAccounts: BankAccountDropdown[]
  cashBooks: CashBookDropdown[]
  totalBankBalance: number
  totalCashBalance: number
  totalBalance: number
  activeBankAccountsCount: number
  activeCashBooksCount: number
}

