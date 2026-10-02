import { api } from './api'
import type { Purchase } from './purchases'

export interface Vendor {
  id: string
  vendorCode?: string
  name: string
  phone?: string
  email?: string
  gst?: string
  address?: string
  openingBalance: number
  currentBalance: number
  creditLimit: number
  isActive: boolean
  notes?: string
  createdAt: string
  createdByName?: string
  totalPurchasesCount: number
  totalPurchaseValue: number
  lastPurchaseDate?: string
}

export interface VendorDropdownItem {
  id: string
  name: string
  gst?: string
  currentBalance: number
}

export interface CreateVendorRequest {
  name: string
  phone?: string
  email?: string
  gst?: string
  address?: string
  openingBalance?: number
  creditLimit?: number
  notes?: string
}

export interface UpdateVendorRequest {
  name: string
  phone?: string
  email?: string
  gst?: string
  address?: string
  creditLimit?: number
  isActive?: boolean
  notes?: string
}

export interface VendorSummaryStats {
  outstandingBalance: number
  totalPurchasesCount: number
  totalPurchaseValue: number
  paidAmount: number
  pendingAmount: number
  averagePurchaseValue: number
  lastPurchaseDate?: string
}

export interface VendorLedgerEntry {
  id: string
  date: string
  transactionType: string
  voucherNo: string
  debit: number
  credit: number
  runningBalance: number
  reference?: string
  remarks?: string
}

export interface VendorTimelineEvent {
  id: string
  eventDate: string
  action: string
  performedByName: string
  details: string
}

export interface VendorDetails {
  vendor: Vendor
  summaryStats: VendorSummaryStats
  purchases: Purchase[]
  ledger: VendorLedgerEntry[]
  timeline: VendorTimelineEvent[]
}

export interface PagedVendorsResponse {
  items: Vendor[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface RecordVendorPaymentRequest {
  amount: number
  paymentDate?: string
  paymentMethod: 'BankAccount' | 'Cash' | string
  bankAccountId?: string
  cashBookId?: string
  referenceNumber?: string
  notes?: string
}

export const vendorService = {
  getVendors: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
  }) => {
    const res = await api.get<{ data: PagedVendorsResponse }>('/api/v1/vendors', { params })
    return res.data.data
  },

  getVendorDropdown: async () => {
    const res = await api.get<{ data: VendorDropdownItem[] }>('/api/v1/vendors/dropdown')
    return res.data.data
  },

  getVendorById: async (id: string) => {
    const res = await api.get<{ data: Vendor }>(`/api/v1/vendors/${id}`)
    return res.data.data
  },

  getVendorDetails: async (id: string) => {
    const res = await api.get<{ data: VendorDetails }>(`/api/v1/vendors/${id}/details`)
    return res.data.data
  },

  createVendor: async (request: CreateVendorRequest) => {
    const res = await api.post<{ data: Vendor }>('/api/v1/vendors', request)
    return res.data.data
  },

  updateVendor: async (id: string, request: UpdateVendorRequest) => {
    const res = await api.put<{ data: Vendor }>(`/api/v1/vendors/${id}`, request)
    return res.data.data
  },

  toggleVendorStatus: async (id: string) => {
    const res = await api.post<{ data: boolean }>(`/api/v1/vendors/${id}/toggle-status`)
    return res.data.data
  },

  deleteVendor: async (id: string) => {
    const res = await api.delete(`/api/v1/vendors/${id}`)
    return res.data
  },

  recordPayment: async (id: string, request: RecordVendorPaymentRequest) => {
    const res = await api.post<{ data: Vendor }>(`/api/v1/vendors/${id}/payments`, request)
    return res.data.data
  }
}
