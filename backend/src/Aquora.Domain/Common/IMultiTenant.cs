using System;

namespace Aquora.Domain.Common
{
    public interface IMultiTenant
    {
        Guid TenantId { get; set; }
    }
}
