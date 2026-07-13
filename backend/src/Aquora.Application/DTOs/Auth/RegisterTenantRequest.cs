namespace Aquora.Application.DTOs.Auth
{
    public class RegisterTenantRequest
    {
        public string TenantName { get; set; }
        public string TenantCode { get; set; }
        public string AdminEmail { get; set; }
        public string AdminPassword { get; set; }
        public string AdminFirstName { get; set; }
        public string AdminLastName { get; set; }
    }
}
