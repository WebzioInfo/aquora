import { api } from './api'

export interface SalaryPayment {
  id: string
  salaryNo: string
  employeeId: string
  employeeName: string
  department: string
  designation: string
  salaryMonth: string
  monthlySalary: number
  workingDays: number
  daysWorked: number
  netSalary: number
  paymentMethod: string
  paidFrom: string
  paymentDate: string
  status: string
}

export interface SalaryPaymentDetails extends SalaryPayment {
  dailySalary: number
  grossSalary: number
  bonus: number
  advanceDeduction: number
  otherDeduction: number
  bankAccountId?: string
  cashBookId?: string
  remarks?: string
}

export interface CreateSalaryPaymentRequest {
  employeeId: string
  salaryMonth: string
  workingDays: number
  daysWorked: number
  bonus: number
  advanceDeduction: number
  otherDeduction: number
  paymentMethod: string
  bankAccountId?: string
  cashBookId?: string
  remarks?: string
}

export interface PagedSalaryPaymentsResponse {
  items: SalaryPayment[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export const payrollService = {
  getSalaryPayments: async (params?: {
    pageNumber?: number
    pageSize?: number
    search?: string
    month?: string
    employeeId?: string
  }) => {
    const res = await api.get<{ data: PagedSalaryPaymentsResponse }>('/api/v1/SalaryPayments', { params })
    return res.data.data
  },

  getSalaryPaymentById: async (id: string) => {
    const res = await api.get<{ data: SalaryPaymentDetails }>(`/api/v1/SalaryPayments/${id}`)
    return res.data.data
  },

  createSalaryPayment: async (request: CreateSalaryPaymentRequest) => {
    const res = await api.post<{ data: SalaryPayment }>('/api/v1/SalaryPayments', request)
    return res.data.data
  },

  updateSalaryPayment: async (id: string, request: CreateSalaryPaymentRequest) => {
    const res = await api.put<{ data: SalaryPayment }>(`/api/v1/SalaryPayments/${id}`, request)
    return res.data.data
  },

  deleteSalaryPayment: async (id: string) => {
    const res = await api.delete(`/api/v1/SalaryPayments/${id}`)
    return res.data
  },

  getSalaryPaymentHistory: async (id: string) => {
    const res = await api.get<{ data: any[] }>(`/api/v1/SalaryPayments/${id}/history`)
    return res.data.data
  }
}
