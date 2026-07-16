using System;
using System.Threading.Tasks;

namespace Aquora.Application.Interfaces
{
    public class TenantProvisioningResult
    {
        public Guid CompanyId { get; set; }
        public Guid OwnerRoleId { get; set; }
        public string OwnerRoleName { get; set; } = "CompanyAdmin";
    }

    public interface ITenantDatabaseService
    {
        Task<Guid> CreateAndMigrateTenantAsync(
            Guid tenantId, 
            string schemaName, 
            string subdomain, 
            string companyName, 
            Guid userId);

        Task<TenantProvisioningResult> ProvisionTenantAsync(
            Guid tenantId,
            string schemaName,
            string companyName,
            string companyCode,
            Guid ownerUserId,
            System.Collections.Generic.List<string>? enabledStations = null,
            Func<int, string, string, Task>? onProgress = null);

        Task DropTenantSchemaAsync(string schemaName);
    }
}
