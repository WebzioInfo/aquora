using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Auth
{
    public class LoginResponse
    {
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
        public int ExpiresIn { get; set; } // in seconds
        public Guid UserId { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public Guid? TenantId { get; set; }
        public List<string> Roles { get; set; }
        public List<string> Permissions { get; set; }
        public bool IsTenantInitialized { get; set; }
        public string TenantStatus { get; set; }
        public bool EmailVerified { get; set; }
        public Guid? AssignedProductionLineId { get; set; }
        public int OnboardingProgress { get; set; }
        public string? OnboardingStep { get; set; }
        public string? OnboardingFailureReason { get; set; }
    }
}
