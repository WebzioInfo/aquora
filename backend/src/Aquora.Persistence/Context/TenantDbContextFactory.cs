using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Aquora.Application.Interfaces;

namespace Aquora.Persistence.Context
{
    public class TenantDbContextFactory : IDesignTimeDbContextFactory<TenantDbContext>
    {
        public TenantDbContext CreateDbContext(string[] args)
        {
            var builder = new DbContextOptionsBuilder<TenantDbContext>();
            var connectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;";

            builder.UseNpgsql(connectionString);

            // Dummy providers for design time
            var tenantProvider = new DesignTimeTenantProvider();
            var currentUserContext = new DesignTimeCurrentUserContext();

            return new TenantDbContext(builder.Options, tenantProvider, currentUserContext);
        }

        private class DesignTimeTenantProvider : ITenantProvider
        {
            public Guid TenantId => Guid.Empty;
            public string TenantSchemaName => "public"; 
            public void SetTenantId(Guid tenantId) { }
            public void SetTenantSchemaName(string schemaName) { }
        }

        private class DesignTimeCurrentUserContext : ICurrentUserContext
        {
            public string UserId => "design_time_user_id";
            public string Email => "design@time.com";
            public Guid TenantId => Guid.Empty;
            public System.Collections.Generic.IEnumerable<string> Roles => new string[0];
            public System.Collections.Generic.IEnumerable<string> Permissions => new string[0];
            public string IpAddress => "";
            public string UserAgent => "";
            public string Reason => "";
            public string Module => "";
            public bool IsAuthenticated => true;
            public bool HasPermission(string permission) => true;
        }
    }
}
