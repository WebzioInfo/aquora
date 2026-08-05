using System;
using System.Collections.Generic;
using Aquora.Application.DTOs.Administration;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPlatformBackupJobManager
    {
        PlatformBackupJobStatusDto CreateJob(string mode);
        void UpdateJob(Guid jobId, int progressPercentage, string stepMessage, string? status = null);
        void CompleteJob(Guid jobId, Guid backupId);
        void FailJob(Guid jobId, string errorMessage);
        PlatformBackupJobStatusDto? GetJobStatus(Guid jobId);
        List<PlatformBackupJobStatusDto> GetActiveJobs();
    }
}
