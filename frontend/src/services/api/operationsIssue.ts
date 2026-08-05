import { api } from '../api';

export interface OperationsIssue {
  id: string;
  issueNumber: string;
  title: string;
  description: string;
  department: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | 'Emergency';
  status: 'Open' | 'Acknowledged' | 'Assigned' | 'InProgress' | 'WaitingForParts' | 'WaitingVendor' | 'OnHold' | 'Resolved' | 'Verified' | 'Closed' | 'Rejected';
  reportedByUserId: string;
  reportedByName: string;
  assignedToUserId?: string;
  assignedToName?: string;
  machineId?: string;
  machineName?: string;
  productionLineId?: string;
  productionLineName?: string;
  batchNumber?: string;
  shiftId?: string;
  reportedAt: string;
  dueDate?: string;
  resolvedAt?: string;
  closedAt?: string;
  verifiedAt?: string;
  estimatedCost?: number;
  actualCost?: number;
  downtimeMinutes?: number;
  requiresMaintenance: boolean;
  maintenanceWorkOrderId?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  attachments?: string;
  commentsCount: number;
  createdAt: string;
}

export interface OperationsIssueComment {
  id: string;
  issueId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface OperationsIssueHistory {
  id: string;
  issueId: string;
  performedBy: string;
  action: string;
  details?: string;
  timestamp: string;
}

export interface OperationsIssueDetail extends OperationsIssue {
  comments: OperationsIssueComment[];
  historyLogs: OperationsIssueHistory[];
}

export interface CreateOperationsIssueRequest {
  title: string;
  description: string;
  department: string;
  category: string;
  priority: string;
  machineId?: string;
  machineName?: string;
  productionLineId?: string;
  productionLineName?: string;
  batchNumber?: string;
  shiftId?: string;
  dueDate?: string;
  estimatedCost?: number;
  downtimeMinutes?: number;
  requiresMaintenance?: boolean;
  attachments?: string;
}

export interface QuickOperatorReportRequest {
  department: string;
  category: string;
  priority: string;
  description: string;
  machineId?: string;
  machineName?: string;
  downtimeMinutes?: number;
  attachments?: string;
}

export interface OperationsIssueDashboard {
  totalIssues: number;
  openIssues: number;
  criticalIssues: number;
  overdueIssues: number;
  resolvedToday: number;
  machineBreakdowns: number;
  productionStoppages: number;
  avgResolutionTimeHours: number;
  totalDowntimeMinutes: number;
  departmentStats: { department: string; count: number }[];
  priorityStats: { priority: string; count: number }[];
  statusStats: { status: string; count: number }[];
  topProblemMachines: { machineName: string; issueCount: number; totalDowntimeMinutes: number }[];
  recentIssues: OperationsIssue[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export const operationsIssueApi = {
  getIssues: (params?: {
    pageNumber?: number;
    pageSize?: number;
    search?: string;
    department?: string;
    category?: string;
    priority?: string;
    status?: string;
    machineId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get<PagedResult<OperationsIssue>>('/api/v1/company/operations-issues', { params }),

  getDashboard: () => api.get<OperationsIssueDashboard>('/api/v1/company/operations-issues/dashboard'),

  getIssueById: (id: string) => api.get<OperationsIssueDetail>(`/api/v1/company/operations-issues/${id}`),

  createIssue: (data: CreateOperationsIssueRequest) =>
    api.post<OperationsIssue>('/api/v1/company/operations-issues', data),

  quickOperatorReport: (data: QuickOperatorReportRequest) =>
    api.post<OperationsIssue>('/api/v1/company/operations-issues/quick-report', data),

  updateIssue: (id: string, data: Partial<CreateOperationsIssueRequest> & { status?: string; assignedToUserId?: string; assignedToName?: string }) =>
    api.put<OperationsIssue>(`/api/v1/company/operations-issues/${id}`, data),

  changeStatus: (id: string, status: string, note?: string) =>
    api.post<OperationsIssue>(`/api/v1/company/operations-issues/${id}/status`, { status, note }),

  assignIssue: (id: string, assignedToUserId: string, assignedToName: string, note?: string) =>
    api.post<OperationsIssue>(`/api/v1/company/operations-issues/${id}/assign`, { assignedToUserId, assignedToName, note }),

  addComment: (id: string, message: string, attachmentUrl?: string) =>
    api.post<OperationsIssueComment>(`/api/v1/company/operations-issues/${id}/comments`, { message, attachmentUrl }),

  resolveIssue: (id: string, data: { rootCause: string; correctiveAction: string; preventiveAction?: string; actualCost?: number; downtimeMinutes?: number; resolutionNote?: string }) =>
    api.post<OperationsIssue>(`/api/v1/company/operations-issues/${id}/resolve`, data),

  verifyAndCloseIssue: (id: string, note?: string) =>
    api.post<OperationsIssue>(`/api/v1/company/operations-issues/${id}/verify`, JSON.stringify(note), {
      headers: { 'Content-Type': 'application/json' }
    }),

  createWorkOrder: (id: string) =>
    api.post<OperationsIssue>(`/api/v1/company/operations-issues/${id}/create-work-order`),

  deleteIssue: (id: string) =>
    api.delete(`/api/v1/company/operations-issues/${id}`)
};
