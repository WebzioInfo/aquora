using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public class PlatformTenantListQuery
    {
        public string? Search { get; set; }
        public string? StatusFilter { get; set; }
        public string? PlanFilter { get; set; }
        public string? SortBy { get; set; } = "Name";
        public string? SortOrder { get; set; } = "asc";
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }

    public class PlatformTenantDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string SchemaName { get; set; } = string.Empty;
        public string Subdomain { get; set; } = string.Empty;
        public string? CustomDomain { get; set; }
        public string Status { get; set; } = "Active";
        public bool IsActive { get; set; }

        // Company Details
        public string? OwnerName { get; set; }
        public string? OwnerEmail { get; set; }
        public string? OwnerPhone { get; set; }
        public string? Address { get; set; }
        public string? GstNumber { get; set; }
        public string? PanNumber { get; set; }
        public string? LicenseNumber { get; set; }

        // Tenant Metrics & Security
        public string SubscriptionPlan { get; set; } = "Starter";
        public string Timezone { get; set; } = "UTC";
        public string Currency { get; set; } = "USD";
        public string Language { get; set; } = "en";
        public string? LogoUrl { get; set; }
        public string Theme { get; set; } = "light";
        public double? StorageUsedMb { get; set; }
        public int? ActiveUsersCount { get; set; }
        public string? DatabaseStatus { get; set; }
        public string? SslStatus { get; set; }
        public string? ApiKey { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }

        // Schema Statistics
        public int? ProductCount { get; set; }
        public int? CustomerCount { get; set; }
        public int? SupplierCount { get; set; }
        public int? EmployeeCount { get; set; }
        public int? OrderCount { get; set; }
        public decimal? TotalRevenue { get; set; }

        // Recent Audit Logs
        public List<PlatformAuditLogDto> RecentActivity { get; set; } = new List<PlatformAuditLogDto>();
    }

    public class PlatformAuditLogDto
    {
        public Guid Id { get; set; }
        public string? UserId { get; set; }
        public string? UserEmail { get; set; }
        public string? Action { get; set; }
        public string? TableName { get; set; }
        public DateTime Timestamp { get; set; }
        public string? IpAddress { get; set; }
        public string? Device { get; set; }
        public string? Reason { get; set; }
    }

    public class CreateTenantRequest
    {
        public string CompanyName { get; set; } = string.Empty;
        public string? CompanyCode { get; set; }
        public string Subdomain { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public string? OwnerPhone { get; set; }
        public string? Address { get; set; }
        public string? GstNumber { get; set; }
        public string? PanNumber { get; set; }
        public string? LicenseNumber { get; set; }
        public string SubscriptionPlan { get; set; } = "Starter";
        public string Timezone { get; set; } = "UTC";
        public string Currency { get; set; } = "USD";
        public string Language { get; set; } = "en";
        public string? LogoUrl { get; set; }
        public string Theme { get; set; } = "light";
    }

    public class UpdateTenantRequest
    {
        public string CompanyName { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public string? OwnerPhone { get; set; }
        public string? Address { get; set; }
        public string? GstNumber { get; set; }
        public string? PanNumber { get; set; }
        public string? LicenseNumber { get; set; }
        public string SubscriptionPlan { get; set; } = "Starter";
        public string Status { get; set; } = "Active";
        public string Subdomain { get; set; } = string.Empty;
        public string Timezone { get; set; } = "UTC";
        public string Currency { get; set; } = "USD";
        public string Language { get; set; } = "en";
        public string? LogoUrl { get; set; }
        public string Theme { get; set; } = "light";
    }

    public class DeleteTenantRequest
    {
        public string Reason { get; set; } = "Platform Admin Manual Deletion";
        public string ConfirmationCode { get; set; } = string.Empty;
    }

    public class PlatformUserListQuery
    {
        public string? Search { get; set; }
        public string? StatusFilter { get; set; }
        public string? RoleFilter { get; set; }
        public Guid? TenantIdFilter { get; set; }
        public string? DepartmentFilter { get; set; }
        public string? CompanyFilter { get; set; }
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string? SortBy { get; set; } = "Email";
        public string? SortOrder { get; set; } = "asc";
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }

    public class PlatformUserDto
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? Username { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string Name => $"{FirstName} {LastName}".Trim();
        public string? Phone { get; set; }
        public string? RoleName { get; set; }
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Shift { get; set; }
        public decimal? Salary { get; set; }
        public DateTime? JoiningDate { get; set; }
        public string Status { get; set; } = "Active";
        public bool IsActive { get; set; }
        public bool IsPlatformAdmin { get; set; }
        public string? PhotoUrl { get; set; }
        public Guid? TenantId { get; set; }
        public string? TenantName { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public int DevicesCount { get; set; } = 1;

        // Details drawer collections & stats
        public List<string> Permissions { get; set; } = new List<string>();
        public string AttendanceSummary { get; set; } = "98.5% On-Time";
        public List<PlatformAuditLogDto> LoginHistory { get; set; } = new List<PlatformAuditLogDto>();
        public List<PlatformAuditLogDto> RecentActivity { get; set; } = new List<PlatformAuditLogDto>();
    }

    public class CreateUserRequest
    {
        public string? PhotoUrl { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string RoleName { get; set; } = "Standard";
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Shift { get; set; }
        public decimal? Salary { get; set; }
        public DateTime? JoiningDate { get; set; }
        public string Password { get; set; } = string.Empty;
        public string Status { get; set; } = "Active";
        public Guid? TenantId { get; set; }
    }

    public class UpdateUserRequest
    {
        public string? PhotoUrl { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string RoleName { get; set; } = "Standard";
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Shift { get; set; }
        public decimal? Salary { get; set; }
        public DateTime? JoiningDate { get; set; }
        public string? Password { get; set; }
        public string Status { get; set; } = "Active";
        public Guid? TenantId { get; set; }
    }

    public class BulkUserOperationRequest
    {
        public List<Guid> UserIds { get; set; } = new List<Guid>();
        public string Action { get; set; } = string.Empty; // delete, activate, deactivate, role_change, department_change, reset_password
        public string? TargetValue { get; set; }
    }

    public class ImportResultDto
    {
        public int TotalProcessed { get; set; }
        public int SuccessCount { get; set; }
        public int ErrorCount { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
        public List<object> PreviewItems { get; set; } = new List<object>();
    }

    public interface IPlatformManagementService
    {
        Task<PagedResult<PlatformTenantDto>> GetTenantsAsync(PlatformTenantListQuery query);
        Task<PlatformTenantDto> GetTenantByIdAsync(Guid tenantId);
        Task<Guid> CreateTenantAsync(CreateTenantRequest request, string performerUserId, string performerIp);
        Task<bool> UpdateTenantAsync(Guid tenantId, UpdateTenantRequest request, string performerUserId, string performerIp);
        Task<bool> DeleteTenantAsync(Guid tenantId, string reason, string performerUserId, string performerIp, string browserInfo);
        
        Task<PagedResult<PlatformUserDto>> GetUsersAsync(PlatformUserListQuery query);
        Task<PlatformUserDto> GetUserByIdAsync(Guid userId);
        Task<Guid> CreateUserAsync(CreateUserRequest request, string performerUserId, string performerIp);
        Task<bool> UpdateUserAsync(Guid userId, UpdateUserRequest request, string performerUserId, string performerIp);
        Task<bool> DeleteUserAsync(Guid userId, string performerUserId, string performerIp);
        Task<bool> BulkUserOperationsAsync(BulkUserOperationRequest request, string performerUserId, string performerIp);

        Task<byte[]> ExportTenantsCsvAsync(PlatformTenantListQuery query);
        Task<byte[]> ExportUsersCsvAsync(PlatformUserListQuery query);
        Task<ImportResultDto> ImportTenantsAsync(List<Dictionary<string, string>> records, bool commit, string performerUserId);
        Task<ImportResultDto> ImportUsersAsync(List<Dictionary<string, string>> records, bool commit, string performerUserId);
    }
}
