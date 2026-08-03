import { api } from './api'

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
  notes?: string
}

export interface BankLedgerEntry {
  id: string
  bankAccountId: string
  transactionDate: string
  referenceNumber: string
  transactionType: string
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
  currentBalance: number
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

  // Bank Accounts
  getBankAccounts: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    status?: string
  }) => {
    const res = await api.get<{ data: PagedBankAccountsResponse }>('/api/v1/bank-accounts', { params })
    return res.data.data
  },

  getBankAccountDropdown: async () => {
    const res = await api.get<{ data: BankAccountDropdown[] }>('/api/v1/bank-accounts/dropdown')
    return res.data.data
  },

  getBankAccountById: async (id: string) => {
    const res = await api.get<{ data: BankAccount }>(`/api/v1/bank-accounts/${id}`)
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
  }
}
