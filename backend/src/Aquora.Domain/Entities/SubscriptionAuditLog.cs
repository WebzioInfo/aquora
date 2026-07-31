using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SubscriptionAuditLog : BaseEntity
    {
        public Guid? PlanId { get; set; }
        public Guid? TenantId { get; set; }

        public string Action { get; set; } = string.Empty; // CREATE_PLAN, UPDATE_PLAN, DELETE_PLAN, ARCHIVE_PLAN, PUBLISH_PLAN, ASSIGN_TENANT, CHANGE_PRICE, CHANGE_LIMITS
        public string PerformerUserId { get; set; } = "System";
        public string PerformerUserEmail { get; set; } = "system@aquora.local";

        public string? OldValuesJson { get; set; }
        public string? NewValuesJson { get; set; }
        public string Reason { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string IpAddress { get; set; } = "127.0.0.1";
    }
}
