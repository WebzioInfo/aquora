using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.QC;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IWaterTestService
    {
        Task<PagedResult<WaterTestReportDto>> GetWaterTestReportsAsync(
            int pageNumber,
            int pageSize,
            string? search,
            string? type,
            string? status,
            DateTime? startDate,
            DateTime? endDate);

        Task<WaterTestReportDto?> GetWaterTestReportByIdAsync(Guid id);
        Task<List<WaterTestParameterDto>> GetWaterTestParametersAsync();
        Task<WaterTestParameterDto> CreateOrUpdateParameterAsync(WaterTestParameterDto request);
        Task<WaterTestReportDto> CreateWaterTestReportAsync(CreateWaterTestReportRequest request);
        Task<WaterTestReportDto?> UpdateWaterTestReportAsync(Guid id, CreateWaterTestReportRequest request);
        Task<WaterTestReportDto?> EnterSingleParameterResultAsync(Guid reportId, Guid parameterId, EnterSingleResultRequest request);
        Task<List<QCPendingTaskDto>> GetPendingTasksAndRemindersAsync();
        Task<bool> DeleteWaterTestReportAsync(Guid id);
        Task<WaterTestDashboardDto> GetWaterTestDashboardAsync();

        // Compliance & CAPA/NCR
        Task<List<ComplianceRecordDto>> GetComplianceRecordsAsync();
        Task<bool> ResolveComplianceRecordAsync(Guid recordId, ResolveComplianceRequest request);

        // QC Settings & Audit Trail
        Task<QCSettingsDto> GetQCSettingsAsync();
        Task<QCSettingsDto> UpdateQCSettingsAsync(QCSettingsDto settings);
        Task<List<QCAuditLogDto>> GetQCAuditLogsAsync(Guid? reportId = null);
        Task<byte[]> GenerateReportPdfAsync(Guid reportId);
    }
}
