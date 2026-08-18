import { api } from './api'

export interface MonthlySalaryDirectory {
  id: string
  salaryNo: string
  employeeId: string
  employeeName: string
  department: string
  designation: string
  salaryMonth: string
  baseSalary: number
  workingDays: number
  daysWorked: number
  earnedSalary?: number
  calculatedEntitlement: number
  netSalaryEntitlement: number
  totalAdvances?: number
  totalSettlements?: number
  totalPaid: number
  remainingBalance: number
  excessAdvance?: number
  status: string // Unpaid, Partially Paid, Paid, Fully Paid, Overpaid
  isFinalized?: boolean
  finalizedAt?: string
  finalizedBy?: string
  unworkedDays?: number
  lastPaymentDate?: string
  paymentsCount: number
}

export interface SalaryPaymentTransaction {
  id: string
  monthlySalaryId: string
  salaryNo: string
  paymentType: string // Salary Advance, Salary Settlement
  amount: number
  paymentMethod: string // BankAccount, CashBook
  paidFrom: string
  bankAccountId?: string
  cashBookId?: string
  paymentDate: string
  remarks?: string
  status: string
}

export interface MonthlySalaryDetails extends MonthlySalaryDirectory {
  dailySalary: number
  grossSalary: number
  bonus: number
  advanceDeduction: number
  otherDeduction: number
  remarks?: string
  payments: SalaryPaymentTransaction[]
}

export interface CreateOrGetMonthlySalaryRequest {
  employeeId: string
  salaryMonth: string
  workingDays: number
  daysWorked: number
  bonus: number
  advanceDeduction: number
  otherDeduction: number
  finalEntitlementOverride?: number
  remarks?: string
}

export interface ProcessSalaryPaymentRequest {
  monthlySalaryId: string
  paymentType: string // Salary Advance, Salary Settlement
  amount: number
  paymentMethod: string
  bankAccountId?: string
  cashBookId?: string
  workingDays?: number
  daysWorked?: number
  bonus?: number
  advanceDeduction?: number
  otherDeduction?: number
  paymentDate?: string
  confirmFinalSettlement?: boolean
  forceFinalizeWithUnpaid?: boolean
  remarks?: string
}

export interface PayrollMetrics {
  disbursedThisMonth: number
  paidViaBankThisMonth: number
  paidViaCashThisMonth: number
  totalPendingBalanceThisMonth: number
}

export interface PagedMonthlySalariesResponse {
  items: MonthlySalaryDirectory[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Legacy Aliases
export type SalaryPayment = MonthlySalaryDirectory
export type SalaryPaymentDetails = MonthlySalaryDetails
export interface CreateSalaryPaymentRequest extends CreateOrGetMonthlySalaryRequest {
  paymentMethod?: string
  bankAccountId?: string
  cashBookId?: string
  paymentAmount?: number
  paymentType?: string
}

export const payrollService = {
  getMonthlySalaries: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    month?: string
    employeeId?: string
  }) => {
    const res = await api.get<{ data: PagedMonthlySalariesResponse }>('/api/v1/SalaryPayments', { params })
    return res.data.data
  },

  getMonthlySalaryById: async (id: string) => {
    const res = await api.get<{ data: MonthlySalaryDetails }>(`/api/v1/SalaryPayments/${id}`)
    return res.data.data
  },

  getOrCreateMonthlySalary: async (request: CreateOrGetMonthlySalaryRequest) => {
    const res = await api.post<{ data: MonthlySalaryDetails }>('/api/v1/SalaryPayments/entitlements', request)
    return res.data.data
  },

  processSalaryPayment: async (request: ProcessSalaryPaymentRequest) => {
    const res = await api.post<{ data: SalaryPaymentTransaction }>('/api/v1/SalaryPayments/pay', request)
    return res.data.data
  },

  finalizeMonthlySalary: async (request: { monthlySalaryId: string; forceFinalizeWithUnpaid?: boolean; remarks?: string }) => {
    const res = await api.post<{ data: MonthlySalaryDetails }>('/api/v1/SalaryPayments/finalize', request)
    return res.data.data
  },

  reverseSalaryTransaction: async (transactionId: string) => {
    const res = await api.delete<{ data: boolean }>(`/api/v1/SalaryPayments/transactions/${transactionId}`)
    return res.data
  },

  getPayrollMetrics: async (month?: string) => {
    const res = await api.get<{ data: PayrollMetrics }>('/api/v1/SalaryPayments/metrics', { params: { month } })
    return res.data.data
  },

  // Legacy Fallback methods
  getSalaryPayments: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    month?: string
    employeeId?: string
  }) => {
    const res = await api.get<{ data: PagedMonthlySalariesResponse }>('/api/v1/SalaryPayments', { params })
    return res.data.data
  },

  getSalaryPaymentById: async (id: string) => {
    const res = await api.get<{ data: MonthlySalaryDetails }>(`/api/v1/SalaryPayments/${id}`)
    return res.data.data
  },

  createSalaryPayment: async (request: CreateSalaryPaymentRequest) => {
    const res = await api.post<{ data: any }>('/api/v1/SalaryPayments', request)
    return res.data.data
  },

  updateSalaryPayment: async (id: string, request: CreateSalaryPaymentRequest) => {
    const res = await api.put<{ data: any }>(`/api/v1/SalaryPayments/${id}`, request)
    return res.data.data
  },

  deleteSalaryPayment: async (id: string) => {
    const res = await api.delete(`/api/v1/SalaryPayments/${id}`)
    return res.data
  },

  getSalaryPaymentHistory: async (id: string) => {
    const res = await api.get<{ data: any[] }>(`/api/v1/SalaryPayments/${id}/history`)
    return res.data.data
  }
}
