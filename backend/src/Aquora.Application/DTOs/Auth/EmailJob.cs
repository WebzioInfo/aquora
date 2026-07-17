namespace Aquora.Application.DTOs.Auth
{
    public class EmailJob
    {
        public string ToEmail { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public bool IsHtml { get; set; }
        public string? OtpCode { get; set; }
        public int ExpiryMinutes { get; set; }
        public bool IsOtp { get; set; }
        public int RetryCount { get; set; }
    }
}
