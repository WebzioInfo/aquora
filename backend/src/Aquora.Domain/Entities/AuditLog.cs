using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class AuditLog : BaseEntity, IMultiTenant
    {
        public Guid TenantId { get; set; }
        public string? UserId { get; set; }
        public string? UserEmail { get; set; }
        public string? Action { get; set; } // Insert, Update, Delete
        public string? TableName { get; set; }
        public string? PrimaryKey { get; set; }
        public string? OldValues { get; set; } // JSON representation
        public string? NewValues { get; set; } // JSON representation
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? IpAddress { get; set; }
        public string? Device { get; set; }
        public string? Reason { get; set; }
        public string? Module { get; set; } // Organization, Production, Auth, etc.
    }
}
