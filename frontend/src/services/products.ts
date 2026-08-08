import { api } from './api'
import type { ApiResponse } from './auth'

export interface Product {
  id: string
  name: string
  brandId: string
  brandName: string
  sku: string | null
  isActive: boolean
  currentStock: number
  sellingPrice?: number
  costPrice?: number
  createdAt: string
  updatedAt: string | null
}

export interface Brand {
  id: string
  name: string
}

export interface PagedResult<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface CreateProductRequest {
  name: string
  brandId: string
  sku?: string
  isActive?: boolean
  openingStock?: number
}

export interface UpdateProductRequest {
  name: string
  brandId: string
  sku?: string
  isActive: boolean
  currentStock?: number
}

export const productsService = {
  getProducts: async (
    pageNumber = 1,
    pageSize = 10,
    searchTerm = ''
  ): Promise<ApiResponse<PagedResult<Product>>> => {
    const params = new URLSearchParams()
    params.append('pageNumber', pageNumber.toString())
    params.append('pageSize', pageSize.toString())
    if (searchTerm) {
      params.append('searchTerm', searchTerm)
    }

    const response = await api.get<ApiResponse<PagedResult<Product>>>(
      `/api/v1/products?${params.toString()}`
    )
    return response.data
  },

  getProductById: async (id: string): Promise<ApiResponse<Product>> => {
    const response = await api.get<ApiResponse<Product>>(`/api/v1/products/${id}`)
    return response.data
  },

  createProduct: async (data: CreateProductRequest): Promise<ApiResponse<Product>> => {
    const response = await api.post<ApiResponse<Product>>('/api/v1/products', data)
    return response.data
  },

  updateProduct: async (id: string, data: UpdateProductRequest): Promise<ApiResponse<Product>> => {
    const response = await api.put<ApiResponse<Product>>(`/api/v1/products/${id}`, data)
    return response.data
  },

  updateUnitPrice: async (id: string, sellingPrice: number): Promise<ApiResponse<Product>> => {
    const response = await api.put<ApiResponse<Product>>(`/api/v1/products/${id}/price`, { sellingPrice })
    return response.data
  },

  deleteProduct: async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await api.delete<ApiResponse<boolean>>(`/api/v1/products/${id}`)
    return response.data
  },

  getBrands: async (): Promise<ApiResponse<Brand[]>> => {
    const response = await api.get<ApiResponse<Brand[]>>('/api/v1/products/brands')
    return response.data
  }
}
