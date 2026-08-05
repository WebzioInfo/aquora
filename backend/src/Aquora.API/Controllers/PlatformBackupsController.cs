using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/platform/backups")]
    [Authorize(Roles = "SuperAdmin,PlatformAdmin,PlatformOwner")]
    public class PlatformBackupsController : ControllerBase
    {
        private readonly IPlatformBackupService _platformBackupService;

        public PlatformBackupsController(IPlatformBackupService platformBackupService)
        {
            _platformBackupService = platformBackupService;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreatePlatformBackup([FromBody] CreatePlatformBackupRequest request)
        {
            try
            {
                var job = await _platformBackupService.QueuePlatformBackupAsync(request);
                return Ok(ApiResponse<PlatformBackupJobStatusDto>.CreateSuccess(job, "Platform backup job queued successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("jobs/{jobId}")]
        public async Task<IActionResult> GetJobStatus(Guid jobId)
        {
            try
            {
                var status = await _platformBackupService.GetJobStatusAsync(jobId);
                if (status == null) return NotFound(ApiResponse<object>.CreateFailure("Job not found."));
                return Ok(ApiResponse<PlatformBackupJobStatusDto>.CreateSuccess(status, "Job status retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetPlatformBackupHistory()
        {
            try
            {
                var history = await _platformBackupService.GetPlatformBackupHistoryAsync();
                return Ok(ApiResponse<List<PlatformBackupHistoryDto>>.CreateSuccess(history, "Platform backup history retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("{id}/inspect")]
        public async Task<IActionResult> InspectPlatformBackup(Guid id)
        {
            try
            {
                var manifest = await _platformBackupService.InspectPlatformBackupAsync(id);
                if (manifest == null) return NotFound(ApiResponse<object>.CreateFailure("Platform backup manifest not found or unreadable."));
                return Ok(ApiResponse<PlatformBackupManifestDto>.CreateSuccess(manifest, "Platform backup manifest inspected."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("{id}/preview/{schemaName}")]
        public async Task<IActionResult> GetSchemaPreview(Guid id, string schemaName)
        {
            try
            {
                var preview = await _platformBackupService.GetPlatformSchemaPreviewAsync(id, schemaName);
                if (preview == null) return NotFound(ApiResponse<object>.CreateFailure("Schema preview not found."));
                return Ok(ApiResponse<PlatformSchemaPreviewDto>.CreateSuccess(preview, "Schema preview data retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadPlatformBackup(Guid id)
        {
            try
            {
                var (fileBytes, contentType, fileName) = await _platformBackupService.DownloadPlatformBackupAsync(id);
                return File(fileBytes, contentType, fileName);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpPost("{id}/restore-preview")]
        public async Task<IActionResult> RestorePreview(Guid id)
        {
            try
            {
                var preview = await _platformBackupService.PreviewPlatformRestoreAsync(id);
                return Ok(ApiResponse<PlatformRestorePreviewDto>.CreateSuccess(preview, "Restore preview retrieved."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestorePlatformBackup(Guid id, [FromBody] PlatformRestoreRequest request)
        {
            try
            {
                await _platformBackupService.RestorePlatformBackupAsync(id, request);
                return Ok(ApiResponse<object>.CreateSuccess(new { id }, "Platform backup restored successfully."));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlatformBackup(Guid id)
        {
            try
            {
                var success = await _platformBackupService.DeletePlatformBackupAsync(id);
                if (!success) return NotFound(ApiResponse<object>.CreateFailure("Backup not found or already deleted."));
                return Ok(ApiResponse<object>.CreateSuccess(new { id }, "Platform backup deleted successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("tenants")]
        public async Task<IActionResult> GetPlatformTenants()
        {
            try
            {
                var tenants = await _platformBackupService.GetPlatformTenantsAsync();
                return Ok(ApiResponse<List<PlatformTenantListDto>>.CreateSuccess(tenants, "Platform tenant list retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }
    }
}
