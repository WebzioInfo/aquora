using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.QC;
using Aquora.Application.Interfaces.Services;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/qc/water-test")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "QC,CompanyAdmin,Admin,Owner")]
    public class WaterTestController : ControllerBase
    {
        private readonly IWaterTestService _waterTestService;

        public WaterTestController(IWaterTestService waterTestService)
        {
            _waterTestService = waterTestService;
        }

        private bool IsReadOnlyUser()
        {
            return User.IsInRole("Owner") || User.HasClaim(c => c.Type == System.Security.Claims.ClaimTypes.Role && c.Value.Equals("Owner", StringComparison.OrdinalIgnoreCase));
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            var result = await _waterTestService.GetWaterTestDashboardAsync();
            return Ok(result);
        }

        [HttpGet("reports")]
        public async Task<IActionResult> GetReports(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? type = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var result = await _waterTestService.GetWaterTestReportsAsync(pageNumber, pageSize, search, type, status, startDate, endDate);
            return Ok(result);
        }

        [HttpGet("reports/{id}")]
        public async Task<IActionResult> GetReportById(Guid id)
        {
            var report = await _waterTestService.GetWaterTestReportByIdAsync(id);
            if (report == null) return NotFound();
            return Ok(report);
        }

        [HttpPost("reports")]
        public async Task<IActionResult> CreateReport([FromBody] CreateWaterTestReportRequest request)
        {
            if (IsReadOnlyUser()) return StatusCode(403, "Owner role is read-only.");
            var result = await _waterTestService.CreateWaterTestReportAsync(request);
            return CreatedAtAction(nameof(GetReportById), new { id = result.Id }, result);
        }

        [HttpPut("reports/{id}")]
        public async Task<IActionResult> UpdateReport(Guid id, [FromBody] CreateWaterTestReportRequest request)
        {
            if (IsReadOnlyUser()) return StatusCode(403, "Owner role is read-only.");
            var result = await _waterTestService.UpdateWaterTestReportAsync(id, request);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpDelete("reports/{id}")]
        public async Task<IActionResult> DeleteReport(Guid id)
        {
            if (IsReadOnlyUser()) return StatusCode(403, "Owner role is read-only.");
            var success = await _waterTestService.DeleteWaterTestReportAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpGet("parameters")]
        public async Task<IActionResult> GetParameters()
        {
            var parameters = await _waterTestService.GetWaterTestParametersAsync();
            return Ok(parameters);
        }

        [HttpPost("parameters")]
        public async Task<IActionResult> CreateOrUpdateParameter([FromBody] WaterTestParameterDto request)
        {
            if (IsReadOnlyUser()) return StatusCode(403, "Owner role is read-only.");
            var param = await _waterTestService.CreateOrUpdateParameterAsync(request);
            return Ok(param);
        }

        // Compliance & CAPA/NCR Endpoints
        [HttpGet("compliance")]
        public async Task<IActionResult> GetComplianceRecords()
        {
            var records = await _waterTestService.GetComplianceRecordsAsync();
            return Ok(records);
        }

        [HttpPost("compliance/{id}/resolve")]
        public async Task<IActionResult> ResolveComplianceRecord(Guid id, [FromBody] ResolveComplianceRequest request)
        {
            if (IsReadOnlyUser()) return StatusCode(403, "Owner role is read-only.");
            var success = await _waterTestService.ResolveComplianceRecordAsync(id, request);
            if (!success) return NotFound();
            return Ok(new { success = true, message = "Compliance record resolved." });
        }

        // QC Settings & Audit Logs
        [HttpGet("settings")]
        public async Task<IActionResult> GetQCSettings()
        {
            var settings = await _waterTestService.GetQCSettingsAsync();
            return Ok(settings);
        }

        [HttpPut("settings")]
        public async Task<IActionResult> UpdateQCSettings([FromBody] QCSettingsDto settings)
        {
            if (IsReadOnlyUser()) return StatusCode(403, "Owner role is read-only.");
            var updated = await _waterTestService.UpdateQCSettingsAsync(settings);
            return Ok(updated);
        }

        [HttpGet("audit-logs")]
        public async Task<IActionResult> GetAuditLogs([FromQuery] Guid? reportId = null)
        {
            var logs = await _waterTestService.GetQCAuditLogsAsync(reportId);
            return Ok(logs);
        }

        [HttpGet("reports/{id}/pdf")]
        public async Task<IActionResult> DownloadReportPdf(Guid id)
        {
            var pdfBytes = await _waterTestService.GenerateReportPdfAsync(id);
            return File(pdfBytes, "application/pdf", $"QC_Certificate_{id.ToString()[..8].ToUpper()}.pdf");
        }
    }
}
