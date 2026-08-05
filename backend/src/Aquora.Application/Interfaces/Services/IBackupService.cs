using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Administration;

namespace Aquora.Application.Interfaces.Services
{
    public interface IBackupService
    {
        Task<BackupDashboardDto> GetBackupDashboardAsync();
        Task<List<BackupHistoryDto>> GetBackupHistoryAsync();
        Task<BackupHistoryDto?> GetBackupByIdAsync(Guid id);
        Task<BackupHistoryDto> CreateBackupAsync(CreateBackupRequest request);
        Task<(byte[] FileBytes, string ContentType, string FileName)> DownloadBackupAsync(Guid id);
        Task<bool> DeleteBackupAsync(Guid id);
        Task<RestoreHistoryDto> RestoreBackupAsync(Guid backupId, RestoreBackupRequest request);
        Task<BackupHistoryDto> UploadAndCreateBackupAsync(Stream fileStream, string fileName);
        Task<BackupStorageStatsDto> GetStorageStatsAsync();
        Task<BackupInspectionDto> InspectBackupAsync(Guid id);
        Task<TableDataPreviewDto> GetBackupTablePreviewAsync(Guid id, string tableName);
        Task<BackupVerificationDto> VerifyBackupIntegrityAsync(Guid id);
        Task<RestorePreviewDto> PreviewRestoreAsync(Guid id);
    }
}
