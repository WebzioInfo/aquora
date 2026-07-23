import { api } from './api'
import type { ApiResponse } from './auth'

export interface ProductionShift {
  id: string
  name: string
  startTime: string
  endTime: string
  isActive: boolean
  tenantId: string
  createdAt: string
}

export const productionShiftsService = {
  getAll: () => api.get<ApiResponse<ProductionShift[]>>('/api/v1/production-shifts'),

  create: (data: { name: string; startTime?: string; endTime?: string; isActive?: boolean }) =>
    api.post<ApiResponse<ProductionShift>>('/api/v1/production-shifts', data),

  update: (id: string, data: { name: string; startTime?: string; endTime?: string; isActive: boolean }) =>
    api.put<ApiResponse<ProductionShift>>(`/api/v1/production-shifts/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<boolean>>(`/api/v1/production-shifts/${id}`)
}