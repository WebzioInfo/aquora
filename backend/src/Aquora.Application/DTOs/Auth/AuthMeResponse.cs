using System;

namespace Aquora.Application.DTOs.Auth
{
    public class AuthMeResponse
    {
        public Guid UserId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public bool EmailVerified { get; set; }
        public bool OwnsCompany { get; set; }
        public int MembershipCount { get; set; }
        public bool IsTenantInitialized { get; set; }
        public string TenantStatus { get; set; }
    }
}
