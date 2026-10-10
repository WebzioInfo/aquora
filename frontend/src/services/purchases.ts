import { api, getDeduplicated } from './api'

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
  // Tax Snapshot
  taxMode?: 'GST' | 'NonGST' | string
  gstRate?: number
  taxableAmount?: number
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
  isGstOverridden?: boolean
  isInclusiveTax?: boolean
  isInterState?: boolean
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
  // Tax Breakdown Snapshot
  taxMode?: 'GST' | 'NonGST' | string
  gstRate?: number
  taxableAmount?: number
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
  isGstOverridden?: boolean
  isInclusiveTax?: boolean
  isInterState?: boolean
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

export interface UpdatePurchasePaymentRequest {
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
    const res = await getDeduplicated<{ data: PagedPurchasesResponse }>('/api/v1/purchases', { params })
    return res.data.data
  },

  getPurchaseById: async (id: string) => {
    const res = await getDeduplicated<{ data: Purchase }>(`/api/v1/purchases/${id}`)
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

  getPaymentById: async (purchaseId: string, paymentId: string) => {
    const res = await getDeduplicated<{ data: PurchasePayment }>(`/api/v1/purchases/${purchaseId}/payments/${paymentId}`)
    return res.data.data
  },

  updatePayment: async (purchaseId: string, paymentId: string, request: UpdatePurchasePaymentRequest) => {
    const res = await api.put<{ data: Purchase }>(`/api/v1/purchases/${purchaseId}/payments/${paymentId}`, request)
    return res.data.data
  },

  deletePayment: async (purchaseId: string, paymentId: string) => {
    const res = await api.delete<{ data: Purchase }>(`/api/v1/purchases/${purchaseId}/payments/${paymentId}`)
    return res.data.data
  },

  getAssetHistory: async (assetId: string) => {
    const res = await api.get<{ data: AssetHistory[] }>(`/api/v1/purchases/assets/${assetId}/history`)
    return res.data.data
  },

  // Purchase Category Architecture
  getPurchaseCategories: async (includeInactive = false) => {
    const res = await getDeduplicated<{ data: PurchaseCategory[] }>('/api/v1/purchase-categories', {
      params: { includeInactive }
    })
    return res.data.data
  },

  getPurchaseCategoryById: async (id: string) => {
    const res = await getDeduplicated<{ data: PurchaseCategory }>(`/api/v1/purchase-categories/${id}`)
    return res.data.data
  },

  createPurchaseCategory: async (request: CreatePurchaseCategoryRequest) => {
    const res = await api.post<{ data: PurchaseCategory }>('/api/v1/purchase-categories', request)
    return res.data.data
  },

  updatePurchaseCategory: async (id: string, request: UpdatePurchaseCategoryRequest) => {
    const res = await api.put<{ data: PurchaseCategory }>(`/api/v1/purchase-categories/${id}`, request)
    return res.data.data
  },

  deletePurchaseCategory: async (id: string) => {
    const res = await api.delete(`/api/v1/purchase-categories/${id}`)
    return res.data
  }
}

export interface PurchaseCategory {
  id: string
  tenantId: string
  companyId: string
  code: string
  name: string
  description?: string
  treatment: 'Inventory' | 'Asset' | 'Expense' | string
  isSystem: boolean
  isActive: boolean
  defaultLedgerAccount?: string
  affectsInventory: boolean
  requiresAsset: boolean
  requiresExpense: boolean
  affectsVendorLedger: boolean
  isGstApplicable: boolean
  defaultGstRate: number
  allowGstRateChange: boolean
  allowCustomGstRate: boolean
  requireQuantity: boolean
  requireUnit: boolean
  requireItem: boolean
  requireServiceDescription: boolean
  requireAssetDetails: boolean
  requireInvoiceNumber: boolean
  requireVendor: boolean
  requirePaymentDetails: boolean
  createdAt: string
  updatedAt?: string
}

export interface CreatePurchaseCategoryRequest {
  name: string
  treatment: 'Inventory' | 'Asset' | 'Expense' | string
  description?: string
}

export interface UpdatePurchaseCategoryRequest {
  name: string
  treatment: 'Inventory' | 'Asset' | 'Expense' | string
  description?: string
  isActive?: boolean
}
