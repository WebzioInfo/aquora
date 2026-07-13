using System.Threading.Channels;
using System.Threading.Tasks;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Infrastructure.Services
{
    public class TenantProvisioningQueue : ITenantProvisioningQueue
    {
        private readonly Channel<TenantProvisioningJob> _queue;

        public TenantProvisioningQueue()
        {
            _queue = Channel.CreateUnbounded<TenantProvisioningJob>(new UnboundedChannelOptions
            {
                SingleReader = true,
                SingleWriter = false
            });
        }

        public void QueueProvisioning(TenantProvisioningJob job)
        {
            _queue.Writer.TryWrite(job);
        }

        public ValueTask<TenantProvisioningJob> DequeueAsync(System.Threading.CancellationToken cancellationToken)
        {
            return _queue.Reader.ReadAsync(cancellationToken);
        }
    }
}
