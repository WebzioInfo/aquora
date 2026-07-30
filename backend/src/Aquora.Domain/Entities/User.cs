using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class User : BaseEntity, IAuditable, ISoftDelete
    {
        public string Email { get; set; }
        public string PasswordHash { get; set; }
        public string? Username { get; set; }
        public string? PinHash { get; set; }
        public string? Department { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public bool IsActive { get; set; } = true;
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiryTime { get; set; }
        public bool EmailVerified { get; set; }
        public DateTime? EmailVerifiedAt { get; set; }
        public int TokenVersion { get; set; }
        public bool IsPlatformAdmin { get; set; }

        // User Directory Metadata
        public string? Phone { get; set; }
        public string? RoleName { get; set; }
        public string? Designation { get; set; }
        public string? Shift { get; set; }
        public decimal? Salary { get; set; }
        public DateTime? JoiningDate { get; set; }
        public string? PhotoUrl { get; set; }
        public int DevicesCount { get; set; } = 1;

        public Guid? TenantId { get; set; }
        public virtual Tenant Tenant { get; set; }

        public Guid? AssignedProductionLineId { get; set; }

        // Auditable
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}

