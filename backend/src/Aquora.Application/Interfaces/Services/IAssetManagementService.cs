using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs;
using Aquora.Application.DTOs.Purchase;
using Aquora.Application.Services;

namespace Aquora.Application.Interfaces.Services
{
    public interface IAssetManagementService
    {
        Task<AssetPagedResultDto> GetAssetsAsync(
            int pageNumber = 1,
            int pageSize = 50,
            string? search = null,
            string? category = null,
            string? status = null,
            string? condition = null,
            string? location = null,
            string? department = null,
            DateTime? fromDate = null,
            DateTime? toDate = null);

        Task<List<AssetEmployeeDto>> SearchEmployeesAsync(string? search);
        Task<AssetHistoryExistsDto> CheckAssetHistoryExistsAsync(Guid id);
        Task<bool> DeleteAssetAsync(Guid id, AssetMutationRequest request);
        Task<AssetKpiSummaryDto> GetAssetKpisAsync(
            string? search = null,
            string? category = null,
            string? status = null,
            string? condition = null,
            string? location = null,
            string? department = null,
            DateTime? fromDate = null,
            DateTime? toDate = null);
        Task<DetailedAssetDto?> GetAssetByIdAsync(Guid id);
        Task<DetailedAssetDto> CreateAssetAsync(CreateAssetRequest request);
        Task<DetailedAssetDto?> UpdateAssetAsync(Guid id, UpdateAssetRequest request);
        Task<DetailedAssetDto?> AssignAssetAsync(Guid id, AssignAssetRequest request);
        Task<DetailedAssetDto?> TransferAssetAsync(Guid id, TransferAssetRequest request);
        Task<AssetMaintenanceRecordDto?> RecordMaintenanceAsync(Guid id, RecordMaintenanceRequest request);
        Task<List<AssetMaintenanceRecordDto>> GetMaintenanceRecordsAsync(Guid id);
        Task<DetailedAssetDto?> CalculateDepreciationAsync(Guid id, DepreciateAssetRequest request);
        Task<DetailedAssetDto?> DisposeAssetAsync(Guid id, DisposeAssetRequest request);
        Task<List<AssetHistoryDto>> GetAssetHistoryAsync(Guid id);
        Task<bool> BulkUpdateStatusAsync(BulkAssetStatusRequest request);
        Task<AssetImportResult> ImportAssetsAsync(List<AssetImportRow> rows);
    }
}
