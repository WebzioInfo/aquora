using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Persistence.Context;
using Aquora.Domain.Entities;
using Aquora.Application.Interfaces;
using Microsoft.Extensions.Logging;

class Program
{
    static async Task Main(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(System.IO.Path.GetFullPath(@"..\src\Aquora.API"))
            .AddJsonFile("appsettings.json")
            .AddJsonFile("appsettings.Development.json", optional: true)
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");

        var services = new ServiceCollection();
        services.AddLogging(opt => opt.AddConsole());
        // Mock current user context for the DbContext constructor
        services.AddSingleton<ICurrentUserContext, MockUserContext>();
        services.AddDbContext<PlatformDbContext>(options =>
            options.UseNpgsql(connectionString));

        var serviceProvider = services.BuildServiceProvider();
        var context = serviceProvider.GetRequiredService<PlatformDbContext>();

        try
        {
            var auditLog = new PlatformAuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = Guid.Empty,
                UserId = null,
                UserEmail = "test@test.com",
                Action = "Login_Failure",
                TableName = "Users",
                PrimaryKey = null,
                OldValues = null,
                NewValues = "test",
                Timestamp = DateTime.UtcNow,
                IpAddress = "127.0.0.1",
                Reason = "Test",
                Module = "Authentication"
            };
            context.PlatformAuditLogs.Add(auditLog);
            await context.SaveChangesAsync();
            Console.WriteLine("SUCCESS!");
        }
        catch (Exception ex)
        {
            Console.WriteLine("EXCEPTION: " + ex.Message);
            if (ex.InnerException != null)
            {
                Console.WriteLine("INNER EXCEPTION: " + ex.InnerException.Message);
            }
        }
    }
}

class MockUserContext : ICurrentUserContext
{
    public string UserId => "System";
    public string Email => "System";
    public Guid? TenantId => null;
    public string IpAddress => "127.0.0.1";
    public string UserAgent => "Mock";
    public bool IsAuthenticated => true;
}
