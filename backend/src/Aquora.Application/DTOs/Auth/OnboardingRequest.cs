namespace Aquora.Application.DTOs.Auth
{
    public class OnboardingRequest
    {
        public string CompanyName { get; set; }
        public string CompanyCode { get; set; }
        public string BusinessType { get; set; }
        public string Currency { get; set; }
        public string Subdomain { get; set; }
    }
}
