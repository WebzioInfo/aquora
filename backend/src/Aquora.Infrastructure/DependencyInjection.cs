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
            services.AddScoped<IDateTimeProvider, DateTimeProvider>();
            
            services.AddSingleton<ITokenService, TokenService>();
            services.AddSingleton<IPasswordHasher, PasswordHasher>();
            services.AddSingleton<ICacheService, CacheService>();
            string GetEnvOrConfig(params string[] keys)
            {
                foreach (var key in keys)
                {
                    if (string.IsNullOrEmpty(key)) continue;
                    var envVal = Environment.GetEnvironmentVariable(key);
                    if (!string.IsNullOrWhiteSpace(envVal)) return envVal.Trim();

                    var val = configuration[key];
                    if (!string.IsNullOrWhiteSpace(val)) return val.Trim();
                }
                return string.Empty;
            }

            var providerConfig = GetEnvOrConfig("EMAIL_PROVIDER", "Email:Provider", "MAIL_PROVIDER");
            var resendApiKey = GetEnvOrConfig("RESEND_API_KEY", "Resend:ApiKey");

            string selectedProvider;
            if (!string.IsNullOrWhiteSpace(providerConfig))
            {
                selectedProvider = providerConfig.Equals("SMTP", StringComparison.OrdinalIgnoreCase) ? "SMTP" : "Resend";
            }
            else if (!string.IsNullOrWhiteSpace(resendApiKey))
            {
                selectedProvider = "Resend";
            }
            else
            {
                selectedProvider = "SMTP"; // Local development default fallback
            }

            // Register IHttpClientFactory for Resend email client with 12s timeout
            services.AddHttpClient("ResendClient", client =>
            {
                client.Timeout = TimeSpan.FromSeconds(12);
            });

            if (selectedProvider == "Resend")
            {
                services.Configure<Aquora.Infrastructure.Configuration.ResendOptions>(options =>
                {
                    options.ApiKey = GetEnvOrConfig("RESEND_API_KEY", "Resend:ApiKey");
                    options.FromEmail = GetEnvOrConfig("EMAIL_FROM_EMAIL", "RESEND_FROM_EMAIL", "Resend:FromEmail");
                    options.FromName = GetEnvOrConfig("EMAIL_FROM_NAME", "RESEND_FROM_NAME", "Resend:FromName");
                    if (string.IsNullOrWhiteSpace(options.FromName)) options.FromName = "Aquora";
                });
                services.AddTransient<Aquora.Application.Interfaces.Services.IEmailService, Aquora.Infrastructure.Services.ResendEmailService>();
            }
            else
            {
                services.Configure<SmtpOptions>(options =>
                {
                    options.Host = GetEnvOrConfig("SMTP_HOST", "Smtp:Host", "MAIL_HOST", "MAIL_SERVER");
                    options.Port = int.TryParse(GetEnvOrConfig("SMTP_PORT", "Smtp:Port", "MAIL_PORT"), out var port) ? port : 587;
                    options.Username = GetEnvOrConfig("SMTP_USERNAME", "SMTP_USER", "Smtp:Username", "Smtp:User", "MAIL_USERNAME", "MAIL_USER");
                    options.Password = GetEnvOrConfig("SMTP_PASSWORD", "SMTP_PASS", "Smtp:Password", "MAIL_PASSWORD", "MAIL_PASS");
                    options.FromName = GetEnvOrConfig("SMTP_FROM_NAME", "Smtp:FromName", "MAIL_FROM_NAME");
                    if (string.IsNullOrWhiteSpace(options.FromName)) options.FromName = "Aquora";
                    options.FromEmail = GetEnvOrConfig("SMTP_FROM_EMAIL", "SMTP_FROM", "Smtp:FromEmail", "MAIL_FROM");

                    var sslVal = GetEnvOrConfig("SMTP_ENABLE_SSL", "SMTP_SECURE", "SMTP_SSL", "SMTP_USE_SSL", "Smtp:EnableSsl", "Smtp:UseSsl", "MAIL_ENCRYPTION");
                    if (bool.TryParse(sslVal, out var enableSslBool))
                    {
                        options.EnableSsl = enableSslBool;
                    }
                    else if (sslVal.Equals("ssl", StringComparison.OrdinalIgnoreCase) || sslVal.Equals("true", StringComparison.OrdinalIgnoreCase) || options.Port == 465)
                    {
                        options.EnableSsl = true;
                    }
                    else if (!string.IsNullOrWhiteSpace(sslVal) && (sslVal.Equals("false", StringComparison.OrdinalIgnoreCase) || sslVal.Equals("0", StringComparison.OrdinalIgnoreCase)))
                    {
                        options.EnableSsl = false;
                    }
                    else
                    {
                        options.EnableSsl = true;
                    }
                });
                services.AddTransient<Aquora.Application.Interfaces.Services.IEmailService, Aquora.Infrastructure.Services.SmtpEmailService>();
            }


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
                        if (!string.IsNullOrEmpty(accessToken) && 
                            (path.StartsWithSegments("/hub") || path.StartsWithSegments("/hubs") || path.Value?.Contains("provisioning") == true))
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
