using System;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Infrastructure.Services;
using Aquora.Infrastructure.Configuration;

namespace Aquora.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            // HttpContext Accessor
            services.AddHttpContextAccessor();

            // Core services registration
            services.AddScoped<ITenantProvider, TenantProvider>();
            services.AddScoped<ICurrentUserContext, CurrentUserContext>();
            
            services.AddSingleton<ITokenService, TokenService>();
            services.AddSingleton<IPasswordHasher, PasswordHasher>();
            services.AddSingleton<ICacheService, CacheService>();
            services.AddTransient<Aquora.Application.Interfaces.Services.IEmailService, Aquora.Infrastructure.Services.SmtpEmailService>();

            // Configure SMTP with Startup Validation
            services.AddOptions<SmtpOptions>()
                .Configure(options =>
                {
                    options.Host = configuration["SMTP_HOST"] ?? string.Empty;
                    options.Port = int.TryParse(configuration["SMTP_PORT"], out var port) ? port : 587;
                    options.User = configuration["SMTP_USER"] ?? string.Empty;
                    options.Password = configuration["SMTP_PASSWORD"] ?? configuration["SMTP_PASS"] ?? string.Empty;
                    options.FromName = configuration["SMTP_FROM_NAME"] ?? "Aquora ERP";
                })
                .Validate(options => 
                {
                    return !string.IsNullOrWhiteSpace(options.Host) &&
                           options.Port > 0 &&
                           !string.IsNullOrWhiteSpace(options.User) &&
                           !string.IsNullOrWhiteSpace(options.Password);
                }, "SMTP configuration is incomplete. Host, Port, User, and Password must be provided.")
                .ValidateOnStart();

            // Background tenant provisioning pipeline
            services.AddSingleton<ITenantProvisioningQueue, TenantProvisioningQueue>();
            services.AddHostedService<TenantProvisioningWorker>();

            // Background Task Queue & Workers
            services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
            services.AddHostedService<QueuedHostedService>();
            services.AddHostedService<OtpEmailWorker>();

            // Configure JWT Authentication
            var jwtSettings = configuration.GetSection("JwtSettings");
            var secret = jwtSettings.GetValue<string>("Secret") ?? "AquoraSuperSecretKeyPlaceholderForLocalDev123!";
            
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwtSettings.GetValue<string>("Issuer", "Aquora"),
                    ValidAudience = jwtSettings.GetValue<string>("Audience", "AquoraClients"),
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                    ClockSkew = TimeSpan.Zero // Remove delay of token expiry check
                };

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hub"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

            return services;
        }
    }
}
