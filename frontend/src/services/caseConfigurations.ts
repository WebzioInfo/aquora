import { api } from './api'
import type { ApiResponse } from './auth'

export interface CaseConfiguration {
  id: string
  productId: string
  productName: string
  productSku: string | null
  unitsPerCase: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateCaseConfigurationRequest {
  productId: string
  unitsPerCase: number
}

export interface UpdateCaseConfigurationRequest {
  productId?: string
  unitsPerCase: number
  isActive?: boolean
}

export const caseConfigurationsService = {
  getAll: async (includeInactive = true): Promise<ApiResponse<CaseConfiguration[]>> => {
    const res = await api.get<ApiResponse<CaseConfiguration[]>>(
      `/api/v1/case-configurations?includeInactive=${includeInactive}`
    )
    return res.data
  },

  getById: async (id: string): Promise<ApiResponse<CaseConfiguration>> => {
    const res = await api.get<ApiResponse<CaseConfiguration>>(`/api/v1/case-configurations/${id}`)
    return res.data
  },

  getByProductId: async (productId: string): Promise<ApiResponse<CaseConfiguration>> => {
    const res = await api.get<ApiResponse<CaseConfiguration>>(`/api/v1/case-configurations/product/${productId}`)
    return res.data
  },

  create: async (data: CreateCaseConfigurationRequest): Promise<ApiResponse<CaseConfiguration>> => {
    const res = await api.post<ApiResponse<CaseConfiguration>>('/api/v1/case-configurations', data)
    return res.data
  },

  update: async (id: string, data: UpdateCaseConfigurationRequest): Promise<ApiResponse<CaseConfiguration>> => {
    const res = await api.put<ApiResponse<CaseConfiguration>>(`/api/v1/case-configurations/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<ApiResponse<boolean>> => {
    const res = await api.delete<ApiResponse<boolean>>(`/api/v1/case-configurations/${id}`)
    return res.data
  }
}
