using System;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs;
using Aquora.Application.DTOs.Purchase;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;
namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/assets")]
    [Authorize]
    public class AssetsController : ControllerBase
    {
        private static bool IsDatabaseConflict(Exception ex) =>
            ex is Npgsql.PostgresException pg && (pg.SqlState == "40001" || pg.SqlState == "40P01") ||
            ex.InnerException != null && IsDatabaseConflict(ex.InnerException);
        private readonly IAssetManagementService _assetService;
        private readonly ILogger<AssetsController> _logger;
        public AssetsController(IAssetManagementService assetService, ILogger<AssetsController> logger)
        {
            _assetService = assetService;
            _logger = logger;
        }
        [HttpGet("employees/search")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> SearchEmployees([FromQuery] string? search)
        {
            try { return Ok(ApiResponse<List<AssetEmployeeDto>>.CreateSuccess(await _assetService.SearchEmployeesAsync(search))); }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Employee search failed");
                return StatusCode(500, ApiResponse<object>.CreateFailure("Unable to load employees."));
            }
        }
        [HttpGet("{id:guid}/history-exists")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Admin,Owner")]
        public async Task<IActionResult> CheckAssetHistory(Guid id)
        {
            try
            {
                var result = await _assetService.CheckAssetHistoryExistsAsync(id);
                return Ok(ApiResponse<AssetHistoryExistsDto>.CreateSuccess(result, "Asset history status evaluated successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate asset history for {Id}", id);
                return StatusCode(500, ApiResponse<object>.CreateFailure("Unable to check asset history. Please try again."));
            }
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Admin,Owner")]
        public async Task<IActionResult> DeleteAsset(Guid id, [FromQuery] string expectedVersion)
        {
            try
            {
                var removed = await _assetService.DeleteAssetAsync(id, new AssetMutationRequest { ExpectedVersion = expectedVersion });
                return removed ? Ok(ApiResponse<bool>.CreateSuccess(true, "Asset permanently removed.")) : NotFound(ApiResponse<object>.CreateFailure("Asset record not found."));
            }
            catch (ArgumentException ex)
            {
                var failure = ApiResponse<object>.CreateFailure(ex.Message, ex.Message);
                failure.Code = "AssetHistoryExists";
                return Conflict(failure);
            }
            catch (DbUpdateConcurrencyException)
            {
                var failure = ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "This asset was modified by another user. Refresh and try again.");
                failure.Code = "ConcurrencyConflict";
                return Conflict(failure);
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                var failure = ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "This asset was modified by another user. Refresh and try again.");
                failure.Code = "ConcurrencyConflict";
                return Conflict(failure);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Asset deletion failed for {Id}", id);
                return StatusCode(500, ApiResponse<object>.CreateFailure("Unable to remove asset. Please try again."));
            }
        }
        [HttpGet]
        public async Task<IActionResult> GetAssets(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null,
            [FromQuery] string? category = null,
            [FromQuery] string? status = null,
            [FromQuery] string? condition = null,
            [FromQuery] string? location = null,
            [FromQuery] string? department = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var result = await _assetService.GetAssetsAsync(pageNumber, pageSize, search, category, status, condition, location, department, fromDate, toDate);
                return Ok(ApiResponse<AssetPagedResultDto>.CreateSuccess(result, "Asset list retrieved successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching assets list");
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to retrieve asset list right now. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpGet("kpis")]
        public async Task<IActionResult> GetAssetKpis(
            [FromQuery] string? search = null,
            [FromQuery] string? category = null,
            [FromQuery] string? status = null,
            [FromQuery] string? condition = null,
            [FromQuery] string? location = null,
            [FromQuery] string? department = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var kpis = await _assetService.GetAssetKpisAsync(search, category, status, condition, location, department, fromDate, toDate);
                return Ok(ApiResponse<AssetKpiSummaryDto>.CreateSuccess(kpis, "Asset KPIs retrieved successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching asset KPIs");
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to retrieve asset KPIs right now.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetAssetById(Guid id)
        {
            try
            {
                var asset = await _assetService.GetAssetByIdAsync(id);
                if (asset == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Asset details retrieved successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching asset details for {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load asset details.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> CreateAsset([FromBody] CreateAssetRequest request)
        {
            try
            {
                var asset = await _assetService.CreateAssetAsync(request);
                return CreatedAtAction(nameof(GetAssetById), new { id = asset.Id }, ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Asset created successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (InvalidOperationException ex) when (!IsDatabaseConflict(ex))
            {
                _logger.LogWarning(ex, "Validation Error in CreateAsset: {Message}", ex.Message);
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CREATE ASSET EXCEPTION] TraceId: {TraceId}", HttpContext.TraceIdentifier);
                Console.WriteLine($"[CREATE ASSET EXCEPTION] TraceId: {HttpContext.TraceIdentifier}\nMessage: {ex.Message}\nStack: {ex.StackTrace}\nInner: {ex.InnerException?.Message}");
                return BadRequest(ApiResponse<object>.CreateFailure("We couldn't save the asset right now. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPut("{id:guid}")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> UpdateAsset(Guid id, [FromBody] UpdateAssetRequest request)
        {
            try
            {
                var asset = await _assetService.UpdateAssetAsync(id, request);
                if (asset == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Asset updated successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("We couldn't update the asset right now. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("{id:guid}/assign")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> AssignAsset(Guid id, [FromBody] AssignAssetRequest request)
        {
            try
            {
                var asset = await _assetService.AssignAssetAsync(id, request);
                if (asset == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Asset assignment recorded successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("We couldn't record the asset assignment. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("{id:guid}/transfer")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> TransferAsset(Guid id, [FromBody] TransferAssetRequest request)
        {
            try
            {
                var asset = await _assetService.TransferAssetAsync(id, request);
                if (asset == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Asset transfer recorded successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error transferring asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("We couldn't record the asset transfer. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("{id:guid}/maintenance")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> RecordMaintenance(Guid id, [FromBody] RecordMaintenanceRequest request)
        {
            try
            {
                var record = await _assetService.RecordMaintenanceAsync(id, request);
                if (record == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<AssetMaintenanceRecordDto>.CreateSuccess(record, "Maintenance record logged successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording maintenance for asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("We couldn't log the maintenance record. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpGet("{id:guid}/maintenance")]
        public async Task<IActionResult> GetMaintenanceRecords(Guid id)
        {
            try
            {
                var records = await _assetService.GetMaintenanceRecordsAsync(id);
                return Ok(ApiResponse<List<AssetMaintenanceRecordDto>>.CreateSuccess(records, "Maintenance history retrieved successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting maintenance records for asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load maintenance records.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("{id:guid}/depreciation")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> CalculateDepreciation(Guid id, [FromBody] DepreciateAssetRequest request)
        {
            try
            {
                var asset = await _assetService.CalculateDepreciationAsync(id, request);
                if (asset == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found or already disposed.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Depreciation calculated successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating depreciation for asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to calculate depreciation right now.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("{id:guid}/dispose")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> DisposeAsset(Guid id, [FromBody] DisposeAssetRequest request)
        {
            try
            {
                var asset = await _assetService.DisposeAssetAsync(id, request);
                if (asset == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<DetailedAssetDto>.CreateSuccess(asset, "Asset disposed successfully."));
            }
            catch (InvalidOperationException ex) when (!IsDatabaseConflict(ex))
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Disposal Error", HttpContext.TraceIdentifier));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disposing asset {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("We couldn't process asset disposal right now. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpGet("{id:guid}/history")]
        public async Task<IActionResult> GetAssetHistory(Guid id)
        {
            try
            {
                var history = await _assetService.GetAssetHistoryAsync(id);
                return Ok(ApiResponse<List<AssetHistoryDto>>.CreateSuccess(history, "Asset timeline history retrieved successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting asset history for {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load asset history timeline.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("bulk-status")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkAssetStatusRequest request)
        {
            try
            {
                var result = await _assetService.BulkUpdateStatusAsync(request);
                return Ok(ApiResponse<bool>.CreateSuccess(result, "Bulk asset status update completed."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error performing bulk status update");
                return BadRequest(ApiResponse<object>.CreateFailure("Bulk status update failed.", "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpPost("import")]
        [Authorize(Roles = "SuperAdmin,CompanyOwner,CompanyAdmin,Accountant,Admin,Owner")]
        public async Task<IActionResult> ImportAssets([FromBody] List<AssetImportRow> rows)
        {
            try
            {
                var result = await _assetService.ImportAssetsAsync(rows);
                return Ok(ApiResponse<AssetImportResult>.CreateSuccess(result, $"Asset import completed: {result.ImportedCount} of {result.TotalRows} rows imported."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error"));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex) when (IsDatabaseConflict(ex))
            {
                return Conflict(ApiResponse<object>.CreateFailure("This asset was modified by another user. Refresh and try again.", "ConcurrencyConflict"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing assets");
                return BadRequest(ApiResponse<object>.CreateFailure("Import failed due to an unexpected error.", "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
