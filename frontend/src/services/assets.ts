import { api } from './api'

export interface DetailedAsset {
  version: string
  id: string
  assetCode: string
  assetTag: string
  assetName: string
  assetCategory: string
  assetType?: string
  serialNumber?: string
  modelNumber?: string
  manufacturer?: string
  description?: string

  purchaseDate: string
  purchasePrice: number
  supplierId?: string
  supplierName?: string
  purchaseInvoiceNumber?: string
  purchaseOrderNumber?: string
  taxAmount: number
  freightCost: number
  installationCost: number
  otherCapitalizedCost: number
  totalCapitalizedCost: number

  depreciationMethod: string
  usefulLifeYears: number
  residualValue: number
  depreciationStartDate?: string
  depreciationFrequency: string
  depreciationRate: number
  accumulatedDepreciation: number
  currentValue: number

  location?: string
  department?: string
  assignedEmployeeId?: string
  assignedEmployeeName?: string
  assignedDate?: string

  currentStatus: string
  condition: string

  warrantyDetails?: string
  warrantyStartDate?: string
  warrantyEndDate?: string
  warrantyProvider?: string
  warrantyNumber?: string
  warrantyNotes?: string
  isWarrantyActive: boolean
  isWarrantyExpiringSoon: boolean

  lastMaintenanceDate?: string
  nextMaintenanceDate?: string
  totalMaintenanceCost: number

  disposalDate?: string
  disposalMethod?: string
  disposalReason?: string
  saleValue: number
  disposalCost: number
  buyerParty?: string
  disposalRefNo?: string
  disposedBy?: string

  notes?: string
  photoUrl?: string
  documentUrl?: string

  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

export interface AssetKpiSummary {
  totalAssetsCount: number
  activeAssetsCount: number
  totalAssetValue: number
  currentBookValue: number
  accumulatedDepreciation: number
  underMaintenanceCount: number
  disposedCount: number
  warrantyExpiringCount: number
}

export interface CreateAssetInput {
  assetTag?: string
  assetName: string
  assetCategory: string
  assetType?: string
  serialNumber?: string
  modelNumber?: string
  manufacturer?: string
  description?: string

  purchaseDate?: string
  purchasePrice: number
  supplierId?: string
  supplierName?: string
  purchaseInvoiceNumber?: string
  purchaseOrderNumber?: string
  taxAmount?: number
  freightCost?: number
  installationCost?: number
  otherCapitalizedCost?: number

  depreciationMethod?: string
  usefulLifeYears?: number
  residualValue?: number
  depreciationStartDate?: string
  depreciationFrequency?: string

  location?: string
  department?: string
  assignedEmployeeId?: string
  assignedEmployeeName?: string

  condition?: string

  warrantyStartDate?: string
  warrantyEndDate?: string
  warrantyProvider?: string
  warrantyNumber?: string
  warrantyNotes?: string

  notes?: string
}

export interface AssetMutationInput { expectedVersion: string }

export interface DepreciateAssetInput extends AssetMutationInput { percentage: number; effectiveDate: string; notes?: string }
export interface AssetEmployee { id: string; fullName: string; username?: string; department?: string }

export interface UpdateAssetInput extends AssetMutationInput {
  assetTag?: string
  warrantyStartDate?: string
  warrantyEndDate?: string
  warrantyProvider?: string
  warrantyNumber?: string
  warrantyNotes?: string
  assetName: string
  assetCategory: string
  assetType?: string
  serialNumber?: string
  modelNumber?: string
  manufacturer?: string
  description?: string
  location?: string
  department?: string
  purchaseDate?: string
  condition?: string
  currentStatus?: string
  notes?: string
}

export interface AssignAssetInput extends AssetMutationInput {
  employeeId?: string
  employeeName: string
  department?: string
  assignmentDate?: string
  notes?: string
}

export interface TransferAssetInput extends AssetMutationInput {
  fromLocation: string
  toLocation: string
  fromEmployee?: string
  toEmployee?: string
  transferDate?: string
  reason: string
  notes?: string
}

export interface RecordMaintenanceInput extends AssetMutationInput {
  maintenanceType: string
  maintenanceDate?: string
  serviceProvider: string
  description: string
  partsCost?: number
  labourCost?: number
  otherCost?: number
  nextMaintenanceDate?: string
  isWarrantyClaim?: boolean
  technicianName?: string
  notes?: string
}

export interface AssetMaintenanceRecord {
  id: string
  assetId: string
  maintenanceType: string
  maintenanceDate: string
  serviceProvider: string
  description: string
  partsCost: number
  labourCost: number
  otherCost: number
  totalCost: number
  nextMaintenanceDate?: string
  isWarrantyClaim: boolean
  technicianName?: string
  notes?: string
  createdAt: string
  createdBy: string
}

export interface DisposeAssetInput extends AssetMutationInput {
  disposalDate?: string
  disposalMethod: string
  reason: string
  saleValue?: number
  disposalCost?: number
  buyerParty?: string
  referenceNumber?: string
  notes?: string
}

export interface AssetImportRow {
  assetName: string
  assetCategory: string
  assetTag?: string
  serialNumber?: string
  purchaseCost: number
  purchaseDate?: string
  location?: string
  department?: string
  status?: string
  condition?: string
}

export interface AssetImportResult {
  totalRows: number
  importedCount: number
  rowErrors: string[]
}

export interface AssetPagedResult {
  items: DetailedAsset[]
  totalCount: number
  pageNumber: number
  pageSize: number
  summary?: AssetKpiSummary
}

export interface AssetHistoryExistsResult {
  hasHistory: boolean
  reason?: string
  isDisposed?: boolean
}

export const assetService = {
  searchEmployees: async (search: string, signal?: AbortSignal) => {
    const res = await api.get<{ data: AssetEmployee[] }>('/api/v1/assets/employees/search', { params: { search }, signal })
    return res.data.data
  },
  checkAssetHistoryExists: async (id: string): Promise<AssetHistoryExistsResult> => {
    const res = await api.get<{ data: AssetHistoryExistsResult }>(`/api/v1/assets/${id}/history-exists`)
    return res.data?.data ?? { hasHistory: false }
  },
  deleteAsset: async (id: string, expectedVersion: string) => {
    await api.delete(`/api/v1/assets/${id}`, { params: { expectedVersion } })
  },
  getAssets: async (
    pageNumber = 1,
    pageSize = 50,
    search?: string,
    category?: string,
    status?: string,
    condition?: string,
    location?: string,
    department?: string,
    fromDate?: string,
    toDate?: string
  ) => {
    const params = new URLSearchParams()
    params.append('pageNumber', pageNumber.toString())
    params.append('pageSize', pageSize.toString())
    if (search) params.append('search', search)
    if (category) params.append('category', category)
    if (status) params.append('status', status)
    if (condition) params.append('condition', condition)
    if (location) params.append('location', location)
    if (department) params.append('department', department)
    if (fromDate) params.append('fromDate', fromDate)
    if (toDate) params.append('toDate', toDate)

    const res = await api.get<{ data: AssetPagedResult }>(`/api/v1/assets?${params.toString()}`)
    return res.data?.data
  },

  getKpis: async (
    search?: string,
    category?: string,
    status?: string,
    condition?: string,
    location?: string,
    department?: string,
    fromDate?: string,
    toDate?: string
  ) => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (category) params.append('category', category)
    if (status) params.append('status', status)
    if (condition) params.append('condition', condition)
    if (location) params.append('location', location)
    if (department) params.append('department', department)
    if (fromDate) params.append('fromDate', fromDate)
    if (toDate) params.append('toDate', toDate)

    const query = params.toString()
    const res = await api.get<{ data: AssetKpiSummary }>(`/api/v1/assets/kpis${query ? `?${query}` : ''}`)
    return res.data?.data
  },

  getAssetById: async (id: string) => {
    const res = await api.get<{ data: DetailedAsset }>(`/api/v1/assets/${id}`)
    return res.data?.data
  },

  createAsset: async (data: CreateAssetInput) => {
    const res = await api.post<{ data: DetailedAsset }>('/api/v1/assets', data)
    return res.data?.data
  },

  updateAsset: async (id: string, data: UpdateAssetInput) => {
    const res = await api.put<{ data: DetailedAsset }>(`/api/v1/assets/${id}`, data)
    return res.data?.data
  },

  assignAsset: async (id: string, data: AssignAssetInput) => {
    const res = await api.post<{ data: DetailedAsset }>(`/api/v1/assets/${id}/assign`, data)
    return res.data?.data
  },

  transferAsset: async (id: string, data: TransferAssetInput) => {
    const res = await api.post<{ data: DetailedAsset }>(`/api/v1/assets/${id}/transfer`, data)
    return res.data?.data
  },

  recordMaintenance: async (id: string, data: RecordMaintenanceInput) => {
    const res = await api.post<{ data: AssetMaintenanceRecord }>(`/api/v1/assets/${id}/maintenance`, data)
    return res.data?.data
  },

  getMaintenanceRecords: async (id: string) => {
    const res = await api.get<{ data: AssetMaintenanceRecord[] }>(`/api/v1/assets/${id}/maintenance`)
    return res.data?.data || []
  },

  calculateDepreciation: async (id: string, data: DepreciateAssetInput) => {
    const res = await api.post<{ data: DetailedAsset }>(`/api/v1/assets/${id}/depreciation`, data)
    return res.data?.data
  },

  disposeAsset: async (id: string, data: DisposeAssetInput) => {
    const res = await api.post<{ data: DetailedAsset }>(`/api/v1/assets/${id}/dispose`, data)
    return res.data?.data
  },

  getAssetHistory: async (id: string) => {
    const res = await api.get<{ data: Array<{ id: string; assetId: string; date: string; action: string; performedBy: string; previousValue?: string; newValue?: string; remarks?: string }> }>(`/api/v1/assets/${id}/history`)
    return res.data?.data || []
  },

  bulkUpdateStatus: async (assetIds: string[], status: string, expectedVersions: Record<string, string>, location?: string, reason?: string) => {
    const res = await api.post<{ data: boolean }>('/api/v1/assets/bulk-status', { assetIds, status, expectedVersions, location, reason })
    return res.data?.data
  },

  importAssets: async (rows: AssetImportRow[]) => {
    const res = await api.post<{ data: AssetImportResult }>('/api/v1/assets/import', rows)
    return res.data?.data
  }
}
