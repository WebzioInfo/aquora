import { api } from '../api';

export interface WaterTestParameter {
    id: string;
    name: string;
    category: string;
    unit: string;
    minAcceptable?: number | null;
    maxAcceptable?: number | null;
}

export interface WaterTestResult {
    id: string;
    parameterId: string;
    parameterName: string;
    parameterCategory: string;
    parameterUnit: string;
    value?: number | null;
    stringValue?: string | null;
    isPass: boolean;
    qualityStatus: string;
}

export interface WaterTestReport {
    id: string;
    reportNumber: string;
    batchNumber: string;
    sampleNumber?: string | null;
    productionDate?: string | null;
    reportType: string;
    status: string;
    sampleTime?: string | null;
    testedBy?: string | null;
    collectedBy?: string | null;
    verifiedBy?: string | null;
    remarks?: string | null;
    attachments?: string | null;
    createdAt: string;
    createdBy: string;
    createdByName: string;
    results: WaterTestResult[];
}

export interface CreateWaterTestReportRequest {
    batchNumber: string;
    sampleNumber?: string | null;
    productionDate?: string | null;
    reportType: string;
    status: string;
    sampleTime?: string | null;
    testedBy?: string | null;
    collectedBy?: string | null;
    verifiedBy?: string | null;
    remarks?: string | null;
    attachments?: string | null;
    results: {
        parameterId: string;
        value?: number | null;
        stringValue?: string | null;
    }[];
}

export interface MonthlyReportStat {
    month: string;
    passed: number;
    failed: number;
}

export interface WaterTestDashboard {
    totalReports: number;
    todayReports: number;
    passedReports: number;
    failedReports: number;
    pendingReports: number;
    monthlyStats: MonthlyReportStat[];
    recentReports: WaterTestReport[];
}

export interface PagedResult<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
}

export interface ComplianceRecord {
    id: string;
    reportId?: string | null;
    referenceNumber: string;
    type: string;
    severity: string;
    status: string;
    parameterName: string;
    batchNumber: string;
    defectDescription: string;
    measuredValue?: string | null;
    expectedRange?: string | null;
    rootCauseAnalysis?: string | null;
    correctiveAction?: string | null;
    preventiveAction?: string | null;
    assignedTo: string;
    targetResolutionDate?: string | null;
    resolvedAt?: string | null;
    resolvedBy?: string | null;
    resolutionNotes?: string | null;
    createdAt: string;
    createdBy: string;
}

export interface ResolveComplianceRequest {
    rootCauseAnalysis: string;
    correctiveAction: string;
    preventiveAction: string;
    resolutionNotes: string;
}

export interface QCSettings {
    autoGenerateCAPAOnFailure: boolean;
    requireVerificationBeforeSubmit: boolean;
    standardComplianceType: string;
    digitalSignatureTitle: string;
    labAddress: string;
    contactEmail: string;
    notificationRecipients: string;
}

export interface QCAuditLog {
    id: string;
    reportId?: string | null;
    reportNumber?: string | null;
    action: string;
    performedBy: string;
    userRole?: string | null;
    timestamp: string;
    details: string;
    ipAddress?: string | null;
}

export const waterTestApi = {
    getDashboard: () => api.get<WaterTestDashboard>('/api/v1/qc/water-test/dashboard'),
    
    getReports: (params: { pageNumber?: number; pageSize?: number; search?: string; type?: string; status?: string; startDate?: string; endDate?: string }) => 
        api.get<PagedResult<WaterTestReport>>('/api/v1/qc/water-test/reports', { params }),
    
    getReportById: (id: string) => api.get<WaterTestReport>(`/api/v1/qc/water-test/reports/${id}`),
    
    createReport: (data: CreateWaterTestReportRequest) => api.post<WaterTestReport>('/api/v1/qc/water-test/reports', data),
    
    updateReport: (id: string, data: CreateWaterTestReportRequest) => api.put<WaterTestReport>(`/api/v1/qc/water-test/reports/${id}`, data),
    
    deleteReport: (id: string) => api.delete(`/api/v1/qc/water-test/reports/${id}`),
    
    getParameters: () => api.get<WaterTestParameter[]>('/api/v1/qc/water-test/parameters'),
 
    saveParameter: (param: Partial<WaterTestParameter>) => api.post<WaterTestParameter>('/api/v1/qc/water-test/parameters', param),

    // Compliance (NCR/CAPA)
    getComplianceRecords: () => api.get<ComplianceRecord[]>('/api/v1/qc/water-test/compliance'),

    resolveComplianceRecord: (id: string, data: ResolveComplianceRequest) =>
        api.post(`/api/v1/qc/water-test/compliance/${id}/resolve`, data),

    // QC Settings & Audit Logs
    getSettings: () => api.get<QCSettings>('/api/v1/qc/water-test/settings'),

    updateSettings: (settings: QCSettings) => api.put<QCSettings>('/api/v1/qc/water-test/settings', settings),

    getAuditLogs: (reportId?: string) => api.get<QCAuditLog[]>('/api/v1/qc/water-test/audit-logs', { params: { reportId } }),

    downloadReportPdf: (id: string) => api.get(`/api/v1/qc/water-test/reports/${id}/pdf`, { responseType: 'blob' })
};
