using System;
using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OTPVerification : BaseEntity, IAuditable
    {
        public string Email { get; set; }
        public string OtpHash { get; set; }
        public string Purpose { get; set; } = "Registration";
        public DateTime ExpiryTime { get; set; }
        public int Attempts { get; set; }
        public int SendCount { get; set; }
        public DateTime? LastSentAt { get; set; }
        public bool IsVerified { get; set; }
        public DateTime? VerifiedAt { get; set; }
        public bool IsUsed { get; set; }
        public DateTime? UsedAt { get; set; }
        public string? ResetToken { get; set; }
        public DateTime? ResetTokenExpiryTime { get; set; }
        public string? NewEmail { get; set; }
        public string RequestId { get; set; }

        // IAuditable implementation
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = "System";
        public string? CreatedByIP { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
