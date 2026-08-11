namespace Aquora.Infrastructure.Configuration
{
    public class SmtpOptions
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 587;
        public string Username { get; set; } = string.Empty;
        public string User
        {
            get => Username;
            set => Username = value;
        }
        public string Password { get; set; } = string.Empty;
        public string FromName { get; set; } = "Aquora";
        public string FromEmail { get; set; } = string.Empty;
        public bool EnableSsl { get; set; } = true;
        public bool UseSsl
        {
            get => EnableSsl;
            set => EnableSsl = value;
        }
    }
}
