using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class AssetHistory : BaseEntity
    {
        public Guid AssetId { get; set; }
        public virtual Asset Asset { get; set; } = null!;

        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string Action { get; set; } = string.Empty; // Created, Purchased, Location Changed, Assigned, Warranty Updated, Repair, Maintenance, Disposed, Scrapped
        public string PerformedBy { get; set; } = string.Empty;

        public string? PreviousValue { get; set; }
        public string? NewValue { get; set; }
        public string? Remarks { get; set; }
    }
}
