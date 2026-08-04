using System;
using Aquora.Application.Interfaces;

namespace Aquora.Persistence.Context
{
    public class DefaultDateTimeProvider : IDateTimeProvider
    {
        public DateTime UtcNow => DateTime.UtcNow;
        public DateTime ConvertToCompanyTime(DateTime utcDateTime, string? timezoneId = null) => utcDateTime;
        public string FormatDate(DateTime utcDateTime, string? timezoneId = null, string? dateFormat = null) => utcDateTime.ToString("yyyy-MM-dd");
        public string FormatTime(DateTime utcDateTime, string? timezoneId = null, string? timeFormat = null) => utcDateTime.ToString("HH:mm");
        public string FormatDateTime(DateTime utcDateTime, string? timezoneId = null, string? dateFormat = null, string? timeFormat = null) => utcDateTime.ToString("yyyy-MM-dd HH:mm");
    }
}
