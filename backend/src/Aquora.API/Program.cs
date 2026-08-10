using System;
using System.Threading;
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
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Production-grade .env & Environment Variable Loader
LoadEnvironmentVariables(builder);
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
builder.Services.AddScoped<Aquora.Application.Interfaces.Services.IOperationsIssueNotificationService, Aquora.API.Services.OperationsIssueNotificationService>();

// Configure Reverse Proxy Forwarded Headers (X-Forwarded-For & X-Forwarded-Proto)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Permission Authorization Core
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

    // Rate Limiting
    builder.Services.AddRateLimiter(options =>
    {
        options.GlobalLimiter = System.Threading.RateLimiting.PartitionedRateLimiter.Create<Microsoft.AspNetCore.Http.HttpContext, string>(httpContext =>
            System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.User.Identity?.Name ?? httpContext.Request.Headers.Host.ToString(),
                factory: partition => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
                {
                    AutoReplenishment = true,
                    PermitLimit = 100,
                    QueueLimit = 0,
                    Window = TimeSpan.FromMinutes(1)
                }));
    });

    // Configure Forwarded Headers for Reverse Proxy (Nginx / Cloudflare / Docker)
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
    });

    // Controllers, SignalR and CORS
    builder.Services.AddControllers()
        .ConfigureApiBehaviorOptions(options =>
        {
            options.InvalidModelStateResponseFactory = context =>
            {
                var errors = new List<object>();
                foreach (var state in context.ModelState)
                {
                    foreach (var error in state.Value.Errors)
                    {
                        errors.Add(error.ErrorMessage);
                    }
                }
                var response = Aquora.Shared.Models.ApiResponse<object>.CreateFailure(errors, "Validation failed.", context.HttpContext.TraceIdentifier);
                response.Code = "VALIDATION_ERROR";
                return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(response);
            };
        });
builder.Services.AddSignalR();
builder.Services.AddHealthChecks();
builder.Services.AddTransient<Aquora.Application.Interfaces.Services.IProvisioningProgressReporter, Aquora.API.Services.ProvisioningProgressReporter>();
builder.Services.AddTransient<Aquora.Persistence.Services.DatabaseSchemaValidator>();
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
    options.AddPolicy("CorsPolicy", policy =>
    {
        var origins = new List<string>
        {
            // Production Frontend Origins
            "https://aquora-webzio.vercel.app",
            "https://aquora-backend.webziointernational.in",
            "https://aquora.webziointernational.in",
            "https://app.aquora.com",
            
            // Local Development Origins
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:3000"
        };

        // 1. Read from Env / AppSettings direct keys
        var frontendUrl = builder.Configuration["FRONTEND_URL"];
        if (!string.IsNullOrEmpty(frontendUrl))
            origins.Add(frontendUrl);

        var allowedOrigins = builder.Configuration["ALLOWED_ORIGINS"];
        if (!string.IsNullOrEmpty(allowedOrigins))
            origins.AddRange(allowedOrigins.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries).Select(o => o.Trim()));

        // 2. Read from "Cors:AllowedOrigins" array/section
        var corsSection = builder.Configuration.GetSection("Cors:AllowedOrigins");
        if (corsSection.Exists())
        {
            var sectionOrigins = corsSection.Get<string[]>();
            if (sectionOrigins != null)
            {
                origins.AddRange(sectionOrigins.Where(o => !string.IsNullOrEmpty(o)).Select(o => o.Trim()));
            }
        }

        // Clean and deduplicate origins (remove trailing slashes to match exact browser origin strings)
        var uniqueOrigins = origins
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim().TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        policy.WithOrigins(uniqueOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .SetPreflightMaxAge(TimeSpan.FromHours(1));
    });
});

var app = builder.Build();

// Microsoft Recommended Middleware Pipeline Order for SaaS APIs behind Reverse Proxies
// 1. Process Reverse Proxy Forwarded Headers (Host, Scheme, Proto)
app.UseForwardedHeaders();

// 2. Routing (MUST be executed before UseCors to evaluate endpoint policies)
app.UseRouting();

// 3. CORS Policy (MUST be placed immediately after UseRouting & before ExceptionHandling/Auth!)
app.UseCors("CorsPolicy");

// 4. Global Exception Middleware (Wrapped inside CORS so error responses retain CORS headers)
app.UseMiddleware<ExceptionHandlingMiddleware>();

// 5. Swagger Documentation
if (app.Environment.IsDevelopment() || true)
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Aquora API SaaS Foundation v1"));
}

// 6. Rate Limiting
app.UseRateLimiter();

// 7. Authentication
app.UseAuthentication();

// 8. Tenant Resolution Middleware (after Authentication to read JWT claims)
app.UseMiddleware<TenantResolutionMiddleware>();

// 9. Authorization
app.UseAuthorization();

// 10. Endpoint Mapping
app.MapControllers();
app.MapHealthChecks("/health");
app.MapHealthChecks("/api/v1/health");
app.MapHub<NotificationHub>("/hub/notifications");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<ProvisioningHub>("/hub/provisioning");
app.MapHub<ProvisioningHub>("/hubs/provisioning");
app.MapHub<DashboardHub>("/hub/dashboard");
app.MapHub<DashboardHub>("/hubs/dashboard");

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

        bool autoMigrate = builder.Configuration.GetValue<bool>("AUTO_MIGRATE_ON_STARTUP");
        bool isMigrateCommand = args.Contains("migrate", StringComparer.OrdinalIgnoreCase);

        Log.Information("--------------------------------------------------");
        Log.Information("STARTUP AUDIT:");
        Log.Information("  1. Database Connectivity: VERIFIED");
        Log.Information("  2. Auto Migration Policy: AUTO_MIGRATE_ON_STARTUP = {AutoMigrate}", autoMigrate);
        Log.Information("  3. CLI Migration Command: {IsMigrateCommand}", isMigrateCommand);
        Log.Information("  4. Background Workers: TenantProvisioningWorker, QueuedHostedService, OtpEmailWorker");
        Log.Information("--------------------------------------------------");

        try
        {
            Log.Information("[DATABASE MIGRATION]: Running database schema sync and migrations...");
            var migrationService = services.GetRequiredService<IMigrationService>();
            await migrationService.MigrateAllAsync();
            Log.Information("[DATABASE MIGRATION]: Migration and schema sync completed successfully.");

            if (isMigrateCommand)
            {
                Log.Information("[DATABASE MIGRATION]: CLI Command 'migrate' completed successfully. Exiting process.");
                return;
            }
        }
        catch (Exception migrationEx)
        {
            Log.Fatal(migrationEx, "[DATABASE MIGRATION ERROR]: A fatal error occurred during database migration execution.");
            throw;
        }

        // --- GOD MODE SCHEMA VALIDATION ---
        Log.Information("--------------------------------------------------");
        Log.Information("PHASE 5: Enforcing strict schema validation...");
        try
        {
            var validator = services.GetRequiredService<Aquora.Persistence.Services.DatabaseSchemaValidator>();
            await validator.ValidateSchemaAsync(platformContext, "public");
            Log.Information("Schema validation passed successfully. No orphans or mismatches detected.");
        }
        catch (Exception schemaEx)
        {
            Log.Fatal(schemaEx, "STARTUP ABORTED: Database Schema Validation Failed.");
            throw; // Fail fast
        }
        Log.Information("--------------------------------------------------");
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

static void LoadEnvironmentVariables(WebApplicationBuilder builder)
{
    var envDict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
    var searchDirs = new List<string>();

    var currentDir = System.IO.Directory.GetCurrentDirectory();
    var baseDir = AppContext.BaseDirectory;

    for (int i = 0; i < 5; i++)
    {
        if (!string.IsNullOrEmpty(currentDir))
        {
            if (!searchDirs.Contains(currentDir)) searchDirs.Add(currentDir);
            var p1 = System.IO.Directory.GetParent(currentDir);
            currentDir = p1?.FullName;
        }

        if (!string.IsNullOrEmpty(baseDir))
        {
            if (!searchDirs.Contains(baseDir)) searchDirs.Add(baseDir);
            var p2 = System.IO.Directory.GetParent(baseDir);
            baseDir = p2?.FullName;
        }
    }


    var envName = builder.Environment.EnvironmentName;
    var candidates = new[] { $".env.{envName}.local", $".env.{envName}", ".env.local", ".env" };
    var foundFiles = new List<string>();

    foreach (var dir in searchDirs)
    {
        foreach (var candidate in candidates)
        {
            var path = System.IO.Path.Combine(dir, candidate);
            if (System.IO.File.Exists(path) && !foundFiles.Contains(path))
            {
                foundFiles.Add(path);
            }
        }
    }

    foreach (var filePath in foundFiles)
    {
        try
        {
            Console.WriteLine($"[ENV LOADER] Loading environment file: '{filePath}'");
            var lines = System.IO.File.ReadAllLines(filePath);
            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#") || line.StartsWith("//")) continue;

                int eqIdx = line.IndexOf('=');
                if (eqIdx <= 0) continue;

                var key = line.Substring(0, eqIdx).Trim();
                var val = line.Substring(eqIdx + 1).Trim();

                // Strip inline comments if not quoted
                if (!val.StartsWith("\"") && !val.StartsWith("'"))
                {
                    int hashIdx = val.IndexOf('#');
                    if (hashIdx >= 0) val = val.Substring(0, hashIdx).Trim();
                }

                // Strip outer quotes
                if ((val.StartsWith("\"") && val.EndsWith("\"")) || (val.StartsWith("'") && val.EndsWith("'")))
                {
                    if (val.Length >= 2)
                    {
                        val = val.Substring(1, val.Length - 2);
                    }
                }

                // Preserve pre-existing process environment variables (host platform overrides)
                if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                {
                    Environment.SetEnvironmentVariable(key, val);
                    envDict[key] = val;
                    builder.Configuration[key] = val;

                    // Support section syntax (JwtSettings__Secret -> JwtSettings:Secret)
                    if (key.Contains("__"))
                    {
                        var normalizedKey = key.Replace("__", ":");
                        envDict[normalizedKey] = val;
                        builder.Configuration[normalizedKey] = val;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ENV LOADER WARN] Error reading env file '{filePath}': {ex.Message}");
        }
    }

    if (envDict.Count > 0)
    {
        builder.Configuration.AddInMemoryCollection(envDict);
    }
    // Process environment variables from host (Railway/Docker) override .env file entries
    builder.Configuration.AddEnvironmentVariables();
}

