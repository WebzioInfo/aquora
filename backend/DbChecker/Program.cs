using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;

class CommandLoggerInterceptor : DbCommandInterceptor
{
    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"\n==================== [COMMAND FAILED] ====================");
        Console.WriteLine($"SQL: {command.CommandText}");
        Console.WriteLine($"ERROR: {eventData.Exception.Message}");
        Console.WriteLine($"==========================================================\n");
        Console.ResetColor();
        base.CommandFailed(command, eventData);
    }

    public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"\n==================== [COMMAND FAILED ASYNC] ====================");
        Console.WriteLine($"SQL: {command.CommandText}");
        Console.WriteLine($"ERROR: {eventData.Exception.Message}");
        Console.WriteLine($"================================================================\n");
        Console.ResetColor();
        return base.CommandFailedAsync(command, eventData, cancellationToken);
    }
}

class Program
{
    static async Task Main(string[] args)
    {
        var connStr = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";
        
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Warning));
        
        var configBuilder = new ConfigurationBuilder();
        configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connStr
        });
        var config = configBuilder.Build();
        services.AddSingleton<IConfiguration>(config);

        services.AddScoped<ITenantProvider, Aquora.Infrastructure.Services.TenantProvider>();
        services.AddScoped<ICurrentUserContext, Aquora.Infrastructure.Services.CurrentUserContext>();
        services.AddHttpContextAccessor();

        var interceptor = new CommandLoggerInterceptor();

        services.AddDbContext<PlatformDbContext>(options =>
        {
            options.UseNpgsql(connStr, b => b.MigrationsAssembly(typeof(PlatformDbContext).Assembly.FullName))
                   .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
                   .AddInterceptors(interceptor);
        });

        services.AddDbContext<TenantDbContext>((sp, options) =>
        {
            var tenantProvider = sp.GetRequiredService<ITenantProvider>();
            var schema = !string.IsNullOrWhiteSpace(tenantProvider.TenantSchemaName)
                ? tenantProvider.TenantSchemaName
                : "public";
            options.UseNpgsql(connStr,
                b => b.MigrationsAssembly(typeof(TenantDbContext).Assembly.FullName)
                      .MigrationsHistoryTable("__EFMigrationsHistory", schema))
                   .ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                   .ReplaceService<IMigrationsSqlGenerator, TenantMigrationsSqlGenerator>()
                   .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
                   .AddInterceptors(interceptor);
        });

        services.AddScoped<IPlatformDbContext>(sp => sp.GetRequiredService<PlatformDbContext>());
        services.AddScoped<ITenantDbContext>(sp => sp.GetRequiredService<TenantDbContext>());
        services.AddScoped<ITenantDatabaseService, TenantDatabaseService>();

        var provider = services.BuildServiceProvider();

        Console.WriteLine("Testing TenantDatabaseService.ProvisionTenantAsync directly on fresh test tenant...");
        var testTenantId = Guid.NewGuid();
        var testSchemaName = "aquora_tenant_test_prov_live2";
        var testOwnerUserId = Guid.NewGuid();

        // Create Platform user & tenant records first
        using (var setupScope = provider.CreateScope())
        {
            var pContext = setupScope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var user = new User
            {
                Id = testOwnerUserId,
                Username = $"testowner_{testTenantId.ToString().Substring(0,8)}@test.com",
                Email = $"testowner_{testTenantId.ToString().Substring(0,8)}@test.com",
                FirstName = "Test",
                LastName = "Owner",
                PasswordHash = "hash",
                EmailVerified = true,
                CreatedAt = DateTime.UtcNow
            };
            pContext.Users.Add(user);

            var tenant = new Tenant
            {
                Id = testTenantId,
                Name = "Test Diagnostic Aqua 2",
                Code = "TEST_DIAG_2",
                SchemaName = testSchemaName,
                Subdomain = $"testdiag_{testTenantId.ToString().Substring(0,6)}",
                IsInitialized = false,
                Status = "Provisioning",
                Progress = 10,
                CurrentStep = "TenantCreated",
                StartedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            pContext.Tenants.Add(tenant);
            await pContext.SaveChangesAsync();
        }

        Console.WriteLine($"Created platform records for {testTenantId}. Now running ProvisionTenantAsync...");

        using (var runScope = provider.CreateScope())
        {
            var service = runScope.ServiceProvider.GetRequiredService<ITenantDatabaseService>();
            try
            {
                var result = await service.ProvisionTenantAsync(
                    testTenantId,
                    testSchemaName,
                    "Test Diagnostic Aqua 2",
                    "TEST_DIAG_2",
                    testOwnerUserId,
                    new List<string> { "Blowing", "Filling" },
                    (progress, step, status) =>
                    {
                        Console.WriteLine($"[PROGRESS {progress}%]: Step={step}, Status={status}");
                        return Task.CompletedTask;
                    });

                Console.WriteLine($"\n[SUCCESS]: ProvisionTenantAsync completed! CompanyId={result.CompanyId}, OwnerRoleId={result.OwnerRoleId}");
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"\n[PROVISIONING FAILED EXCEPTION]:");
                Console.WriteLine($"Type: {ex.GetType().FullName}");
                Console.WriteLine($"Message: {ex.Message}");
                Console.WriteLine($"Stack: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"Inner: {ex.InnerException.GetType().FullName}: {ex.InnerException.Message}");
                }
                Console.ResetColor();
            }
        }
    }
}
