using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SubscriptionPlan : BaseEntity, IAuditable, ISoftDelete
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public decimal MonthlyPrice { get; set; }
        public decimal YearlyPrice { get; set; }
        public decimal? OfferPrice { get; set; }
        public decimal? DiscountPercent { get; set; }

        public string Currency { get; set; } = "INR";
        public string BillingCycle { get; set; } = "Monthly"; // Monthly, Quarterly, Half-Yearly, Yearly, Lifetime, Custom

        public int TrialDays { get; set; } = 14;
        public int DurationDays { get; set; } = 30; // 30, 90, 180, 365, 99999 (Lifetime)

        public int DisplayOrder { get; set; } = 1;
        public bool IsPopular { get; set; }
        public bool IsRecommended { get; set; }
        public string Color { get; set; } = "#3B82F6";

        public string Status { get; set; } = "Published"; // Draft, Published, Archived, Inactive, Expired, Hidden
        public string TaxType { get; set; } = "Tax Exclusive"; // Tax Included, Tax Exclusive
        public bool AutoActivateTrial { get; set; } = true;

        public virtual ICollection<SubscriptionFeature> Features { get; set; } = new List<SubscriptionFeature>();
        public virtual SubscriptionPlanLimits? Limits { get; set; }

        // Auditable
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = "System";
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
