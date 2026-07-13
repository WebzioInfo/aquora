using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class UserMembership : BaseEntity
    {
        public Guid PlatformUserId { get; set; }
        public Guid TenantId { get; set; }
        public Guid RoleId { get; set; }
        public string Status { get; set; } = "Active";
        public Guid? InvitedByUserId { get; set; }
        public DateTime? JoinedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
