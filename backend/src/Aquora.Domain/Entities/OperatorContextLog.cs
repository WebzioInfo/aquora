using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperatorContextLog : BaseEntity, IMultiTenant
    {
        public Guid UserId { get; set; }
        public Guid? OldLineId { get; set; }
        public Guid NewLineId { get; set; }
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
        public string Device { get; set; } = "Unknown";
        public string IPAddress { get; set; } = "127.0.0.1";

        public Guid TenantId { get; set; }
    }
}
