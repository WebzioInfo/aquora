import { api } from '../api';

export interface CreatePlatformBackupRequest {
  backupName?: string;
  notes?: string;
  mode: 'FULL_PLATFORM' | 'SINGLE_TENANT' | 'MULTIPLE_TENANT' | 'PUBLIC_ONLY';
  targetTenantId?: string;
  selectedTenantIds?: string[];
  encrypted?: boolean;
}

export interface PlatformBackupJobStatusDto {
  jobId: string;
  mode: string;
  status: 'Queued' | 'Preparing' | 'Reading' | 'Compressing' | 'Encrypting' | 'Writing' | 'Completed' | 'Failed';
  progressPercentage: number;
  currentStepMessage: string;
  backupId?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface PlatformSchemaMetaDto {
  schemaName: string;
  tenantName: string;
  tablesCount: number;
  recordsCount: number;
  sizeBytes: number;
  formattedSize: string;
  sqlFileName: string;
}

export interface PlatformBackupManifestDto {
  backupId: string;
  backupName: string;
  platformVersion: string;
  databaseVersion: string;
  engineVersion: string;
  backupDate: string;
  createdBy: string;
  createdByName: string;
  createdMachine: string;
  createdIP: string;
  tenantCount: number;
  schemaCount: number;
  publicIncluded: boolean;
  encrypted: boolean;
  checksum: string;
  totalTables: number;
  totalRecords: number;
  databaseSizeBytes: number;
  formattedDatabaseSize: string;
  fileSizeBytes: number;
  formattedFileSize: string;
  schemas: PlatformSchemaMetaDto[];
}

export interface PlatformSchemaPreviewDto {
  backupId: string;
  schemaName: string;
  isPreviewAvailable: boolean;
  message?: string;
  tableNames: string[];
  tablesData: Record<string, Array<Record<string, any>>>;
  tableTotalRecordCounts: Record<string, number>;
}

export interface PlatformBackupHistoryDto {
  id: string;
  backupName: string;
  mode: string;
  description: string;
  backupSize: number;
  formattedSize: string;
  recordCount: number;
  tableCount: number;
  schemaCount: number;
  tenantCount: number;
  checksum: string;
  status: string;
  format: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export interface PlatformTenantListDto {
  tenantId: string;
  companyCode: string;
  companyName: string;
  schemaName: string;
  isInitialized: boolean;
  status: string;
}

export interface PlatformRestorePreviewDto {
  backupId: string;
  backupDate: string;
  mode: string;
  backupSchemas: number;
  backupTables: number;
  backupRecords: number;
  backupSize: number;
  currentActiveSchemas: number;
  currentActiveTables: number;
  currentActiveRecords: number;
  isVerified: boolean;
  warnings: string[];
  targetSchemas: string[];
}

export const platformBackupsApi = {
  createBackup: async (request: CreatePlatformBackupRequest): Promise<PlatformBackupJobStatusDto> => {
    const res = await api.post<{ data: PlatformBackupJobStatusDto }>('/api/v1/platform/backups/create', request);
    return res.data.data;
  },

  getJobStatus: async (jobId: string): Promise<PlatformBackupJobStatusDto> => {
    const res = await api.get<{ data: PlatformBackupJobStatusDto }>(`/api/v1/platform/backups/jobs/${jobId}`);
    return res.data.data;
  },

  getHistory: async (): Promise<PlatformBackupHistoryDto[]> => {
    const res = await api.get<{ data: PlatformBackupHistoryDto[] }>('/api/v1/platform/backups');
    return res.data.data;
  },

  inspectBackup: async (id: string): Promise<PlatformBackupManifestDto> => {
    const res = await api.get<{ data: PlatformBackupManifestDto }>(`/api/v1/platform/backups/${id}/inspect`);
    return res.data.data;
  },

  getSchemaPreview: async (id: string, schemaName: string): Promise<PlatformSchemaPreviewDto> => {
    const res = await api.get<{ data: PlatformSchemaPreviewDto }>(`/api/v1/platform/backups/${id}/preview/${schemaName}`);
    return res.data.data;
  },

  downloadBackup: async (id: string, backupName: string): Promise<void> => {
    const response = await api.get(`/api/v1/platform/backups/${id}/download`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${backupName.replace(/ /g, '_')}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  restorePreview: async (id: string): Promise<PlatformRestorePreviewDto> => {
    const res = await api.post<{ data: PlatformRestorePreviewDto }>(`/api/v1/platform/backups/${id}/restore-preview`);
    return res.data.data;
  },

  restoreBackup: async (id: string, confirmationText: string, restoreMode = 'FULL_PLATFORM', targetSchemas: string[] = []): Promise<void> => {
    await api.post(`/api/v1/platform/backups/${id}/restore`, {
      confirmationText,
      restoreMode,
      targetSchemas
    });
  },

  deleteBackup: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/platform/backups/${id}`);
  },

  getTenants: async (): Promise<PlatformTenantListDto[]> => {
    const res = await api.get<{ data: PlatformTenantListDto[] }>('/api/v1/platform/backups/tenants');
    return res.data.data;
  }
};
