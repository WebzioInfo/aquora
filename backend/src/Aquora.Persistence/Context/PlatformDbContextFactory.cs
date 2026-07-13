using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Aquora.Persistence.Context
{
    public class PlatformDbContextFactory : IDesignTimeDbContextFactory<PlatformDbContext>
    {
        public PlatformDbContext CreateDbContext(string[] args)
        {
            var builder = new DbContextOptionsBuilder<PlatformDbContext>();
            var connectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;";

            builder.UseNpgsql(connectionString);

            return new PlatformDbContext(builder.Options);
        }
    }
}
