using System;

namespace Aquora.Application.DTOs.Auth
{
    public class CompanyOnboardingRequest
    {
        public string CompanyName { get; set; }
        public int EmployeeCount { get; set; }
        public string HowDidYouHearAboutUs { get; set; }
        public System.Collections.Generic.List<string>? EnabledStations { get; set; }
    }

    public class CompanyOnboardingResponse
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public string CompanyName { get; set; }
        public string SchemaName { get; set; }
        public string OwnerRole { get; set; }
        public string ProvisioningStatus { get; set; }
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
        public int ExpiresIn { get; set; }
        public System.Collections.Generic.List<string> Permissions { get; set; }
    }
}
