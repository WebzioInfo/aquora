using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.Interfaces;
using Aquora.Persistence.Context;

namespace Aquora.Persistence
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection");

            // Register PlatformDbContext (locked to public schema)
            services.AddDbContext<PlatformDbContext>((sp, options) =>
            {
                options.UseNpgsql(
                    connectionString,
                    b => b.MigrationsAssembly(typeof(PlatformDbContext).Assembly.FullName))
                       .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));

                var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
                if (env == "Development")
                {
                    options.EnableSensitiveDataLogging()
                           .LogTo(Console.WriteLine, Microsoft.Extensions.Logging.LogLevel.Information);
                }
            });

            // Register TenantDbContext (dynamic schema switching)
            services.AddDbContext<TenantDbContext>((sp, options) =>
            {
                var tenantProvider = sp.GetRequiredService<ITenantProvider>();
                var schema = !string.IsNullOrWhiteSpace(tenantProvider.TenantSchemaName)
                    ? tenantProvider.TenantSchemaName
                    : "public";
                options.UseNpgsql(connectionString,
                    b => b.MigrationsAssembly(typeof(TenantDbContext).Assembly.FullName)
                          .MigrationsHistoryTable("__EFMigrationsHistory", schema))
                       .ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                       .ReplaceService<IMigrationsSqlGenerator, TenantMigrationsSqlGenerator>()
                       .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));

                var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
                if (env == "Development")
                {
                    options.EnableSensitiveDataLogging()
                           .LogTo(Console.WriteLine, Microsoft.Extensions.Logging.LogLevel.Information);
                }
            });

            services.AddScoped<IPlatformDbContext>(provider => 
                provider.GetRequiredService<PlatformDbContext>());

            services.AddScoped<ITenantDbContext>(provider => 
                provider.GetRequiredService<TenantDbContext>());

            services.AddScoped<ITenantDatabaseService, Aquora.Persistence.Services.TenantDatabaseService>();
            services.AddScoped<IMigrationService, Aquora.Persistence.Services.MigrationService>();
            services.AddScoped<Aquora.Application.Interfaces.Services.IPlatformManagementService, Aquora.Persistence.Services.PlatformManagementService>();
            services.AddScoped<Aquora.Application.Interfaces.Services.IUserRoleResolver, Aquora.Persistence.Services.UserRoleResolver>();
            services.AddScoped<Aquora.Application.Interfaces.Services.ISubscriptionManagementService, Aquora.Persistence.Services.SubscriptionManagementService>();
            services.AddScoped<Aquora.Application.Interfaces.Services.IPayrollService, Aquora.Application.Services.PayrollService>();

            return services;
        }
    }
}
