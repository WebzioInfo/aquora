using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class PurchaseTimelineEvent : BaseEntity
    {
        public Guid PurchaseId { get; set; }
        public virtual Purchase Purchase { get; set; } = null!;

        public DateTime EventDate { get; set; } = DateTime.UtcNow;
        public string Action { get; set; } = string.Empty; // Purchase Created, Payment Added, Status Changed, Asset Created, Inventory Updated
        public string PerformedBy { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }
}
