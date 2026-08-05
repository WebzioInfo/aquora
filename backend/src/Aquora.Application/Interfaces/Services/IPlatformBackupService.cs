using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Administration;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPlatformBackupService
    {
        Task<PlatformBackupJobStatusDto> QueuePlatformBackupAsync(CreatePlatformBackupRequest request);
        Task<PlatformBackupJobStatusDto?> GetJobStatusAsync(Guid jobId);
        Task<List<PlatformBackupHistoryDto>> GetPlatformBackupHistoryAsync();
        Task<PlatformBackupManifestDto?> InspectPlatformBackupAsync(Guid id);
        Task<PlatformSchemaPreviewDto?> GetPlatformSchemaPreviewAsync(Guid id, string schemaName);
        Task<(byte[] FileBytes, string ContentType, string FileName)> DownloadPlatformBackupAsync(Guid id);
        Task<PlatformRestorePreviewDto> PreviewPlatformRestoreAsync(Guid id);
        Task RestorePlatformBackupAsync(Guid id, PlatformRestoreRequest request);
        Task<bool> DeletePlatformBackupAsync(Guid id);
        Task<List<PlatformTenantListDto>> GetPlatformTenantsAsync();
    }
}
