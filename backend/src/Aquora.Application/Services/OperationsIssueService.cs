using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Operations;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.Operations;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class OperationsIssueService : IOperationsIssueService
    {
        private readonly ITenantDbContext _context;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;

        public OperationsIssueService(
            ITenantDbContext context,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext)
        {
            _context = context;
            _tenantProvider = tenantProvider;
            _currentUserContext = currentUserContext;
        }

        private Guid GetTenantId() => _tenantProvider.TenantId;

        private async Task<Guid> GetCompanyIdAsync()
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            return company?.Id ?? Guid.Empty;
        }

        private async Task<string> GenerateIssueNumberAsync()
        {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"ISS-{today}-";
            var count = await _context.OperationsIssues
                .CountAsync(i => i.IssueNumber.StartsWith(prefix));
            return $"{prefix}{(count + 1):D4}";
        }

        public async Task<PagedResult<OperationsIssueDto>> GetIssuesAsync(
            int pageNumber,
            int pageSize,
            string? search,
            string? department,
            string? category,
            string? priority,
            string? status,
            Guid? machineId,
            DateTime? startDate,
            DateTime? endDate)
        {
            var tenantId = GetTenantId();
            var query = _context.OperationsIssues
                .Where(i => i.TenantId == tenantId && !i.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(i =>
                    i.IssueNumber.ToLower().Contains(s) ||
                    i.Title.ToLower().Contains(s) ||
                    i.Description.ToLower().Contains(s) ||
                    i.ReportedByName.ToLower().Contains(s) ||
                    (i.MachineName != null && i.MachineName.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(department))
                query = query.Where(i => i.Department == department);

            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(i => i.Category == category);

            if (!string.IsNullOrWhiteSpace(priority))
                query = query.Where(i => i.Priority == priority);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(i => i.Status == status);

            if (machineId.HasValue)
                query = query.Where(i => i.MachineId == machineId.Value);

            if (startDate.HasValue)
                query = query.Where(i => i.ReportedAt >= startDate.Value.ToUniversalTime());

            if (endDate.HasValue)
                query = query.Where(i => i.ReportedAt <= endDate.Value.ToUniversalTime());

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(i => i.ReportedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(i => new OperationsIssueDto
                {
                    Id = i.Id,
                    IssueNumber = i.IssueNumber,
                    Title = i.Title,
                    Description = i.Description,
                    Department = i.Department,
                    Category = i.Category,
                    Priority = i.Priority,
                    Status = i.Status,
                    ReportedByUserId = i.ReportedByUserId,
                    ReportedByName = i.ReportedByName,
                    AssignedToUserId = i.AssignedToUserId,
                    AssignedToName = i.AssignedToName,
                    MachineId = i.MachineId,
                    MachineName = i.MachineName,
                    ProductionLineId = i.ProductionLineId,
                    ProductionLineName = i.ProductionLineName,
                    BatchNumber = i.BatchNumber,
                    ShiftId = i.ShiftId,
                    ReportedAt = i.ReportedAt,
                    DueDate = i.DueDate,
                    ResolvedAt = i.ResolvedAt,
                    ClosedAt = i.ClosedAt,
                    VerifiedAt = i.VerifiedAt,
                    EstimatedCost = i.EstimatedCost,
                    ActualCost = i.ActualCost,
                    DowntimeMinutes = i.DowntimeMinutes,
                    RequiresMaintenance = i.RequiresMaintenance,
                    MaintenanceWorkOrderId = i.MaintenanceWorkOrderId,
                    RootCause = i.RootCause,
                    CorrectiveAction = i.CorrectiveAction,
                    PreventiveAction = i.PreventiveAction,
                    Attachments = i.Attachments,
                    IsRead = i.IsRead,
                    ReadAt = i.ReadAt,
                    ReadBy = i.ReadBy,
                    CommentsCount = i.Comments.Count,
                    CreatedAt = i.CreatedAt
                })
                .ToListAsync();

            return new PagedResult<OperationsIssueDto>(items, totalCount, pageNumber, pageSize);
        }

        public async Task<OperationsIssueDetailDto?> GetIssueByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .Include(i => i.Comments)
                .Include(i => i.HistoryLogs)
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            return new OperationsIssueDetailDto
            {
                Id = issue.Id,
                IssueNumber = issue.IssueNumber,
                Title = issue.Title,
                Description = issue.Description,
                Department = issue.Department,
                Category = issue.Category,
                Priority = issue.Priority,
                Status = issue.Status,
                ReportedByUserId = issue.ReportedByUserId,
                ReportedByName = issue.ReportedByName,
                AssignedToUserId = issue.AssignedToUserId,
                AssignedToName = issue.AssignedToName,
                MachineId = issue.MachineId,
                MachineName = issue.MachineName,
                ProductionLineId = issue.ProductionLineId,
                ProductionLineName = issue.ProductionLineName,
                BatchNumber = issue.BatchNumber,
                ShiftId = issue.ShiftId,
                ReportedAt = issue.ReportedAt,
                DueDate = issue.DueDate,
                ResolvedAt = issue.ResolvedAt,
                ClosedAt = issue.ClosedAt,
                VerifiedAt = issue.VerifiedAt,
                EstimatedCost = issue.EstimatedCost,
                ActualCost = issue.ActualCost,
                DowntimeMinutes = issue.DowntimeMinutes,
                RequiresMaintenance = issue.RequiresMaintenance,
                MaintenanceWorkOrderId = issue.MaintenanceWorkOrderId,
                RootCause = issue.RootCause,
                CorrectiveAction = issue.CorrectiveAction,
                PreventiveAction = issue.PreventiveAction,
                Attachments = issue.Attachments,
                IsRead = issue.IsRead,
                ReadAt = issue.ReadAt,
                ReadBy = issue.ReadBy,
                CommentsCount = issue.Comments.Count,
                CreatedAt = issue.CreatedAt,
                Comments = issue.Comments.OrderBy(c => c.CreatedAt).Select(c => new OperationsIssueCommentDto
                {
                    Id = c.Id,
                    IssueId = c.IssueId,
                    AuthorId = c.AuthorId,
                    AuthorName = c.AuthorName,
                    AuthorRole = c.AuthorRole,
                    Message = c.Message,
                    AttachmentUrl = c.AttachmentUrl,
                    CreatedAt = c.CreatedAt
                }).ToList(),
                HistoryLogs = issue.HistoryLogs.OrderByDescending(h => h.Timestamp).Select(h => new OperationsIssueHistoryDto
                {
                    Id = h.Id,
                    IssueId = h.IssueId,
                    PerformedBy = h.PerformedBy,
                    Action = h.Action,
                    Details = h.Details,
                    Timestamp = h.Timestamp
                }).ToList()
            };
        }

        public async Task<OperationsIssueDto> CreateIssueAsync(CreateOperationsIssueRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";
            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "Operator User";

            var issueNumber = await GenerateIssueNumberAsync();

            var issue = new OperationsIssue
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                IssueNumber = issueNumber,
                Title = string.IsNullOrWhiteSpace(request.Title) ? $"{request.Category} reported in {request.Department}" : request.Title.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                Department = request.Department ?? "Production",
                Category = request.Category ?? "Machine Breakdown",
                Priority = request.Priority ?? "Medium",
                Status = "Open",
                ReportedByUserId = userId,
                ReportedByName = userName,
                MachineId = request.MachineId,
                MachineName = request.MachineName,
                ProductionLineId = request.ProductionLineId,
                ProductionLineName = request.ProductionLineName,
                BatchId = request.BatchId,
                BatchNumber = request.BatchNumber,
                ProductId = request.ProductId,
                ProductName = request.ProductName,
                StationId = request.StationId,
                StationName = request.StationName,
                ProductionSessionId = request.ProductionSessionId,
                ShiftId = request.ShiftId,
                RequiresImmediateStop = request.RequiresImmediateStop,
                ReportedAt = DateTime.UtcNow,
                DueDate = request.DueDate?.ToUniversalTime(),
                EstimatedCost = request.EstimatedCost,
                DowntimeMinutes = request.DowntimeMinutes,
                RequiresMaintenance = request.RequiresMaintenance,
                Attachments = request.Attachments,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId
            };

            issue.HistoryLogs.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "CREATED",
                Details = $"Reported issue #{issue.IssueNumber} in {issue.Department} ({issue.Category}) with {issue.Priority} priority." + (string.IsNullOrWhiteSpace(issue.BatchNumber) ? "" : $" Linked Batch #{issue.BatchNumber}."),
                Timestamp = DateTime.UtcNow
            });

            _context.OperationsIssues.Add(issue);
            await _context.SaveChangesAsync();

            return (await GetIssueByIdAsync(issue.Id))!;
        }

        public async Task<OperationsIssueDto> ReportOperatorBatchIssueAsync(OperatorBatchReportIssueRequest request)
        {
            var createReq = new CreateOperationsIssueRequest
            {
                Title = string.IsNullOrWhiteSpace(request.Title) ? $"[ACTIVE BATCH ISSUE] {request.Category} - Batch {request.BatchNumber}" : request.Title,
                Description = request.Description,
                Department = "Production",
                Category = request.Category,
                Priority = request.Priority,
                MachineId = request.MachineId,
                MachineName = request.MachineName,
                ProductionLineId = request.ProductionLineId,
                ProductionLineName = request.ProductionLineName,
                BatchId = request.BatchId,
                BatchNumber = request.BatchNumber,
                ProductId = request.ProductId,
                ProductName = request.ProductName,
                StationId = request.StationId,
                StationName = request.StationName,
                ProductionSessionId = request.ProductionSessionId,
                ShiftId = request.ShiftId,
                RequiresImmediateStop = request.RequiresImmediateStop,
                RequiresMaintenance = true,
                Attachments = request.Attachments
            };

            return await CreateIssueAsync(createReq);
        }

        public async Task<List<OperationsIssueDto>> GetIssuesForBatchAsync(string batchNumber)
        {
            if (string.IsNullOrWhiteSpace(batchNumber)) return new List<OperationsIssueDto>();

            var tenantId = GetTenantId();
            var bNo = batchNumber.Trim().ToLower();

            return await _context.OperationsIssues
                .Where(i => i.TenantId == tenantId && !i.IsDeleted && i.BatchNumber != null && i.BatchNumber.ToLower() == bNo)
                .OrderByDescending(i => i.ReportedAt)
                .Select(i => new OperationsIssueDto
                {
                    Id = i.Id,
                    IssueNumber = i.IssueNumber,
                    Title = i.Title,
                    Description = i.Description,
                    Department = i.Department,
                    Category = i.Category,
                    Priority = i.Priority,
                    Status = i.Status,
                    ReportedByUserId = i.ReportedByUserId,
                    ReportedByName = i.ReportedByName,
                    AssignedToUserId = i.AssignedToUserId,
                    AssignedToName = i.AssignedToName,
                    MachineId = i.MachineId,
                    MachineName = i.MachineName,
                    ProductionLineId = i.ProductionLineId,
                    ProductionLineName = i.ProductionLineName,
                    BatchId = i.BatchId,
                    BatchNumber = i.BatchNumber,
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    StationId = i.StationId,
                    StationName = i.StationName,
                    ProductionSessionId = i.ProductionSessionId,
                    ShiftId = i.ShiftId,
                    RequiresImmediateStop = i.RequiresImmediateStop,
                    ReportedAt = i.ReportedAt,
                    DueDate = i.DueDate,
                    ResolvedAt = i.ResolvedAt,
                    ClosedAt = i.ClosedAt,
                    VerifiedAt = i.VerifiedAt,
                    EstimatedCost = i.EstimatedCost,
                    ActualCost = i.ActualCost,
                    DowntimeMinutes = i.DowntimeMinutes,
                    RequiresMaintenance = i.RequiresMaintenance,
                    MaintenanceWorkOrderId = i.MaintenanceWorkOrderId,
                    RootCause = i.RootCause,
                    CorrectiveAction = i.CorrectiveAction,
                    PreventiveAction = i.PreventiveAction,
                    Attachments = i.Attachments,
                    CommentsCount = i.Comments.Count,
                    CreatedAt = i.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<OperationsIssueDto> QuickOperatorReportAsync(QuickOperatorReportRequest request)
        {
            var createReq = new CreateOperationsIssueRequest
            {
                Title = $"[OPERATOR REPORT] {request.Category} - {request.MachineName ?? request.Department}",
                Description = request.Description,
                Department = request.Department,
                Category = request.Category,
                Priority = request.Priority,
                MachineId = request.MachineId,
                MachineName = request.MachineName,
                DowntimeMinutes = request.DowntimeMinutes,
                RequiresMaintenance = true,
                Attachments = request.Attachments
            };

            return await CreateIssueAsync(createReq);
        }

        public async Task<OperationsIssueDto?> UpdateIssueAsync(Guid id, UpdateOperationsIssueRequest request)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "System User";

            issue.Title = request.Title;
            issue.Description = request.Description;
            issue.Department = request.Department;
            issue.Category = request.Category;
            issue.Priority = request.Priority;
            issue.Status = request.Status;
            issue.AssignedToUserId = request.AssignedToUserId;
            issue.AssignedToName = request.AssignedToName;
            issue.MachineId = request.MachineId;
            issue.MachineName = request.MachineName;
            issue.ProductionLineId = request.ProductionLineId;
            issue.ProductionLineName = request.ProductionLineName;
            issue.BatchNumber = request.BatchNumber;
            issue.DueDate = request.DueDate?.ToUniversalTime();
            issue.EstimatedCost = request.EstimatedCost;
            issue.DowntimeMinutes = request.DowntimeMinutes;
            issue.RequiresMaintenance = request.RequiresMaintenance;
            issue.Attachments = request.Attachments;
            issue.UpdatedAt = DateTime.UtcNow;
            issue.UpdatedBy = _currentUserContext.UserId ?? "System";

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "EDITED",
                Details = "Updated issue details.",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return await GetIssueByIdAsync(id);
        }

        public async Task<OperationsIssueDto?> ChangeStatusAsync(Guid id, ChangeIssueStatusRequest request)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            var oldStatus = issue.Status;
            issue.Status = request.Status;
            issue.UpdatedAt = DateTime.UtcNow;

            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "System User";

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "STATUS_CHANGED",
                Details = $"Status changed from {oldStatus} to {request.Status}. {(string.IsNullOrWhiteSpace(request.Note) ? "" : "Note: " + request.Note)}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return await GetIssueByIdAsync(id);
        }

        public async Task<OperationsIssueDto?> AssignIssueAsync(Guid id, AssignIssueRequest request)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            issue.AssignedToUserId = request.AssignedToUserId;
            issue.AssignedToName = request.AssignedToName;
            if (issue.Status == "Open")
            {
                issue.Status = "Assigned";
            }
            issue.UpdatedAt = DateTime.UtcNow;

            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "System User";

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "ASSIGNED",
                Details = $"Assigned to {request.AssignedToName}. {(string.IsNullOrWhiteSpace(request.Note) ? "" : "Note: " + request.Note)}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return await GetIssueByIdAsync(id);
        }

        public async Task<OperationsIssueCommentDto?> AddCommentAsync(Guid id, AddIssueCommentRequest request)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            var userId = _currentUserContext.UserId ?? "System";
            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "Staff Member";

            var comment = new OperationsIssueComment
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                AuthorId = userId,
                AuthorName = userName,
                AuthorRole = "Operator/Staff",
                Message = request.Message.Trim(),
                AttachmentUrl = request.AttachmentUrl,
                CreatedAt = DateTime.UtcNow
            };

            _context.OperationsIssueComments.Add(comment);

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "COMMENTED",
                Details = $"Added comment: \"{(request.Message.Length > 50 ? request.Message.Substring(0, 47) + "..." : request.Message)}\"",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return new OperationsIssueCommentDto
            {
                Id = comment.Id,
                IssueId = comment.IssueId,
                AuthorId = comment.AuthorId,
                AuthorName = comment.AuthorName,
                AuthorRole = comment.AuthorRole,
                Message = comment.Message,
                AttachmentUrl = comment.AttachmentUrl,
                CreatedAt = comment.CreatedAt
            };
        }

        public async Task<OperationsIssueDto?> ResolveIssueAsync(Guid id, ResolveIssueRequest request)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            issue.Status = "Resolved";
            issue.ResolvedAt = DateTime.UtcNow;
            issue.RootCause = request.RootCause;
            issue.CorrectiveAction = request.CorrectiveAction;
            issue.PreventiveAction = request.PreventiveAction;
            if (request.ActualCost.HasValue) issue.ActualCost = request.ActualCost;
            if (request.DowntimeMinutes.HasValue) issue.DowntimeMinutes = request.DowntimeMinutes;
            issue.UpdatedAt = DateTime.UtcNow;

            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "Maintenance Staff";

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "RESOLVED",
                Details = $"Issue resolved. Root cause: {request.RootCause}. Corrective action: {request.CorrectiveAction}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return await GetIssueByIdAsync(id);
        }

        public async Task<OperationsIssueDto?> VerifyAndCloseIssueAsync(Guid id, string? verificationNote)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            issue.Status = "Closed";
            issue.VerifiedAt = DateTime.UtcNow;
            issue.ClosedAt = DateTime.UtcNow;
            issue.UpdatedAt = DateTime.UtcNow;

            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "Supervisor/Admin";

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "VERIFIED_AND_CLOSED",
                Details = $"Verified resolution and closed issue. {(string.IsNullOrWhiteSpace(verificationNote) ? "" : "Note: " + verificationNote)}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return await GetIssueByIdAsync(id);
        }

        public async Task<OperationsIssueDto?> CreateMaintenanceWorkOrderAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return null;

            var workOrderId = Guid.NewGuid();
            issue.RequiresMaintenance = true;
            issue.MaintenanceWorkOrderId = workOrderId;
            if (issue.Status == "Open") issue.Status = "Assigned";
            issue.UpdatedAt = DateTime.UtcNow;

            var userName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "Maintenance Manager";

            _context.OperationsIssueHistories.Add(new OperationsIssueHistory
            {
                Id = Guid.NewGuid(),
                IssueId = issue.Id,
                PerformedBy = userName,
                Action = "WORK_ORDER_CREATED",
                Details = $"Linked to Maintenance Work Order #{workOrderId.ToString().Substring(0, 8).ToUpper()}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return await GetIssueByIdAsync(id);
        }

        public async Task<bool> DeleteIssueAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return false;

            issue.IsDeleted = true;
            issue.DeletedAt = DateTime.UtcNow;
            issue.DeletedBy = _currentUserContext.UserId ?? "System";

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<OperationsIssueDashboardDto> GetDashboardAsync()
        {
            var tenantId = GetTenantId();
            var issues = await _context.OperationsIssues
                .Where(i => i.TenantId == tenantId && !i.IsDeleted)
                .ToListAsync();

            var today = DateTime.UtcNow.Date;

            var openIssues = issues.Count(i => i.Status != "Closed" && i.Status != "Resolved" && i.Status != "Rejected");
            var unreadIssues = issues.Count(i => !i.IsRead && i.Status != "Closed" && i.Status != "Rejected");
            var criticalIssues = issues.Count(i => (i.Priority == "Critical" || i.Priority == "Emergency") && i.Status != "Closed");
            var overdue = issues.Count(i => i.DueDate.HasValue && i.DueDate.Value < DateTime.UtcNow && i.Status != "Closed" && i.Status != "Resolved");
            var resolvedToday = issues.Count(i => i.ResolvedAt.HasValue && i.ResolvedAt.Value.Date == today);
            var machineBreakdowns = issues.Count(i => i.Category.Contains("Breakdown") || i.Category.Contains("Machine"));
            var productionStoppages = issues.Count(i => i.Category.Contains("Stopped") || i.Category.Contains("Breakdown"));

            var resolvedIssuesWithTime = issues.Where(i => i.ResolvedAt.HasValue).ToList();
            double avgResolutionHours = 0;
            if (resolvedIssuesWithTime.Any())
            {
                avgResolutionHours = resolvedIssuesWithTime.Average(i => (i.ResolvedAt!.Value - i.ReportedAt).TotalHours);
            }

            var totalDowntime = issues.Sum(i => i.DowntimeMinutes ?? 0);

            var deptStats = issues
                .GroupBy(i => i.Department)
                .Select(g => new DepartmentStatDto { Department = g.Key, Count = g.Count() })
                .ToList();

            var priorityStats = issues
                .GroupBy(i => i.Priority)
                .Select(g => new PriorityStatDto { Priority = g.Key, Count = g.Count() })
                .ToList();

            var statusStats = issues
                .GroupBy(i => i.Status)
                .Select(g => new StatusStatDto { Status = g.Key, Count = g.Count() })
                .ToList();

            var topMachines = issues
                .Where(i => !string.IsNullOrWhiteSpace(i.MachineName))
                .GroupBy(i => i.MachineName!)
                .Select(g => new TopProblemMachineDto
                {
                    MachineName = g.Key,
                    IssueCount = g.Count(),
                    TotalDowntimeMinutes = g.Sum(x => x.DowntimeMinutes ?? 0)
                })
                .OrderByDescending(x => x.IssueCount)
                .Take(5)
                .ToList();

            var recent = issues
                .OrderByDescending(i => i.ReportedAt)
                .Take(10)
                .Select(i => new OperationsIssueDto
                {
                    Id = i.Id,
                    IssueNumber = i.IssueNumber,
                    Title = i.Title,
                    Description = i.Description,
                    Department = i.Department,
                    Category = i.Category,
                    Priority = i.Priority,
                    Status = i.Status,
                    ReportedByUserId = i.ReportedByUserId,
                    ReportedByName = i.ReportedByName,
                    AssignedToUserId = i.AssignedToUserId,
                    AssignedToName = i.AssignedToName,
                    MachineId = i.MachineId,
                    MachineName = i.MachineName,
                    ProductionLineId = i.ProductionLineId,
                    ProductionLineName = i.ProductionLineName,
                    BatchNumber = i.BatchNumber,
                    ShiftId = i.ShiftId,
                    ReportedAt = i.ReportedAt,
                    DueDate = i.DueDate,
                    ResolvedAt = i.ResolvedAt,
                    ClosedAt = i.ClosedAt,
                    VerifiedAt = i.VerifiedAt,
                    EstimatedCost = i.EstimatedCost,
                    ActualCost = i.ActualCost,
                    DowntimeMinutes = i.DowntimeMinutes,
                    RequiresMaintenance = i.RequiresMaintenance,
                    MaintenanceWorkOrderId = i.MaintenanceWorkOrderId,
                    RootCause = i.RootCause,
                    CorrectiveAction = i.CorrectiveAction,
                    PreventiveAction = i.PreventiveAction,
                    Attachments = i.Attachments,
                    IsRead = i.IsRead,
                    ReadAt = i.ReadAt,
                    ReadBy = i.ReadBy,
                    CommentsCount = i.Comments.Count,
                    CreatedAt = i.CreatedAt
                })
                .ToList();

            return new OperationsIssueDashboardDto
            {
                TotalIssues = issues.Count,
                OpenIssues = openIssues,
                UnreadIssues = unreadIssues,
                CriticalIssues = criticalIssues,
                OverdueIssues = overdue,
                ResolvedToday = resolvedToday,
                MachineBreakdowns = machineBreakdowns,
                ProductionStoppages = productionStoppages,
                AvgResolutionTimeHours = Math.Round(avgResolutionHours, 1),
                TotalDowntimeMinutes = totalDowntime,
                DepartmentStats = deptStats,
                PriorityStats = priorityStats,
                StatusStats = statusStats,
                TopProblemMachines = topMachines,
                RecentIssues = recent
            };
        }

        public async Task<int> GetUnreadCountAsync()
        {
            var tenantId = GetTenantId();
            return await _context.OperationsIssues
                .CountAsync(i => i.TenantId == tenantId && !i.IsDeleted && !i.IsRead && i.Status != "Closed" && i.Status != "Rejected");
        }

        public async Task<List<OperationsIssueNotificationDto>> GetLatestNotificationsAsync(int take = 5)
        {
            var tenantId = GetTenantId();
            return await _context.OperationsIssues
                .Where(i => i.TenantId == tenantId && !i.IsDeleted && !i.IsRead && i.Status != "Closed" && i.Status != "Rejected")
                .OrderByDescending(i => i.ReportedAt)
                .Take(take)
                .Select(i => new OperationsIssueNotificationDto
                {
                    Id = i.Id,
                    IssueNumber = i.IssueNumber,
                    Title = i.Title,
                    Category = i.Category,
                    Priority = i.Priority,
                    Department = i.Department,
                    ProductionLineName = i.ProductionLineName,
                    MachineName = i.MachineName,
                    ReportedByName = i.ReportedByName,
                    ReportedAt = i.ReportedAt,
                    IsRead = i.IsRead
                })
                .ToListAsync();
        }

        public async Task<bool> MarkIssueAsReadAsync(Guid id, string userId, string userName)
        {
            var tenantId = GetTenantId();
            var issue = await _context.OperationsIssues
                .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId && !i.IsDeleted);

            if (issue == null) return false;

            if (!issue.IsRead)
            {
                issue.IsRead = true;
                issue.ReadAt = DateTime.UtcNow;
                issue.ReadBy = !string.IsNullOrWhiteSpace(userName) ? userName : userId;
                issue.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
            }

            return true;
        }

        public async Task<int> MarkAllIssuesAsReadAsync(string userId, string userName)
        {
            var tenantId = GetTenantId();
            var unreadIssues = await _context.OperationsIssues
                .Where(i => i.TenantId == tenantId && !i.IsDeleted && !i.IsRead)
                .ToListAsync();

            if (!unreadIssues.Any()) return 0;

            var readBy = !string.IsNullOrWhiteSpace(userName) ? userName : userId;
            var now = DateTime.UtcNow;

            foreach (var issue in unreadIssues)
            {
                issue.IsRead = true;
                issue.ReadAt = now;
                issue.ReadBy = readBy;
                issue.UpdatedAt = now;
            }

            await _context.SaveChangesAsync();
            return unreadIssues.Count;
        }
    }
}
