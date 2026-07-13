namespace Aquora.Application.DTOs.Auth
{
    public class SendOtpRequest
    {
        public string Email { get; set; }
        public string Purpose { get; set; } = "Registration";
    }

    public class VerifyOtpRequest
    {
        public string Email { get; set; }
        public string Code { get; set; }
        public string Purpose { get; set; } = "Registration";
    }
}
