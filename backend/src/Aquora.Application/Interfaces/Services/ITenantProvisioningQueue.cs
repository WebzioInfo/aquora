using System;
using System.Threading;
using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public class TenantProvisioningJob
    {
        public Guid TenantId { get; set; }
        public string SchemaName { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string CompanyCode { get; set; } = string.Empty;
        public Guid OwnerUserId { get; set; }
    }

    public interface ITenantProvisioningQueue
    {
        void QueueProvisioning(TenantProvisioningJob job);
        ValueTask<TenantProvisioningJob> DequeueAsync(CancellationToken cancellationToken);
    }
}
