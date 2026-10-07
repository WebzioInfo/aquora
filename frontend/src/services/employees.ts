import { api } from './api'

export interface EmployeeDto {
  id: string
  fullName: string
  username: string
  email: string
  roleName: string
  roleCode: string
  department: string
  currentSalary: number
  isActive: boolean
  createdAt?: string
  lastLogin?: string | null
  ownerId?: string | null
  phone?: string | null
}

export interface EmployeeRole {
  id: string
  code: string
  name: string
}

export interface CreateEmployeePayload {
  fullName: string
  username: string
  email: string
  roleCode: string
  passwordOrPin: string
  department?: string
  currentSalary: number
  phone?: string
  ownershipPercentage?: number
  initialInvestment?: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  errors?: string[]
}

export const employeesService = {
  getEmployees: async (): Promise<EmployeeDto[]> => {
    const res = await api.get<ApiResponse<EmployeeDto[]>>('/api/v1/employees')
    return res.data?.data || []
  },

  getRoles: async (): Promise<EmployeeRole[]> => {
    const res = await api.get<ApiResponse<EmployeeRole[]>>('/api/v1/employees/roles')
    const list = res.data?.data || []
    return list.filter(r => {
      const name = (r.name || '').trim().toLowerCase()
      const code = (r.code || '').trim().toUpperCase()
      return name !== 'admin' && code !== 'ADMIN'
    })
  },

  getDepartments: async (): Promise<string[]> => {
    const res = await api.get<ApiResponse<string[]>>('/api/v1/employees/departments')
    return res.data?.data || [
      'Administration',
      'Operations',
      'Production',
      'Sales',
      'Finance',
      'HR',
      'IT Support',
      'Quality'
    ]
  },

  createEmployee: async (payload: CreateEmployeePayload): Promise<ApiResponse<EmployeeDto>> => {
    const res = await api.post<ApiResponse<EmployeeDto>>('/api/v1/employees', payload)
    return res.data
  }
}
