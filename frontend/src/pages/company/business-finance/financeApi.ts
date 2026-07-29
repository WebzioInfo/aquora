import { api } from '../../../services/api'

export const getDashboardKpis = () => api.get('/api/v1/BusinessFinance/dashboard').then((res: any) => res.data.data)
export const getExpenseAnalytics = () => api.get('/api/v1/BusinessFinance/expenses').then((res: any) => res.data.data)
export const getProductionCost = () => api.get('/api/v1/BusinessFinance/production-cost').then((res: any) => res.data.data)
export const getMaterialLoss = () => api.get('/api/v1/BusinessFinance/material-loss').then((res: any) => res.data.data)
export const getMachineCost = () => api.get('/api/v1/BusinessFinance/machine-cost').then((res: any) => res.data.data)
export const getEmployeeImpact = () => api.get('/api/v1/BusinessFinance/employee-impact').then((res: any) => res.data.data)
export const getProductProfitability = () => api.get('/api/v1/BusinessFinance/product-profitability').then((res: any) => res.data.data)
export const getCustomerAnalytics = () => api.get('/api/v1/BusinessFinance/customer-analytics').then((res: any) => res.data.data)
export const getInsights = () => api.get('/api/v1/BusinessFinance/insights').then((res: any) => res.data.data)
