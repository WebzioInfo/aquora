import { api } from './api'
import type { ApiResponse } from './auth'
import type { PagedResult } from './products'

export interface BrandDto {
  id: string
  name: string
  code?: string
  description?: string
  isActive: boolean
  createdAt: string
}

export interface CreateBrandRequest {
  name: string
  code?: string
  description?: string
  isActive: boolean
}

export interface UpdateBrandRequest {
  name: string
  code?: string
  description?: string
  isActive: boolean
}

export const brandService = {
  getBrands: async (pageNumber: number = 1, pageSize: number = 10, searchTerm?: string) => {
    const params = new URLSearchParams()
    params.append('pageNumber', pageNumber.toString())
    params.append('pageSize', pageSize.toString())
    if (searchTerm) params.append('searchTerm', searchTerm)
    
    const response = await api.get<ApiResponse<PagedResult<BrandDto>>>(`/api/v1/brands?${params.toString()}`)
    return response.data
  },

  getBrandById: async (id: string) => {
    const response = await api.get<ApiResponse<BrandDto>>(`/api/v1/brands/${id}`)
    return response.data
  },

  createBrand: async (data: CreateBrandRequest) => {
    const response = await api.post<ApiResponse<BrandDto>>('/api/v1/brands', data)
    return response.data
  },

  updateBrand: async (id: string, data: UpdateBrandRequest) => {
    const response = await api.put<ApiResponse<BrandDto>>(`/api/v1/brands/${id}`, data)
    return response.data
  },

  deleteBrand: async (id: string) => {
    const response = await api.delete<ApiResponse<boolean>>(`/api/v1/brands/${id}`)
    return response.data
  }
}
