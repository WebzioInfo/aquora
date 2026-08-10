using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class TenantSubscription : BaseEntity
    {
        public Guid TenantId { get; set; }
        public virtual Tenant? Tenant { get; set; }

        public Guid PlanId { get; set; }
        public virtual SubscriptionPlan? Plan { get; set; }

        public string PlanName { get; set; } = string.Empty;
        public string Status { get; set; } = "Active"; // Active, Trial, Expired, Cancelled, Suspended, Upgraded, Downgraded
        public string BillingCycle { get; set; } = "Monthly";
        public decimal PricePaid { get; set; }
        public string Currency { get; set; } = "INR";

        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        public DateTime EndDate { get; set; } = DateTime.UtcNow.AddDays(30);
        public DateTime? TrialEndDate { get; set; }
        public bool AutoRenew { get; set; } = true;

        public string? AssignedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
