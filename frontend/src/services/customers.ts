import { api } from './api'
import type { ApiResponse } from './auth'
import type { PagedResult } from './products'

// Main customer entity structure
export interface Customer {
  id: string
  companyId: string
  customerCode: string
  customerType: string // B2B or B2C
  customerName: string
  businessName: string | null
  contactPerson: string | null
  phone: string
  alternatePhone: string | null
  email: string | null

  // B2B specific
  gstNumber: string | null
  panNumber: string | null
  businessType: string | null
  gstState: string | null

  // Address
  addressLine1: string
  addressLine2: string | null
  city: string
  district: string
  state: string
  country: string
  pinCode: string

  // Financial
  openingBalance: number
  balanceType: string // Receivable, Payable, Zero
  creditLimit: number
  paymentTerms?: string

  // Operations
  status: string // Active, Inactive
  isActive: boolean
  remarks: string | null
  createdAt: string
  updatedAt: string | null
  createdBy?: string | null
  updatedBy?: string | null

  // Expanded Business Partner Profiles
  whatsApp?: string | null
  website?: string | null
  photoUrl?: string | null
  businessRegistration?: string | null
  businessCategory?: string | null
  industry?: string | null
  tradeLicense?: string | null
  taxExempt?: boolean
  addressesJson?: string | null

  // Financial Settings
  priceList?: string | null
  discountGroup?: string | null
  taxCategory?: string | null
  outstandingPlaceholder?: number
  ledgerPlaceholder?: string | null
  accountingPlaceholder?: string | null

  // Logistics/Distributor Profile details
  distributorType?: string | null
  commissionPercentage?: number
  monthlySalary?: number
  securityDeposit?: number
  assignedRoute?: string | null
  assignedVehicle?: string | null
  assignedDriver?: string | null
  assignedSalesExecutive?: string | null
  defaultDeliveryPriority?: string | null
  workingArea?: string | null
  workingDays?: string | null

  // 20L Water Plant operations settings
  jarDeposit?: number
  outstandingJars?: number
  reservedEmptyJars?: number
  maxJarLimit?: number
  preferredJarBrand?: string | null
  preferredCapMaterial?: string | null
  sealRequired?: boolean
  preferredDeliveryWindow?: string | null
  emergencyDelivery?: boolean
  priorityCustomer?: boolean
  preferredProductsJson?: string | null
  preferredDeliveryTime?: string | null
  deliveryFrequency?: string | null

  contactsJson?: string | null
  documentsJson?: string | null
}

export interface CreateCustomerRequest {
  companyId: string
  customerType: string
  customerName: string
  businessName?: string
  contactPerson?: string
  phone: string
  alternatePhone?: string
  email?: string

  // B2B specific
  gstNumber?: string
  panNumber?: string
  businessType?: string
  gstState?: string

  // Address
  addressLine1: string
  addressLine2?: string
  city: string
  district: string
  state: string
  country: string
  pinCode: string

  // Financial
  openingBalance: number
  balanceType: string
  creditLimit: number
  paymentTerms?: string

  status?: string
  isActive?: boolean
  remarks?: string

  // Expanded Business Partner Profiles
  whatsApp?: string
  website?: string
  photoUrl?: string
  businessRegistration?: string
  businessCategory?: string
  industry?: string
  tradeLicense?: string
  taxExempt?: boolean
  addressesJson?: string

  // Financial Settings
  priceList?: string
  discountGroup?: string
  taxCategory?: string
  outstandingPlaceholder?: number
  ledgerPlaceholder?: string
  accountingPlaceholder?: string

  // Logistics/Distributor Profile details
  distributorType?: string
  commissionPercentage?: number
  monthlySalary?: number
  securityDeposit?: number
  assignedRoute?: string
  assignedVehicle?: string
  assignedDriver?: string
  assignedSalesExecutive?: string
  defaultDeliveryPriority?: string
  workingArea?: string
  workingDays?: string

  // 20L Water Plant operations settings
  jarDeposit?: number
  outstandingJars?: number
  reservedEmptyJars?: number
  maxJarLimit?: number
  preferredJarBrand?: string
  preferredCapMaterial?: string
  sealRequired?: boolean
  preferredDeliveryWindow?: string
  emergencyDelivery?: boolean
  priorityCustomer?: boolean
  preferredProductsJson?: string
  preferredDeliveryTime?: string
  deliveryFrequency?: string

  contactsJson?: string
  documentsJson?: string
}

export interface UpdateCustomerRequest {
  customerType: string
  customerName: string
  businessName?: string
  contactPerson?: string
  phone: string
  alternatePhone?: string
  email?: string

  // B2B specific
  gstNumber?: string
  panNumber?: string
  businessType?: string
  gstState?: string

  // Address
  addressLine1: string
  addressLine2?: string
  city: string
  district: string
  state: string
  country: string
  pinCode: string

  // Financial
  openingBalance: number
  balanceType: string
  creditLimit: number
  paymentTerms?: string

  status?: string
  isActive?: boolean
  remarks?: string

  // Expanded Business Partner Profiles
  whatsApp?: string
  website?: string
  photoUrl?: string
  businessRegistration?: string
  businessCategory?: string
  industry?: string
  tradeLicense?: string
  taxExempt?: boolean
  addressesJson?: string

  // Financial Settings
  priceList?: string
  discountGroup?: string
  taxCategory?: string
  outstandingPlaceholder?: number
  ledgerPlaceholder?: string
  accountingPlaceholder?: string

  // Logistics/Distributor Profile details
  distributorType?: string
  commissionPercentage?: number
  monthlySalary?: number
  securityDeposit?: number
  assignedRoute?: string
  assignedVehicle?: string
  assignedDriver?: string
  assignedSalesExecutive?: string
  defaultDeliveryPriority?: string
  workingArea?: string
  workingDays?: string

  // 20L Water Plant operations settings
  jarDeposit?: number
  outstandingJars?: number
  reservedEmptyJars?: number
  maxJarLimit?: number
  preferredJarBrand?: string
  preferredCapMaterial?: string
  sealRequired?: boolean
  preferredDeliveryWindow?: string
  emergencyDelivery?: boolean
  priorityCustomer?: boolean
  preferredProductsJson?: string
  preferredDeliveryTime?: string
  deliveryFrequency?: string

  contactsJson?: string
  documentsJson?: string
}

export const customersService = {
  getCustomers: async (
    pageNumber = 1,
    pageSize = 10,
    searchTerm = '',
    customerType = '',
    status = '',
    state = '',
    district = '',
    city = '',
    sortBy = 'newest'
  ): Promise<ApiResponse<PagedResult<Customer>>> => {
    const params = new URLSearchParams()
    params.append('pageNumber', pageNumber.toString())
    params.append('pageSize', pageSize.toString())
    params.append('sortBy', sortBy)

    if (searchTerm) params.append('searchTerm', searchTerm)
    if (customerType) params.append('customerType', customerType)
    if (status) params.append('status', status)
    if (state) params.append('state', state)
    if (district) params.append('district', district)
    if (city) params.append('city', city)

    const response = await api.get<ApiResponse<PagedResult<Customer>>>(
      `/api/v1/customers?${params.toString()}`
    )
    return response.data
  },

  getCustomerById: async (id: string): Promise<ApiResponse<Customer>> => {
    const response = await api.get<ApiResponse<Customer>>(`/api/v1/customers/${id}`)
    return response.data
  },

  createCustomer: async (data: CreateCustomerRequest): Promise<ApiResponse<Customer>> => {
    const response = await api.post<ApiResponse<Customer>>('/api/v1/customers', data)
    return response.data
  },

  updateCustomer: async (id: string, data: UpdateCustomerRequest): Promise<ApiResponse<Customer>> => {
    const response = await api.put<ApiResponse<Customer>>(`/api/v1/customers/${id}`, data)
    return response.data
  },

  deleteCustomer: async (id: string): Promise<ApiResponse<boolean>> => {
    const response = await api.delete<ApiResponse<boolean>>(`/api/v1/customers/${id}`)
    return response.data
  }
}
