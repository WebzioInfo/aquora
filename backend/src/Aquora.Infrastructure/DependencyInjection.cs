using System;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Infrastructure.Services;

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

            // Background tenant provisioning pipeline
            services.AddSingleton<ITenantProvisioningQueue, TenantProvisioningQueue>();
            services.AddHostedService<TenantProvisioningWorker>();

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
            });

            return services;
        }
    }
}
