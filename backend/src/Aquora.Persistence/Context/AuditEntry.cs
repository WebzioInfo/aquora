using System;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Aquora.Domain.Entities;

namespace Aquora.Persistence.Context
{
    public class AuditEntry
    {
        public AuditEntry(EntityEntry entry)
        {
            Entry = entry;
        }

        public EntityEntry Entry { get; }
        public string? UserId { get; set; }
        public string? UserEmail { get; set; }
        public Guid TenantId { get; set; }
        public string? TableName { get; set; }
        public string? AuditType { get; set; }
        public string? IpAddress { get; set; }
        public string? Device { get; set; }
        public string? Reason { get; set; }
        public string? Module { get; set; }
        public Dictionary<string, object> KeyValues { get; } = new Dictionary<string, object>();
        public Dictionary<string, object> OldValues { get; } = new Dictionary<string, object>();
        public Dictionary<string, object> NewValues { get; } = new Dictionary<string, object>();
        public List<string> ChangedColumns { get; } = new List<string>();

        public AuditLog ToAudit()
        {
            var audit = new AuditLog
            {
                TenantId = TenantId,
                UserId = UserId ?? "System",
                UserEmail = UserEmail ?? "system@aquora.com",
                Action = AuditType ?? "Unknown",
                TableName = TableName ?? "Unknown",
                Timestamp = DateTime.UtcNow,
                PrimaryKey = KeyValues.Count == 0 ? "{}" : JsonSerializer.Serialize(KeyValues),
                OldValues = OldValues.Count == 0 ? "{}" : JsonSerializer.Serialize(OldValues),
                NewValues = NewValues.Count == 0 ? "{}" : JsonSerializer.Serialize(NewValues),
                IpAddress = IpAddress ?? "127.0.0.1",
                Device = Device ?? "Unknown",
                Reason = Reason ?? "System Operation",
                Module = Module ?? "Default"
            };
            return audit;
        }
    }
}
