using System;
using System.Collections.Generic;

namespace Aquora.Shared.Models
{
    public class HealthStatusDto
    {
        public string Status { get; set; } = "Healthy";
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public double UptimeSeconds { get; set; }
        public string UptimeFormatted { get; set; } = string.Empty;
        public string Environment { get; set; } = string.Empty;
        public string MachineName { get; set; } = string.Empty;
        public double MemoryAllocatedMb { get; set; }
        public double MemoryWorkingSetMb { get; set; }
        public DatabaseHealthDto Database { get; set; } = new DatabaseHealthDto();
        public Dictionary<string, ComponentCheckDto> Checks { get; set; } = new Dictionary<string, ComponentCheckDto>();
    }

    public class DatabaseHealthDto
    {
        public bool CanConnect { get; set; }
        public long LatencyMs { get; set; }
        public string DatabaseName { get; set; } = string.Empty;
        public string Provider { get; set; } = string.Empty;
        public string Error { get; set; } = string.Empty;
    }

    public class ComponentCheckDto
    {
        public string Status { get; set; } = "Healthy";
        public string Description { get; set; } = string.Empty;
        public long DurationMs { get; set; }
        public Dictionary<string, object> Details { get; set; } = new Dictionary<string, object>();
    }
}
