using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Serilog;
using Aquora.API.Authorization;
using Aquora.API.Middleware;
using Aquora.API.Hubs;
using Aquora.Application;
using Aquora.Application.Interfaces;
using Aquora.Infrastructure;
using Aquora.Persistence;
using Aquora.Persistence.Context;
using Aquora.Domain.Entities;

var builder = WebApplication.CreateBuilder(args);

// Load .env file
var currentDir = System.IO.Directory.GetCurrentDirectory();
string? envPath = null;
for (int i = 0; i < 3; i++)
{
    var testPath = System.IO.Path.Combine(currentDir, ".env");
    if (System.IO.File.Exists(testPath))
    {
        envPath = testPath;
        break;
    }
    var parent = System.IO.Directory.GetParent(currentDir);
    if (parent == null) break;
    currentDir = parent.FullName;
}

Console.WriteLine($"[DEBUG ENV] Looking for .env. Resolved path: '{envPath}'. Exists: {envPath != null}");
if (envPath != null)
{
    foreach (var line in System.IO.File.ReadAllLines(envPath))
    {
        if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#")) continue;
        var parts = line.Split('=', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2)
        {
            var key = parts[0].Trim();
            var val = parts[1].Trim();
            Console.WriteLine($"[DEBUG ENV] Loaded key: '{key}'");
            Environment.SetEnvironmentVariable(key, val);
            builder.Configuration[key] = val;
        }
    }
}
// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .CreateLogger();

builder.Host.UseSerilog();

// Read and validate connection string
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(rawConnectionString))
{
    throw new InvalidOperationException("DefaultConnection connection string is missing from configuration.");
}

var connBuilder = new Npgsql.NpgsqlConnectionStringBuilder(rawConnectionString);

if (string.IsNullOrEmpty(connBuilder.Host)) throw new InvalidOperationException("Database Host is missing in connection string.");
if (string.IsNullOrEmpty(connBuilder.Database)) throw new InvalidOperationException("Database Name is missing in connection string.");
if (string.IsNullOrEmpty(connBuilder.Username)) throw new InvalidOperationException("Database Username is missing in connection string.");
if (string.IsNullOrEmpty(connBuilder.Password)) throw new InvalidOperationException("Database Password is missing in connection string.");

var validatedConnString = connBuilder.ConnectionString;
builder.Configuration["ConnectionStrings:DefaultConnection"] = validatedConnString;

// Determine configuration source
string? configSource = null;
if (builder.Configuration is IConfigurationRoot root)
{
    foreach (var provider in root.Providers)
    {
        if (provider.TryGet("ConnectionStrings:DefaultConnection", out _))
        {
            configSource = provider.ToString();
        }
    }
}
configSource ??= "Unknown";

// Log runtime diagnostics (Phase 3)
var maskedBuilder = new Npgsql.NpgsqlConnectionStringBuilder(validatedConnString);
maskedBuilder.Password = "********";
var maskedConnectionString = maskedBuilder.ConnectionString;

// Check files on disk
var appsettingsExists = System.IO.File.Exists(System.IO.Path.Combine(AppContext.BaseDirectory, "appsettings.json")) || System.IO.File.Exists(System.IO.Path.Combine(builder.Environment.ContentRootPath, "appsettings.json"));
var appsettingsDevExists = System.IO.File.Exists(System.IO.Path.Combine(AppContext.BaseDirectory, "appsettings.Development.json")) || System.IO.File.Exists(System.IO.Path.Combine(builder.Environment.ContentRootPath, "appsettings.Development.json"));

Log.Information("--------------------------------------------------");
Log.Information("PHASE 3: Application Startup Connection Audit Details:");
Log.Information("  Environment: {Environment}", builder.Environment.EnvironmentName);
Log.Information("  Database Host: {Host}", connBuilder.Host);
Log.Information("  Database Name: {Database}", connBuilder.Database);
Log.Information("  Database User: {Username}", connBuilder.Username);
Log.Information("  Provider: Npgsql.EntityFrameworkCore.PostgreSQL");
Log.Information("  Resolved Connection String (Masked): {MaskedConn}", maskedConnectionString);
Log.Information("  Configuration Source: {ConfigSource}", configSource);
Log.Information("  Loaded Appsettings files: appsettings.json ({AppsettingsExists}), appsettings.Development.json ({AppsettingsDevExists})", appsettingsExists, appsettingsDevExists);
Log.Information("  Loaded Environment Variables:");
Log.Information("    ASPNETCORE_ENVIRONMENT: {EnvVar}", Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Not Set");
Log.Information("    DOTNET_ENVIRONMENT: {EnvVar}", Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Not Set");
Log.Information("    DATABASE_URL: {EnvVar}", Environment.GetEnvironmentVariable("DATABASE_URL") != null ? "Set (value masked)" : "Not Set");
Log.Information("    POSTGRES_CONNECTION: {EnvVar}", Environment.GetEnvironmentVariable("POSTGRES_CONNECTION") != null ? "Set (value masked)" : "Not Set");
Log.Information("    SUPABASE_DB: {EnvVar}", Environment.GetEnvironmentVariable("SUPABASE_DB") ?? "Not Set");
Log.Information("    SUPABASE_URL: {EnvVar}", Environment.GetEnvironmentVariable("SUPABASE_URL") ?? "Not Set");
Log.Information("    ConnectionStrings:DefaultConnection: {EnvVar}", builder.Configuration["ConnectionStrings:DefaultConnection"] != null ? "Set (value masked)" : "Not Set");
Log.Information("    ConnectionStrings:TenantConnection: {EnvVar}", builder.Configuration["ConnectionStrings:TenantConnection"] != null ? "Set (value masked)" : "Not Set");
Log.Information("--------------------------------------------------");

// Add Clean Architecture Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddPersistence(builder.Configuration);

// Permission Authorization Core
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

// Controllers, SignalR and CORS
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddTransient<Aquora.Application.Interfaces.Services.IProvisioningProgressReporter, Aquora.API.Services.ProvisioningProgressReporter>();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Aquora API SaaS Foundation", Version = "v1" });
    
    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "JWT Authentication",
        Description = "Enter JWT Bearer token **_only_**",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Id = JwtBearerDefaults.AuthenticationScheme,
            Type = ReferenceType.SecurityScheme
        }
    };
    c.AddSecurityDefinition(securityScheme.Reference.Id, securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { securityScheme, Array.Empty<string>() }
    });
});

builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173", "http://localhost:5174", "http://localhost:3000" };

    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .WithHeaders("Authorization", "Content-Type", "Accept", "X-Tenant-Id", "X-Tenant-Code", "X-Tenant", "X-Requested-With")
              .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure Middleware Pipeline
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment() || true) // Enable Swagger in production container too for demo purposes
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Aquora API SaaS Foundation v1"));
}

app.UseCors("CorsPolicy");

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();

// Tenant resolution placed after Authentication so it can read JWT claims!
app.UseMiddleware<TenantResolutionMiddleware>();

app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hub/notifications");
app.MapHub<ProvisioningHub>("/hub/provisioning");

// Database migration and seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var platformContext = services.GetRequiredService<PlatformDbContext>();
        var passwordHasher = services.GetRequiredService<IPasswordHasher>();

        var connString = platformContext.Database.GetDbConnection().ConnectionString;
        var builderConn = new Npgsql.NpgsqlConnectionStringBuilder(connString);
        Log.Information("Initializing database connection. Host: {Host}, Port: {Port}, Database: {Database}, Provider: {Provider}",
            builderConn.Host, builderConn.Port, builderConn.Database, platformContext.Database.ProviderName);

        Log.Information("Verifying database connectivity (OpenConnectionAsync)...");
        bool canConnect = false;
        try
        {
            await platformContext.Database.OpenConnectionAsync();
            
            using var cmd = platformContext.Database.GetDbConnection().CreateCommand();
            cmd.CommandText = "SELECT current_database(), current_schema(), current_setting('search_path'), version(), inet_server_addr(), inet_server_port();";
            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                Log.Information(@"
--------------------------------------------------
PHASE 4: Active Database Instance Verification:
  Current Database (SQL): {Db}
  Current Schema (SQL): {Schema}
  Search Path (SQL): {SearchPath}
  Postgres Version: {Version}
  Inet Server Address: {ServerAddr}
  Inet Server Port: {ServerPort}
--------------------------------------------------",
                    reader.IsDBNull(0) ? "" : reader.GetString(0),
                    reader.IsDBNull(1) ? "" : reader.GetString(1),
                    reader.IsDBNull(2) ? "" : reader.GetString(2),
                    reader.IsDBNull(3) ? "" : reader.GetString(3),
                    reader.IsDBNull(4) ? "" : reader.GetValue(4)?.ToString(),
                    reader.IsDBNull(5) ? "" : reader.GetInt32(5).ToString());
            }

            canConnect = true;
            await platformContext.Database.CloseConnectionAsync();
        }
        catch (Exception connectEx)
        {
            Log.Error(connectEx, "OpenConnectionAsync threw an exception.");
        }

        if (!canConnect)
        {
            Log.Fatal("Database connectivity check failed. Please check credentials, host reachability, and network/SSL parameters.");
            throw new InvalidOperationException("Database connectivity check failed.");
        }
        Log.Information("Database connectivity verified successfully.");

        try
        {
            Log.Information("Executing Platform Database Migrations (public schema)...");
            await platformContext.Database.MigrateAsync();
            Log.Information("Platform Database Migrations applied successfully.");

            Log.Information("Executing Tenant Database Migrations for active tenants...");
            var tenants = await platformContext.Set<Aquora.Domain.Entities.Tenant>()
                .Where(t => t.IsActive && !t.IsDeleted)
                .ToListAsync();

            Log.Information("--- Platform Database Dump (public schema) ---");
            Log.Information("Total Tenants found: {Count}", tenants.Count);
            foreach (var t in tenants)
            {
                Log.Information("  Tenant: ID={Id}, Name='{Name}', Code='{Code}', Schema='{Schema}', Created={Created}", 
                    t.Id, t.Name, t.Code, t.SchemaName, t.CreatedAt);
            }

            var users = await platformContext.Set<Aquora.Domain.Entities.User>()
                .Where(u => !u.IsDeleted)
                .ToListAsync();
            Log.Information("Total Users found: {Count}", users.Count);
            foreach (var u in users)
            {
                Log.Information("  User: ID={Id}, Name='{Name}', Email='{Email}', TenantId={TenantId}, Created={Created}", 
                    u.Id, $"{u.FirstName} {u.LastName}", u.Email, u.TenantId, u.CreatedAt);
            }
            Log.Information("----------------------------------------------");

            foreach (var tenant in tenants)
            {
                try
                {
                    Log.Information($"Migrating tenant: {tenant.Name} (Schema: {tenant.SchemaName})...");
                    using (var tenantScope = app.Services.CreateScope())
                    {
                        var tenantProvider = tenantScope.ServiceProvider.GetRequiredService<ITenantProvider>();
                        tenantProvider.SetTenantId(tenant.Id);
                        tenantProvider.SetTenantSchemaName(tenant.SchemaName);

                        var tenantContext = tenantScope.ServiceProvider.GetRequiredService<TenantDbContext>();
                        TenantSchemaResolver.CurrentSchemaName = tenant.SchemaName;

                        await tenantContext.Database.MigrateAsync();

                        // Reconcile and migrate historical raw material stock to inventory movements
                        var rawMaterials = await tenantContext.RawMaterials.Where(rm => !rm.IsDeleted).ToListAsync();
                        bool reconciledAny = false;
                        foreach (var rm in rawMaterials)
                        {
                            var movementsSum = await tenantContext.InventoryMovements
                                .Where(m => m.RawMaterialId == rm.Id && !m.IsDeleted)
                                .SumAsync(m => m.Quantity);

                            var diff = rm.CurrentStock - movementsSum;
                            if (diff != 0)
                            {
                                Log.Information($"[RECONCILIATION] RawMaterial '{rm.Name}' (ID: {rm.Id}) stock mismatch in '{tenant.SchemaName}': CurrentStock={rm.CurrentStock}, MovementsSum={movementsSum}. Reconciling diff of {diff}.");
                                
                                var reconciliationMovement = new InventoryMovement
                                {
                                    Id = Guid.NewGuid(),
                                    RawMaterialId = rm.Id,
                                    Quantity = diff,
                                    ReferenceType = "OpeningStock",
                                    ReferenceId = rm.Id,
                                    TenantId = tenant.Id,
                                    CompanyId = rm.CompanyId,
                                    CreatedAt = DateTime.UtcNow,
                                    CreatedBy = "System Migration",
                                    IsDeleted = false
                                };
                                tenantContext.InventoryMovements.Add(reconciliationMovement);
                                reconciledAny = true;
                            }
                        }
                        if (reconciledAny)
                        {
                            await tenantContext.SaveChangesAsync();
                        }
                    }
                    Log.Information($"Tenant {tenant.Name} migrated successfully.");
                }
                catch (Exception tenantEx)
                {
                    Log.Error(tenantEx, $"Failed to migrate tenant schema for: {tenant.Name}");
                }
            } // watch restart trigger
            Log.Information("Tenant Database Migrations completed.");
        }
        catch (Exception migrationEx)
        {
            Log.Error(migrationEx, "A non-fatal error occurred during database migrations at startup. API will proceed to start.");
        }
    }
    catch (System.Net.Sockets.SocketException socketEx)
    {
        Log.Fatal(socketEx, "Database connection failure: Failed to reach the database server. Check your network or firewall rules.");
        throw;
    }
    catch (Npgsql.NpgsqlException npgsqlEx)
    {
        Log.Fatal(npgsqlEx, "PostgreSQL connection error: check your connection string, credentials, and SSL settings.");
        throw;
    }
    catch (Exception ex)
    {
        Log.Fatal(ex, "A fatal error occurred during database migration/seeding.");
        throw;
    }
}

try
{
    Log.Information("Starting Aquora API SaaS Foundation host...");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
