namespace Aquora.Application.DTOs.Auth
{
    public class OTPRegisterRequest
    {
        public string Email { get; set; }
        public string Password { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Code { get; set; }
    }
}
