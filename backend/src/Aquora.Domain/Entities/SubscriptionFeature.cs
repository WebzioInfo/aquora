using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SubscriptionFeature : BaseEntity
    {
        public Guid PlanId { get; set; }
        public virtual SubscriptionPlan? Plan { get; set; }

        public string FeatureName { get; set; } = string.Empty;
        public string? FeatureDescription { get; set; }
        public string FeatureCategory { get; set; } = "Core Modules"; // Core Modules, Analytics & Reports, Security & Support, Integrations
        public string FeatureValue { get; set; } = "Yes";
        public string? FeatureUnit { get; set; }

        public int DisplayOrder { get; set; } = 1;
        public bool IsHighlighted { get; set; }
        public bool IsUnlimited { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
