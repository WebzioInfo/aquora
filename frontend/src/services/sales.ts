import { api } from './api'
import type { ApiResponse } from './auth'
import type { PagedResult } from './products'

export interface SalesTransaction {
  id: string
  transactionNumber: string
  customerId: string
  customerName: string
  customerCode: string
  productId: string
  productName: string
  productSku: string
  cases: number
  transactionType: string
  transactionDate: string
  referenceNumber: string | null
  remarks: string | null
  status: string
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string | null
  // Simple Accounts V1 & New ERP Fields
  paymentMethod?: string | null
  bankAccountId?: string | null
  bankAccountName?: string | null
  cashBookId?: string | null
  cashBookName?: string | null
  unitPrice?: number
  discountAmount?: number
  taxAmount?: number
  cgst?: number
  sgst?: number
  igst?: number
  metadataJson?: string | null

  totalAmount?: number
  amountReceived?: number
  outstandingAmount?: number
  paymentStatus?: string
  returnedAmount?: number
  refundAmount?: number
  adjustmentAmount?: number
  returnType?: string
  isReplacementRequired?: boolean
  productValue?: number
  parentTransactionId?: string | null
  relatedCount?: number
  damageCost?: number
  damageReason?: string
}

export interface SalesDashboard {
  todaySalesCases: number
  todayReturns: number
  todayDamage: number
  totalDispatch: number
  monthlyDispatch: number
}

export interface CreateSalesTransactionRequest {
  customerId: string
  productId: string
  parentTransactionId?: string | null
  caseConfigurationId?: string
  unitsPerCase?: number
  cases: number
  transactionType: string
  transactionDate: string
  referenceNumber?: string
  remarks?: string

  // ERP & V1 Fields
  paymentMethod?: string
  bankAccountId?: string
  cashBookId?: string
  unitPrice?: number
  discountAmount?: number
  taxAmount?: number
  cgst?: number
  sgst?: number
  igst?: number
  metadataJson?: string

  totalAmount?: number
  amountReceived?: number
  returnedAmount?: number
  refundAmount?: number
  adjustmentAmount?: number
  returnType?: string
  returnCondition?: string
  settlementMethod?: string
  isReplacementRequired?: boolean
  productValue?: number
  damageCost?: number
  damageReason?: string
}

export interface SalesTransactionTimelineEvent {
  id: string
  timestamp: string
  eventType: string
  title: string
  actorName: string
  actorRole?: string | null
  status: string
  description: string
  metadata?: Record<string, any> | null
}

export const salesService = {
  getTransactions: async (
    page: number = 1,
    limit: number = 10,
    search: string = '',
    productId: string = '',
    customerId: string = '',
    type: string = '',
    status: string = '',
    startDate: string = '',
    endDate: string = '',
    sort: string = 'newest'
  ) => {
    let url = `/api/v1/sales?pageNumber=${page}&pageSize=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`
    if (productId) url += `&product=${productId}`
    if (customerId) url += `&customer=${customerId}`
    if (type) url += `&type=${encodeURIComponent(type)}`
    if (status) url += `&status=${encodeURIComponent(status)}`
    if (startDate) url += `&startDate=${startDate}`
    if (endDate) url += `&endDate=${endDate}`

    const res = await api.get<ApiResponse<PagedResult<SalesTransaction>>>(url)
    return res.data
  },

  getTransaction: async (id: string) => {
    const res = await api.get<ApiResponse<SalesTransaction>>(`/api/v1/sales/${id}`)
    return res.data
  },

  getTransactionTimeline: async (id: string) => {
    const res = await api.get<ApiResponse<SalesTransactionTimelineEvent[]>>(`/api/v1/sales/${id}/timeline`)
    return res.data
  },

  createTransaction: async (data: CreateSalesTransactionRequest) => {
    const res = await api.post<ApiResponse<SalesTransaction>>('/api/v1/sales', data)
    return res.data
  },

  updateTransaction: async ({ id, data }: { id: string; data: CreateSalesTransactionRequest }) => {
    const res = await api.put<ApiResponse<SalesTransaction>>(`/api/v1/sales/${id}`, data)
    return res.data
  },

  deleteTransaction: async (id: string) => {
    const res = await api.delete<ApiResponse<any>>(`/api/v1/sales/${id}`)
    return res.data
  },

  getDispatchHistory: async (id: string) => {
    const res = await api.get<ApiResponse<{
      parentDispatch: {
        id: string
        transactionNumber: string
        transactionDate: string
        customerName: string
        productName: string
        originalCases: number
        totalAmount: number
        returnedCases: number
        damagedCases: number
        remainingCases: number
      }
      history: Array<{
        id: string
        date: string
        createdAt: string
        transactionNumber: string
        transactionType: string
        cases: number
        totalAmount: number
        paymentMethod: string | null
        status: string
        createdBy: string
        isParent: boolean
      }>
    }>>(`/api/v1/sales/${id}/history`)
    return res.data
  },

  getDashboard: async () => {
    const res = await api.get<ApiResponse<SalesDashboard>>('/api/v1/sales/dashboard')
    return res.data
  }
}
