using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities.Administration;
using Aquora.Persistence;
using Aquora.Persistence.Context;
using Aquora.Shared.Models;
using Npgsql;

class DummyTenantProvider : ITenantProvider
{
    public Guid TenantId { get; set; } = Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee");
    public string TenantSchemaName { get; set; } = "aquora_tenant_sinan_company";
    public void SetTenantId(Guid tenantId) => TenantId = tenantId;
    public void SetTenantSchemaName(string schemaName) => TenantSchemaName = schemaName;
}

class DummyUserContext : ICurrentUserContext
{
    public string? UserId => "SystemTestUser";
    public string? Email => "admin@test.com";
    public Guid TenantId => Guid.Empty;
    public IEnumerable<string> Roles => new[] { "SuperAdmin" };
    public IEnumerable<string> Permissions => new[] { "All" };
    public string IpAddress => "127.0.0.1";
    public string UserAgent => "ConsoleTestRunner";
    public string? Reason => "Test";
    public string Module => "Test";
    public bool IsAuthenticated => true;
    public bool HasPermission(string permission) => true;
}

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("=========================================================");
        Console.WriteLine("[FULL RESTORE & USER NAME RESOLUTION VERIFICATION TEST]");
        Console.WriteLine("=========================================================");

        var connStr = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        var configBuilder = new ConfigurationBuilder();
        configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "ConnectionStrings:DefaultConnection", connStr },
            { "BackupSettings:Passphrase", "AquoraEnterpriseBackupPassphrase2026!#" }
        });
        var configuration = configBuilder.Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Warning));

        var tenantProvider = new DummyTenantProvider();
        services.AddSingleton<ITenantProvider>(tenantProvider);
        services.AddSingleton<ICurrentUserContext>(new DummyUserContext());
        services.AddScoped<IExportService, ExportService>();
        services.AddScoped<IBackupService, BackupService>();

        services.AddDbContext<PlatformDbContext>(options => options.UseNpgsql(connStr));
        services.AddDbContext<TenantDbContext>((sp, options) => options.UseNpgsql(connStr));

        services.AddScoped<IPlatformDbContext>(sp => sp.GetRequiredService<PlatformDbContext>());
        services.AddScoped<ITenantDbContext>(sp => sp.GetRequiredService<TenantDbContext>());

        var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var backupService = scope.ServiceProvider.GetRequiredService<IBackupService>();
        var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();

        var latestBackup = await platformContext.BackupHistories
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(b => b.TenantId == tenantProvider.TenantId && !b.IsDeleted);

        if (latestBackup == null)
        {
            Console.WriteLine("No backup found in database.");
            return;
        }

        Console.WriteLine($"Selected Backup: {latestBackup.BackupName} (Id: {latestBackup.Id})");

        try
        {
            var result = await backupService.RestoreBackupAsync(latestBackup.Id, new RestoreBackupRequest { ConfirmationText = "RESTORE" });

            Console.WriteLine("=========================================================");
            Console.WriteLine("[TEST COMPLETED SUCCESSFULLY]");
            Console.WriteLine($"Status:          {result.Status}");
            Console.WriteLine($"Details:         {result.Details}");
            Console.WriteLine($"Started At:      {result.StartedAt}");
            Console.WriteLine($"Completed At:    {result.CompletedAt}");
            Console.WriteLine($"Started By Name: {result.StartedByName}");
            Console.WriteLine("=========================================================");
        }
        catch (Exception ex)
        {
            Console.WriteLine("========== EXCEPTION THROWN ==========");
            Console.WriteLine(ex.ToString());
            Console.WriteLine("======================================");
        }
    }
}
