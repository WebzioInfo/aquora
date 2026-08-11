import { api } from './api'
import type { ApiResponse } from './auth'

export interface ProductionShift {
  id: string
  name: string
  startTime: string
  endTime: string
  description?: string
  isActive: boolean
  employeesAssigned?: number
  tenantId: string
  createdAt: string
}

export const productionShiftsService = {
  getAll: () => api.get<ApiResponse<ProductionShift[]>>('/api/v1/production-shifts'),

  create: (data: { name: string; startTime: string; endTime: string; description?: string; isActive?: boolean }) =>
    api.post<ApiResponse<ProductionShift>>('/api/v1/production-shifts', data),

  update: (id: string, data: { name: string; startTime: string; endTime: string; description?: string; isActive: boolean }) =>
    api.put<ApiResponse<ProductionShift>>(`/api/v1/production-shifts/${id}`, data),

  patchStatus: (id: string, isActive: boolean) =>
    api.patch<ApiResponse<ProductionShift>>(`/api/v1/production-shifts/${id}/status`, { isActive }),

  delete: (id: string) =>
    api.delete<ApiResponse<boolean>>(`/api/v1/production-shifts/${id}`)
}

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const hhmmMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

export function calculateShiftDuration(startTimeStr: string, endTimeStr: string): string {
  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);

  if (startMins === null || endMins === null || startMins === endMins) return '0 Hours';

  let diffMins = endMins - startMins;
  if (diffMins < 0) {
    diffMins += 24 * 60;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (mins === 0) {
    return hours === 1 ? '1 Hour' : `${hours} Hours`;
  }
  return `${hours}h ${mins}m`;
}