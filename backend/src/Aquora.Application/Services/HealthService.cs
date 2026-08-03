using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class HealthService : IHealthService
    {
        private readonly IPlatformDbContext _platformDbContext;
        private static readonly DateTime ProcessStartTime = Process.GetCurrentProcess().StartTime.ToUniversalTime();

        public HealthService(IPlatformDbContext platformDbContext)
        {
            _platformDbContext = platformDbContext;
        }

        public async Task<bool> IsDatabaseHealthyAsync()
        {
            try
            {
                return await _platformDbContext.Database.CanConnectAsync();
            }
            catch
            {
                return false;
            }
        }

        public async Task<HealthStatusDto> GetSystemHealthAsync()
        {
            var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") 
                          ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") 
                          ?? "Production";

            var health = new HealthStatusDto
            {
                Timestamp = DateTime.UtcNow,
                Environment = envName,
                MachineName = Environment.MachineName
            };

            // Calculate Uptime
            var uptimeSpan = DateTime.UtcNow - ProcessStartTime;
            health.UptimeSeconds = Math.Round(uptimeSpan.TotalSeconds, 2);
            health.UptimeFormatted = $"{(int)uptimeSpan.TotalDays}d {uptimeSpan.Hours}h {uptimeSpan.Minutes}m {uptimeSpan.Seconds}s";

            // Memory Usage
            var process = Process.GetCurrentProcess();
            health.MemoryAllocatedMb = Math.Round(GC.GetTotalMemory(forceFullCollection: false) / (1024.0 * 1024.0), 2);
            health.MemoryWorkingSetMb = Math.Round(process.WorkingSet64 / (1024.0 * 1024.0), 2);

            // Database Check
            var dbCheckSw = Stopwatch.StartNew();
            bool isDbConnected = false;
            string dbError = string.Empty;

            try
            {
                isDbConnected = await _platformDbContext.Database.CanConnectAsync();
            }
            catch (Exception ex)
            {
                isDbConnected = false;
                dbError = ex.Message;
            }
            dbCheckSw.Stop();

            health.Database = new DatabaseHealthDto
            {
                CanConnect = isDbConnected,
                LatencyMs = dbCheckSw.ElapsedMilliseconds,
                DatabaseName = "AquoraDB",
                Provider = _platformDbContext.Database.ProviderName ?? "Npgsql.EntityFrameworkCore.PostgreSQL",
                Error = dbError
            };

            // Individual Component Checks
            health.Checks["database"] = new ComponentCheckDto
            {
                Status = isDbConnected ? "Healthy" : "Unhealthy",
                Description = isDbConnected ? "PostgreSQL database is responding normally" : "Database connection failed",
                DurationMs = dbCheckSw.ElapsedMilliseconds,
                Details = new Dictionary<string, object>
                {
                    { "database", health.Database.DatabaseName },
                    { "provider", health.Database.Provider },
                    { "latency_ms", health.Database.LatencyMs }
                }
            };

            health.Checks["memory"] = new ComponentCheckDto
            {
                Status = health.MemoryWorkingSetMb < 2048 ? "Healthy" : "Degraded",
                Description = $"Memory allocated: {health.MemoryAllocatedMb} MB, Working set: {health.MemoryWorkingSetMb} MB",
                DurationMs = 0,
                Details = new Dictionary<string, object>
                {
                    { "allocated_mb", health.MemoryAllocatedMb },
                    { "working_set_mb", health.MemoryWorkingSetMb }
                }
            };

            health.Checks["system"] = new ComponentCheckDto
            {
                Status = "Healthy",
                Description = $"Running on {health.MachineName} in {health.Environment} mode",
                DurationMs = 0,
                Details = new Dictionary<string, object>
                {
                    { "uptime_seconds", health.UptimeSeconds },
                    { "uptime_formatted", health.UptimeFormatted },
                    { "os_version", Environment.OSVersion.ToString() },
                    { "processor_count", Environment.ProcessorCount }
                }
            };

            // Overall Status Determination
            if (!isDbConnected)
            {
                health.Status = "Unhealthy";
            }
            else if (health.MemoryWorkingSetMb >= 2048)
            {
                health.Status = "Degraded";
            }
            else
            {
                health.Status = "Healthy";
            }

            return health;
        }
    }
}
