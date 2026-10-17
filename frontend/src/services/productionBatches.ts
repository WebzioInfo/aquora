import { api } from './api'

export interface ProductionBatch {
  id: string
  batchNumber: string
  product: string
  shift: string
  productionLineId: string
  productionLineName: string
  productionLineCode: string
  operatorId?: string
  operatorName?: string
  startedAt: string
  completedAt?: string | null
  targetQuantity: number
  producedQuantity: number
  status: string
  createdAt: string
  updatedAt?: string | null
}

export interface UpdateProductionBatchInput {
  batchNumber?: string
  product?: string
  shift?: string
  productionLineId?: string
  operatorId?: string
  operatorName?: string
  targetQuantity?: number
  status?: string
}

export interface StartProductionBatchInput {
  productionLineId: string
  batchNumber: string
  product: string
  shift: string
  targetQuantity: number
}

export const productionBatchesService = {
  getBatches: (params?: { status?: string; lineId?: string; search?: string; date?: string }) =>
    api.get<{ success: boolean; data: ProductionBatch[]; message: string }>('/api/v1/production/batches', { params }),

  getBatchById: (id: string) =>
    api.get<{ success: boolean; data: ProductionBatch; message: string }>(`/api/v1/production/batches/${id}`),

  getActiveBatches: () =>
    api.get<{ success: boolean; data: ProductionBatch[]; message: string }>('/api/v1/production/batches/active'),

  startBatch: (data: StartProductionBatchInput) =>
    api.post<{ success: boolean; data: any; message: string }>('/api/v1/production/batch/start', data),

  updateBatch: (id: string, data: UpdateProductionBatchInput) =>
    api.put<{ success: boolean; data: ProductionBatch; message: string }>(`/api/v1/production/batches/${id}`, data),

  deleteBatch: (id: string) =>
    api.delete<{ success: boolean; data: null; message: string }>(`/api/v1/production/batches/${id}`),

  pauseBatch: (id: string) =>
    api.post<{ success: boolean; data: any; message: string }>(`/api/v1/production/batch/${id}/pause`),

  resumeBatch: (id: string) =>
    api.post<{ success: boolean; data: any; message: string }>(`/api/v1/production/batch/${id}/resume`),

  completeBatch: (id: string) =>
    api.post<{ success: boolean; data: any; message: string }>(`/api/v1/production/batch/${id}/complete`),

  stopBatch: (id: string, reason?: string, remarks?: string) =>
    api.post<{ success: boolean; data: any; message: string }>(`/api/v1/production/batches/${id}/stop`, { reason, remarks })
}
