using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class PlatformBackupJobManager : IPlatformBackupJobManager
    {
        private readonly ConcurrentDictionary<Guid, PlatformBackupJobStatusDto> _jobs = new();

        public PlatformBackupJobStatusDto CreateJob(string mode)
        {
            var jobId = Guid.NewGuid();
            var job = new PlatformBackupJobStatusDto
            {
                JobId = jobId,
                Mode = mode,
                Status = "Queued",
                ProgressPercentage = 0,
                CurrentStepMessage = "Backup request queued...",
                StartedAt = DateTime.UtcNow
            };

            _jobs[jobId] = job;
            return job;
        }

        public void UpdateJob(Guid jobId, int progressPercentage, string stepMessage, string? status = null)
        {
            if (_jobs.TryGetValue(jobId, out var job))
            {
                job.ProgressPercentage = Math.Clamp(progressPercentage, 0, 100);
                job.CurrentStepMessage = stepMessage;
                if (!string.IsNullOrEmpty(status))
                {
                    job.Status = status;
                }
            }
        }

        public void CompleteJob(Guid jobId, Guid backupId)
        {
            if (_jobs.TryGetValue(jobId, out var job))
            {
                job.Status = "Completed";
                job.ProgressPercentage = 100;
                job.CurrentStepMessage = "Backup completed successfully.";
                job.BackupId = backupId;
                job.CompletedAt = DateTime.UtcNow;
            }
        }

        public void FailJob(Guid jobId, string errorMessage)
        {
            if (_jobs.TryGetValue(jobId, out var job))
            {
                job.Status = "Failed";
                job.ErrorMessage = errorMessage;
                job.CurrentStepMessage = $"Failed: {errorMessage}";
                job.CompletedAt = DateTime.UtcNow;
            }
        }

        public PlatformBackupJobStatusDto? GetJobStatus(Guid jobId)
        {
            return _jobs.TryGetValue(jobId, out var job) ? job : null;
        }

        public List<PlatformBackupJobStatusDto> GetActiveJobs()
        {
            return _jobs.Values
                .Where(j => j.Status != "Completed" && j.Status != "Failed")
                .OrderByDescending(j => j.StartedAt)
                .ToList();
        }
    }
}
