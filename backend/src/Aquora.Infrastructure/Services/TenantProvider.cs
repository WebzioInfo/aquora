using System;
using Aquora.Application.Interfaces;

namespace Aquora.Infrastructure.Services
{
    public class TenantProvider : ITenantProvider
    {
        public Guid TenantId { get; private set; }
        public string TenantSchemaName { get; private set; } = string.Empty;

        public void SetTenantId(Guid tenantId)
        {
            TenantId = tenantId;
        }

        public void SetTenantSchemaName(string schemaName)
        {
            if (string.IsNullOrWhiteSpace(schemaName))
            {
                throw new ArgumentException("Tenant schema name is required.", nameof(schemaName));
            }

            TenantSchemaName = schemaName;
        }
    }
}
