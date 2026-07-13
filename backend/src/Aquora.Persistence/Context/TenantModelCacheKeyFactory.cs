using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Aquora.Persistence.Context
{
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
        {
            if (context is TenantDbContext tenantContext)
            {
                return (context.GetType(), tenantContext.SchemaName, designTime);
            }
            return (context.GetType(), designTime);
        }
    }
}
