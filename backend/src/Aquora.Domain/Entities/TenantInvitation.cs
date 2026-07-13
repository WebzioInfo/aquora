using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class TenantInvitation : BaseEntity
    {
        public Guid TenantId { get; set; }
        public string Email { get; set; }
        public Guid RoleId { get; set; }
        public string? Message { get; set; }
        public string Token { get; set; }
        public string Status { get; set; } = "Pending";
        public Guid InvitedByUserId { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? AcceptedAt { get; set; }
    }
}
