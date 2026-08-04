using System;

namespace Aquora.Application.Interfaces
{
    public interface IDateTimeProvider
    {
        DateTime UtcNow { get; }
        DateTime ConvertToCompanyTime(DateTime utcDateTime, string? timezoneId = null);
        string FormatDate(DateTime utcDateTime, string? timezoneId = null, string? dateFormat = null);
        string FormatTime(DateTime utcDateTime, string? timezoneId = null, string? timeFormat = null);
        string FormatDateTime(DateTime utcDateTime, string? timezoneId = null, string? dateFormat = null, string? timeFormat = null);
    }
}
