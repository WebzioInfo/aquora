import { api } from './api'

export interface PurchaseItem {
  id?: string
  purchaseId?: string
  rawMaterialId?: string
  rawMaterialName?: string
  itemName: string
  quantity: number
  unit: string
  unitPrice: number
  gstPercent: number
  discountAmount: number
  totalAmount: number
}

export interface PurchasePayment {
  id: string
  purchaseId: string
  paymentDate: string
  paymentMethod: string
  bankAccountId?: string
  bankAccountName?: string
  cashBookId?: string
  cashBookName?: string
  amount: number
  referenceNo?: string
  notes?: string
  createdAt: string
  createdBy: string
  createdByName?: string
}

export interface PurchaseTimelineEvent {
  id: string
  purchaseId: string
  eventDate: string
  action: string
  performedBy: string
  performedByName?: string
  details: string
  notes?: string
}

export interface AssetHistory {
  id: string
  assetId: string
  date: string
  action: string
  performedBy: string
  performedByName?: string
  previousValue?: string
  newValue?: string
  remarks?: string
}

export interface PurchaseSummaryStats {
  totalPurchasesCount: number
  todayPurchasesCount: number
  totalPurchaseValue: number
  outstandingBalance: number
  pendingPaymentsCount: number
  activeVendorsCount: number
}

export interface Purchase {
  id: string
  purchaseNo: string
  purchaseDate: string
  vendorId?: string
  vendorName: string
  vendorCode?: string
  purchaseCategory: string
  invoiceNumber?: string
  referenceNumber?: string
  paymentMethod: string
  bankAccountId?: string
  bankAccountName?: string
  cashBookId?: string
  cashBookName?: string
  subTotal: number
  taxAmount: number
  discountAmount: number
  otherCharges: number
  grandTotal: number
  amountPaid: number
  balanceAmount: number
  paymentStatus: string
  isCancelled?: boolean
  cancelledAt?: string
  cancelledByName?: string
  notes?: string
  attachmentUrl?: string
  assetId?: string
  assetName?: string
  categoryMetadataJson?: string
  items: PurchaseItem[]
  payments: PurchasePayment[]
  timelineEvents: PurchaseTimelineEvent[]
  createdAt: string
  createdBy: string
  createdByName?: string
  updatedAt?: string
  updatedByName?: string
}

export interface CreatePurchaseRequest {
  purchaseDate: string
  vendorId?: string
  vendorName: string
  purchaseCategory: string
  invoiceNumber?: string
  referenceNumber?: string
  paymentMethod: string
  bankAccountId?: string
  cashBookId?: string
  subTotal: number
  taxAmount: number
  discountAmount: number
  otherCharges: number
  grandTotal: number
  amountPaid: number
  notes?: string
  attachmentUrl?: string
  categoryMetadataJson?: string
  items: PurchaseItem[]
}

export interface AddPurchasePaymentRequest {
  paymentDate: string
  paymentMethod: string
  bankAccountId?: string
  cashBookId?: string
  amount: number
  referenceNo?: string
  notes?: string
}

export interface PagedPurchasesResponse {
  items: Purchase[]
  totalCount: number
  pageNumber: number
  pageSize: number
  summaryStats?: PurchaseSummaryStats
}

export const purchaseService = {
  getPurchases: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    startDate?: string
    endDate?: string
    vendorId?: string
    category?: string
    paymentStatus?: string
  }) => {
    const res = await api.get<{ data: PagedPurchasesResponse }>('/api/v1/purchases', { params })
    return res.data.data
  },

  getPurchaseById: async (id: string) => {
    const res = await api.get<{ data: Purchase }>(`/api/v1/purchases/${id}`)
    return res.data.data
  },

  createPurchase: async (request: CreatePurchaseRequest) => {
    const res = await api.post<{ data: Purchase }>('/api/v1/purchases', request)
    return res.data.data
  },

  updatePurchase: async (id: string, request: Partial<CreatePurchaseRequest>) => {
    const res = await api.put<{ data: Purchase }>(`/api/v1/purchases/${id}`, request)
    return res.data.data
  },

  cancelPurchase: async (id: string) => {
    const res = await api.post<{ data: boolean }>(`/api/v1/purchases/${id}/cancel`)
    return res.data.data
  },

  duplicatePurchase: async (id: string) => {
    const res = await api.post<{ data: CreatePurchaseRequest }>(`/api/v1/purchases/${id}/duplicate`)
    return res.data.data
  },

  deletePurchase: async (id: string) => {
    const res = await api.delete(`/api/v1/purchases/${id}`)
    return res.data
  },

  addPayment: async (id: string, request: AddPurchasePaymentRequest) => {
    const res = await api.post<{ data: Purchase }>(`/api/v1/purchases/${id}/payments`, request)
    return res.data.data
  },

  getAssetHistory: async (assetId: string) => {
    const res = await api.get<{ data: AssetHistory[] }>(`/api/v1/purchases/assets/${assetId}/history`)
    return res.data.data
  }
}
