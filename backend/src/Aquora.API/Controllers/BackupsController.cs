using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/backups")]
    [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,QC,Owner")]
    public class BackupsController : ControllerBase
    {
        private readonly IBackupService _backupService;

        public BackupsController(IBackupService backupService)
        {
            _backupService = backupService;
        }

        private bool IsReadOnlyUser()
        {
            return User.IsInRole("Owner") || User.HasClaim(c => c.Type == System.Security.Claims.ClaimTypes.Role && c.Value.Equals("Owner", StringComparison.OrdinalIgnoreCase));
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            try
            {
                var result = await _backupService.GetBackupDashboardAsync();
                return Ok(ApiResponse<BackupDashboardDto>.CreateSuccess(result, "Backup dashboard retrieved successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetBackups()
        {
            try
            {
                var backups = await _backupService.GetBackupHistoryAsync();
                return Ok(ApiResponse<object>.CreateSuccess(backups, "Backup history retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetBackupById(Guid id)
        {
            try
            {
                var backup = await _backupService.GetBackupByIdAsync(id);
                if (backup == null) return NotFound(ApiResponse<object>.CreateFailure("Backup record not found."));
                return Ok(ApiResponse<BackupHistoryDto>.CreateSuccess(backup, "Backup details retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateBackup([FromBody] CreateBackupRequest request)
        {
            if (IsReadOnlyUser()) return StatusCode(403, ApiResponse<object>.CreateFailure("Owner role is read-only.", "Forbidden"));
            try
            {
                var result = await _backupService.CreateBackupAsync(request);
                return Ok(ApiResponse<BackupHistoryDto>.CreateSuccess(result, "Backup created successfully."));
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

        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadBackup(Guid id)
        {
            try
            {
                var (fileBytes, contentType, fileName) = await _backupService.DownloadBackupAsync(id);
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBackup(Guid id)
        {
            if (IsReadOnlyUser()) return StatusCode(403, ApiResponse<object>.CreateFailure("Owner role is read-only.", "Forbidden"));
            try
            {
                var success = await _backupService.DeleteBackupAsync(id);
                if (!success) return NotFound(ApiResponse<object>.CreateFailure("Backup not found or already deleted."));
                return Ok(ApiResponse<object>.CreateSuccess(new { id }, "Backup deleted successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreBackup(Guid id, [FromBody] RestoreBackupRequest request)
        {
            if (IsReadOnlyUser()) return StatusCode(403, ApiResponse<object>.CreateFailure("Owner role is read-only.", "Forbidden"));
            try
            {
                var result = await _backupService.RestoreBackupAsync(id, request);
                return Ok(ApiResponse<RestoreHistoryDto>.CreateSuccess(result, "System restored successfully from backup snapshot."));
            }
            catch (InvalidOperationException ex)
            {
                Console.WriteLine("================================================");
                Console.WriteLine("[BACKUPS CONTROLLER INVALID OPERATION EXCEPTION]");
                Console.WriteLine(ex.ToString());
                var inner = ex.InnerException;
                while (inner != null)
                {
                    Console.WriteLine("------------------------------------------------");
                    Console.WriteLine("[INNER EXCEPTION]: " + inner.ToString());
                    inner = inner.InnerException;
                }
                Console.WriteLine("================================================");
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message));
            }
            catch (KeyNotFoundException ex)
            {
                Console.WriteLine("================================================");
                Console.WriteLine("[BACKUPS CONTROLLER KEY NOT FOUND EXCEPTION]");
                Console.WriteLine(ex.ToString());
                Console.WriteLine("================================================");
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message));
            }
            catch (Exception ex)
            {
                Console.WriteLine("================================================");
                Console.WriteLine("[BACKUPS CONTROLLER UNHANDLED EXCEPTION]");
                Console.WriteLine(ex.ToString());
                var inner = ex.InnerException;
                while (inner != null)
                {
                    Console.WriteLine("------------------------------------------------");
                    Console.WriteLine("[INNER EXCEPTION]: " + inner.ToString());
                    inner = inner.InnerException;
                }
                Console.WriteLine("================================================");
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadBackup([FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0) return BadRequest(ApiResponse<object>.CreateFailure("No file uploaded."));
                using var stream = file.OpenReadStream();
                var result = await _backupService.UploadAndCreateBackupAsync(stream, file.FileName);
                return Ok(ApiResponse<BackupHistoryDto>.CreateSuccess(result, "Backup uploaded successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("storage")]
        public async Task<IActionResult> GetStorageStats()
        {
            try
            {
                var stats = await _backupService.GetStorageStatsAsync();
                return Ok(ApiResponse<BackupStorageStatsDto>.CreateSuccess(stats, "Backup storage statistics retrieved."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("{id}/inspect")]
        public async Task<IActionResult> InspectBackup(Guid id)
        {
            try
            {
                var result = await _backupService.InspectBackupAsync(id);
                return Ok(ApiResponse<BackupInspectionDto>.CreateSuccess(result, "Backup inspection details retrieved."));
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

        [HttpGet("{id}/inspect/{table}")]
        public async Task<IActionResult> InspectBackupTable(Guid id, string table)
        {
            try
            {
                var result = await _backupService.GetBackupTablePreviewAsync(id, table);
                return Ok(ApiResponse<TableDataPreviewDto>.CreateSuccess(result, "Table preview data retrieved."));
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

        [HttpPost("{id}/verify")]
        public async Task<IActionResult> VerifyBackup(Guid id)
        {
            try
            {
                var result = await _backupService.VerifyBackupIntegrityAsync(id);
                return Ok(ApiResponse<BackupVerificationDto>.CreateSuccess(result, "Backup verification completed."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message));
            }
        }

        [HttpGet("{id}/restore-preview")]
        public async Task<IActionResult> RestorePreview(Guid id)
        {
            try
            {
                var result = await _backupService.PreviewRestoreAsync(id);
                return Ok(ApiResponse<RestorePreviewDto>.CreateSuccess(result, "Restore preview retrieved."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message));
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
    }
}
