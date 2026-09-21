using System;

namespace Aquora.Application.DTOs.Auth
{
    public class SendOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Purpose { get; set; } = "Registration";
    }

    public class VerifyOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Purpose { get; set; } = "Registration";
    }

    public class ForgotPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class VerifyPasswordResetOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }

    public class VerifyPasswordResetOtpResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string ResetToken { get; set; } = string.Empty;
        public int ExpiresInMinutes { get; set; } = 15;
    }

    public class ResendOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Purpose { get; set; } = "Registration";
    }

    public class RequestEmailChangeRequest
    {
        public string NewEmail { get; set; } = string.Empty;
    }

    public class VerifyEmailChangeRequest
    {
        public string NewEmail { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }
}
