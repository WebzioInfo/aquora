import { api } from './api'
import type { ApiResponse } from './auth'
import type { PagedResult } from './products'

export interface RawMaterial {
  id: string
  name: string
  category: string
  unit: string
  code?: string
  costPerUnit?: number
  currentStock?: number
  baseUnit?: string
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateRawMaterialRequest {
  name: string
  category: string
  unit: string
  isActive?: boolean
  currentStock?: number
}

export interface UpdateRawMaterialRequest {
  name: string
  category: string
  unit: string
  isActive: boolean
  currentStock?: number
}

export const rawMaterialsService = {
  getRawMaterials: async (
    pageNumber = 1,
    pageSize = 10,
    searchTerm = ''
  ): Promise<ApiResponse<PagedResult<RawMaterial>>> => {
    const params = new URLSearchParams()
    params.append('pageNumber', pageNumber.toString())
    params.append('pageSize', pageSize.toString())
    if (searchTerm) {
      params.append('searchTerm', searchTerm)
    }

    const response = await api.get<ApiResponse<PagedResult<RawMaterial>>>(
      `/api/v1/rawmaterials?${params.toString()}`
    )
    return response.data
  },

  getRawMaterialById: async (id: string): Promise<ApiResponse<RawMaterial>> => {
    const response = await api.get<ApiResponse<RawMaterial>>(`/api/v1/rawmaterials/${id}`)
    return response.data
  },

  createRawMaterial: async (data: CreateRawMaterialRequest): Promise<ApiResponse<RawMaterial>> => {
    const response = await api.post<ApiResponse<RawMaterial>>('/api/v1/rawmaterials', data)
    return response.data
  },

  updateRawMaterial: async (id: string, data: UpdateRawMaterialRequest): Promise<ApiResponse<RawMaterial>> => {
    const response = await api.put<ApiResponse<RawMaterial>>(`/api/v1/rawmaterials/${id}`, data)
    return response.data
  },

  updateUnitPrice: async (id: string, costPerUnit: number): Promise<ApiResponse<RawMaterial>> => {
    const response = await api.put<ApiResponse<RawMaterial>>(`/api/v1/rawmaterials/${id}/price`, { costPerUnit })
    return response.data
  },

  addStock: async (id: string, data: { quantity: number; notes?: string }): Promise<ApiResponse<RawMaterial>> => {
    const response = await api.post<ApiResponse<RawMaterial>>(`/api/v1/rawmaterials/${id}/add-stock`, data)
    return response.data
  },

  deleteRawMaterial: async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await api.delete<ApiResponse<boolean>>(`/api/v1/rawmaterials/${id}`)
    return response.data
  }
}
