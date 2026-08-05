import { api } from '../api';

export interface BackupHistoryDto {
  id: string;
  tenantId: string;
  schemaName: string;
  backupName: string;
  description: string;
  sizeBytes: number;
  backupSize?: number;
  formattedSize: string;
  recordCount: number;
  tableCount?: number;
  checksum: string;
  hash: string;
  status: string;
  downloadCount: number;
  lastDownloaded?: string | null;
  canRestore: boolean;
  isEmergencyBackup: boolean;
  includeAttachments: boolean;
  includeAuditLogs: boolean;
  includeUsers: boolean;
  isEncrypted?: boolean;
  encryption?: string;
  format: string;
  version?: string;
  engineVersion?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export interface RestoreHistoryDto {
  restoreId: string;
  backupId: string;
  backupName: string;
  tenantId: string;
  startedBy: string;
  startedByName: string;
  startedAt: string;
  completedAt?: string | null;
  durationMs: number;
  status: string;
  ipAddress: string;
  details?: string | null;
}

export interface BackupDashboardDto {
  lastBackup?: BackupHistoryDto | null;
  totalBackups: number;
  storageUsedBytes: number;
  totalStorageBytes?: number;
  formattedStorageUsed: string;
  automaticBackupEnabled: boolean;
  backupVersion: string;
  databaseVersion?: string;
  lastVerificationDate?: string | null;
  isBackupInProgress?: boolean;
  lastRestore?: RestoreHistoryDto | null;
  recentBackups: BackupHistoryDto[];
  recentRestores: RestoreHistoryDto[];
}

export interface CreateBackupRequest {
  backupName?: string;
  description?: string;
  notes?: string;
  format?: 'AQB' | 'SQL' | string;
  includeAttachments?: boolean;
  includeAuditLogs?: boolean;
  includeUsers?: boolean;
}

export interface RestoreBackupRequest {
  confirmationText: string;
}

export interface BackupStorageStatsDto {
  totalBackupsCount: number;
  totalSizeBytes: number;
  formattedTotalSize: string;
  freeDiskSpaceBytes: number;
  formattedFreeDiskSpace: string;
}

export interface TableInspectionDto {
  tableName: string;
  rows: number;
  columns: number;
  sizeBytes: number;
  formattedSize: string;
  lastModified?: string;
}

export interface BackupInspectionDto {
  backupId: string;
  backupName: string;
  tenantName: string;
  schemaName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  version: string;
  engineVersion: string;
  checksum: string;
  totalTables: number;
  totalRecords: number;
  totalSizeBytes: number;
  formattedTotalSize: string;
  encryption: string;
  tables: TableInspectionDto[];
}

export interface TableDataPreviewDto {
  tableName: string;
  columns: string[];
  rows: Record<string, any>[];
}

export interface RestorePreviewDto {
  backupId: string;
  backupDate: string;
  version: string;
  backupTables: number;
  backupRecords: number;
  backupStorage: number;
  currentTables: number;
  currentRecords: number;
  currentStorage: number;
  isCompatible: boolean;
  warnings: string[];
}

export const backupsApi = {
  getDashboard: async (): Promise<BackupDashboardDto> => {
    const res = await api.get<{ data: BackupDashboardDto }>('/api/v1/backups/dashboard');
    return res.data.data;
  },

  getHistory: async (): Promise<BackupHistoryDto[]> => {
    const res = await api.get<{ data: BackupHistoryDto[] }>('/api/v1/backups');
    return res.data.data;
  },

  getBackupById: async (id: string): Promise<BackupHistoryDto> => {
    const res = await api.get<{ data: BackupHistoryDto }>(`/api/v1/backups/${id}`);
    return res.data.data;
  },

  createBackup: async (data: CreateBackupRequest): Promise<BackupHistoryDto> => {
    const res = await api.post<{ data: BackupHistoryDto }>('/api/v1/backups/create', data);
    return res.data.data;
  },

  downloadBackup: async (id: string, backupName: string, format?: string): Promise<void> => {
    const response = await api.get(`/api/v1/backups/${id}/download`, {
      responseType: 'blob'
    });

    let fileName = `${backupName.replace(/ /g, '_')}`;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    } else {
      const extension = format?.toUpperCase() === 'SQL' ? '.sql' : '.aqb';
      if (!fileName.endsWith('.sql') && !fileName.endsWith('.aqb')) {
        fileName += extension;
      }
    }

    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteBackup: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/backups/${id}`);
  },

  inspectBackup: async (id: string): Promise<BackupInspectionDto> => {
    const res = await api.get<{ data: BackupInspectionDto }>(`/api/v1/backups/${id}/inspect`);
    return res.data.data;
  },

  inspectBackupTable: async (id: string, tableName: string): Promise<TableDataPreviewDto> => {
    const res = await api.get<{ data: TableDataPreviewDto }>(`/api/v1/backups/${id}/inspect/${tableName}`);
    return res.data.data;
  },

  restorePreview: async (id: string): Promise<RestorePreviewDto> => {
    const res = await api.get<{ data: RestorePreviewDto }>(`/api/v1/backups/${id}/restore-preview`);
    return res.data.data;
  },

  restoreBackup: async (id: string, confirmationText: string): Promise<RestoreHistoryDto> => {
    const res = await api.post<{ data: RestoreHistoryDto }>(`/api/v1/backups/${id}/restore`, {
      confirmationText
    });
    return res.data.data;
  },

  uploadBackup: async (file: File): Promise<BackupHistoryDto> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ data: BackupHistoryDto }>('/api/v1/backups/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data.data;
  },

  getStorageStats: async (): Promise<BackupStorageStatsDto> => {
    const res = await api.get<{ data: BackupStorageStatsDto }>('/api/v1/backups/storage');
    return res.data.data;
  }
};
