using System.ComponentModel.DataAnnotations;

namespace Aquora.Infrastructure.Configuration
{
    public class SmtpOptions
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 587;
        public string User { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FromName { get; set; } = "Aquora ERP";
        public string FromEmail { get; set; } = string.Empty;
        public bool UseSsl { get; set; } = false;
    }
}
