using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OTPVerification : BaseEntity
    {
        public string Email { get; set; }
        public string Code { get; set; }
        public string Purpose { get; set; } = "Registration";
        public DateTime ExpiryTime { get; set; }
        public int Attempts { get; set; }
        public int SendCount { get; set; }
        public DateTime? LastSentAt { get; set; }
        public bool IsVerified { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
