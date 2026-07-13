using System;

namespace Aquora.Application.Interfaces
{
    public interface ITenantProvider
    {
        Guid TenantId { get; }
        string TenantSchemaName { get; }
        void SetTenantId(Guid tenantId);
        void SetTenantSchemaName(string schemaName);
    }
}
