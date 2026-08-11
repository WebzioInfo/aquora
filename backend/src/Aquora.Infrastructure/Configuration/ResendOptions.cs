namespace Aquora.Infrastructure.Configuration
{
    public class ResendOptions
    {
        public string ApiKey { get; set; } = string.Empty;
        public string FromEmail { get; set; } = string.Empty;
        public string FromName { get; set; } = "Aquora";
    }
}
