using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Operations;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IOperationsIssueService
    {
        Task<PagedResult<OperationsIssueDto>> GetIssuesAsync(
            int pageNumber,
            int pageSize,
            string? search,
            string? department,
            string? category,
            string? priority,
            string? status,
            Guid? machineId,
            DateTime? startDate,
            DateTime? endDate);

        Task<OperationsIssueDetailDto?> GetIssueByIdAsync(Guid id);
        Task<OperationsIssueDto> CreateIssueAsync(CreateOperationsIssueRequest request);
        Task<OperationsIssueDto> QuickOperatorReportAsync(QuickOperatorReportRequest request);
        Task<OperationsIssueDto> ReportOperatorBatchIssueAsync(OperatorBatchReportIssueRequest request);
        Task<List<OperationsIssueDto>> GetIssuesForBatchAsync(string batchNumber);
        Task<OperationsIssueDto?> UpdateIssueAsync(Guid id, UpdateOperationsIssueRequest request);
        Task<OperationsIssueDto?> ChangeStatusAsync(Guid id, ChangeIssueStatusRequest request);
        Task<OperationsIssueDto?> AssignIssueAsync(Guid id, AssignIssueRequest request);
        Task<OperationsIssueCommentDto?> AddCommentAsync(Guid id, AddIssueCommentRequest request);
        Task<OperationsIssueDto?> ResolveIssueAsync(Guid id, ResolveIssueRequest request);
        Task<OperationsIssueDto?> VerifyAndCloseIssueAsync(Guid id, string? verificationNote);
        Task<OperationsIssueDto?> CreateMaintenanceWorkOrderAsync(Guid id);
        Task<bool> DeleteIssueAsync(Guid id);
        Task<OperationsIssueDashboardDto> GetDashboardAsync();
        Task<List<AffectedMachineItemDto>> GetAvailableMachinesAsync();

        // Real-time Notification & Read Status Tracking
        Task<int> GetUnreadCountAsync();
        Task<List<OperationsIssueNotificationDto>> GetLatestNotificationsAsync(int take = 5);
        Task<bool> MarkIssueAsReadAsync(Guid id, string userId, string userName);
        Task<int> MarkAllIssuesAsReadAsync(string userId, string userName);
    }
}
