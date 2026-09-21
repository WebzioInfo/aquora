using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.User
{
    public class UserProfileDto
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? Username { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? PhotoUrl { get; set; }
        public string? PhotoPublicId { get; set; }
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Shift { get; set; }
        public DateTime? JoiningDate { get; set; }
        public bool IsActive { get; set; }
        public bool EmailVerified { get; set; }
        public DateTime? EmailVerifiedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public bool IsPlatformAdmin { get; set; }
        public Guid? TenantId { get; set; }
        public string? CompanyName { get; set; }
        public string? TenantSchema { get; set; }
        public string? RoleName { get; set; }
        public List<string> Roles { get; set; } = new();
        public List<string> Permissions { get; set; } = new();
        public int DevicesCount { get; set; } = 1;
        public bool OwnsCompany { get; set; }
        public Guid? AssignedProductionLineId { get; set; }

        // Professional & QC Metadata
        public string? Qualification { get; set; }
        public string? CertificationDetails { get; set; }
        public int? ExperienceYears { get; set; }
        public string? AssignedLabStation { get; set; }
        public string? QcResponsibilities { get; set; }
        public string? SignatureUrl { get; set; }
        public string? SignaturePublicId { get; set; }
    }

    public class UpdateUserProfileRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Username { get; set; }
        public string? Phone { get; set; }
        public string? PhotoUrl { get; set; }
        public string? PhotoPublicId { get; set; }
        public string? Department { get; set; }

        // QC Metadata (Only editable by QC, Quality staff, or Authorized users)
        public string? Qualification { get; set; }
        public string? CertificationDetails { get; set; }
        public int? ExperienceYears { get; set; }
        public string? AssignedLabStation { get; set; }
        public string? QcResponsibilities { get; set; }
        public string? SignatureUrl { get; set; }
        public string? SignaturePublicId { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class UserSecuritySummaryDto
    {
        public DateTime? LastLoginAt { get; set; }
        public bool EmailVerified { get; set; }
        public DateTime? EmailVerifiedAt { get; set; }
        public int DevicesCount { get; set; } = 1;
        public int TokenVersion { get; set; }
        public bool TwoFactorEnabled { get; set; }
        public List<UserAuditEventDto> RecentAuditEvents { get; set; } = new();
    }

    public class UserAuditEventDto
    {
        public string Action { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string? IpAddress { get; set; }
        public string? Device { get; set; }
        public string? Reason { get; set; }
    }

    public class UpdateAvatarRequest
    {
        public string? PhotoUrl { get; set; }
    }
}
