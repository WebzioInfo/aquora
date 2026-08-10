using System;

namespace Aquora.Application.Common.Exceptions
{
    public class OtpRateLimitException : InvalidOperationException
    {
        public int RetryAfterSeconds { get; }

        public OtpRateLimitException(string message, int retryAfterSeconds) : base(message)
        {
            RetryAfterSeconds = Math.Max(1, retryAfterSeconds);
        }
    }
}
