using System;
using System.Linq;
using System.Runtime.InteropServices;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.Interfaces;

namespace Aquora.Infrastructure.Services
{
    public class DateTimeProvider : IDateTimeProvider
    {
        private readonly IServiceProvider _serviceProvider;

        public DateTimeProvider(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public DateTime UtcNow => DateTime.UtcNow;

        private (string timezoneId, string dateFormat, string timeFormat) GetCompanyPreferences()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var tenantContext = scope.ServiceProvider.GetService<ITenantDbContext>();
                if (tenantContext != null)
                {
                    var company = tenantContext.Companies.FirstOrDefault(c => !c.IsDeleted);
                    if (company != null)
                    {
                        return (
                            company.TimeZone ?? "Asia/Kolkata",
                            company.DateFormat ?? "dd MMM yyyy",
                            company.TimeFormat ?? "12h"
                        );
                    }
                }
            }
            catch
            {
                // Fallback to defaults during migrations, onboarding, etc.
            }

            return ("Asia/Kolkata", "dd MMM yyyy", "12h");
        }

        private TimeZoneInfo GetTimeZoneInfo(string timezoneId)
        {
            var normalizedId = timezoneId;
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                if (timezoneId == "Asia/Kolkata") normalizedId = "India Standard Time";
                else if (timezoneId == "UTC") normalizedId = "UTC";
                else if (timezoneId == "Europe/London") normalizedId = "GMT Standard Time";
                else if (timezoneId == "Asia/Dubai") normalizedId = "Arabian Standard Time";
                else if (timezoneId == "Asia/Singapore") normalizedId = "Singapore Standard Time";
            }
            else
            {
                if (timezoneId == "India Standard Time") normalizedId = "Asia/Kolkata";
                else if (timezoneId == "GMT Standard Time") normalizedId = "Europe/London";
                else if (timezoneId == "Arabian Standard Time") normalizedId = "Asia/Dubai";
                else if (timezoneId == "Singapore Standard Time") normalizedId = "Asia/Singapore";
            }

            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(normalizedId);
            }
            catch
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
                }
                catch
                {
                    return TimeZoneInfo.Utc;
                }
            }
        }

        public DateTime ConvertToCompanyTime(DateTime utcDateTime, string? timezoneId = null)
        {
            var tz = timezoneId ?? GetCompanyPreferences().timezoneId;
            var tzInfo = GetTimeZoneInfo(tz);
            
            // Ensure DateTimeKind is Utc or Unspecified (treated as UTC) for conversion
            var cleanUtc = utcDateTime.Kind == DateTimeKind.Utc 
                ? utcDateTime 
                : DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);

            return TimeZoneInfo.ConvertTimeFromUtc(cleanUtc, tzInfo);
        }

        public string FormatDate(DateTime utcDateTime, string? timezoneId = null, string? dateFormat = null)
        {
            var prefs = GetCompanyPreferences();
            var tz = timezoneId ?? prefs.timezoneId;
            var format = dateFormat ?? prefs.dateFormat;
            
            var localTime = ConvertToCompanyTime(utcDateTime, tz);
            return localTime.ToString(format);
        }

        public string FormatTime(DateTime utcDateTime, string? timezoneId = null, string? timeFormat = null)
        {
            var prefs = GetCompanyPreferences();
            var tz = timezoneId ?? prefs.timezoneId;
            var format = timeFormat ?? prefs.timeFormat;

            var localTime = ConvertToCompanyTime(utcDateTime, tz);
            return format == "24h" ? localTime.ToString("HH:mm") : localTime.ToString("hh:mm tt");
        }

        public string FormatDateTime(DateTime utcDateTime, string? timezoneId = null, string? dateFormat = null, string? timeFormat = null)
        {
            var prefs = GetCompanyPreferences();
            var tz = timezoneId ?? prefs.timezoneId;
            var dFormat = dateFormat ?? prefs.dateFormat;
            var tFormat = timeFormat ?? prefs.timeFormat;

            var localTime = ConvertToCompanyTime(utcDateTime, tz);
            var dateStr = localTime.ToString(dFormat);
            var timeStr = tFormat == "24h" ? localTime.ToString("HH:mm") : localTime.ToString("hh:mm tt");
            return $"{dateStr} {timeStr}";
        }
    }
}
