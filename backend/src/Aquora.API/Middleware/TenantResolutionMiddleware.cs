using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Persistence.Context;

namespace Aquora.API.Middleware
{
    public class TenantResolutionMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantResolutionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ITenantProvider tenantProvider, PlatformDbContext platformContext)
        {
            if (HttpMethods.IsOptions(context.Request.Method))
            {
                await _next(context);
                return;
            }

            Guid? resolvedTenantId = null;
            string? resolvedSchemaName = null;

            // 1. Resolve by Host Subdomain / Custom Domain
            var host = context.Request.Host.Host;
            var parts = host.Split('.');
            
            // Exclude common base domains
            if (parts.Length > 1 && !host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            {
                var subdomain = parts[0];
                if (!subdomain.Equals("www", StringComparison.OrdinalIgnoreCase) && !subdomain.Equals("aquora", StringComparison.OrdinalIgnoreCase))
                {
                    // Look up by subdomain
                    var tenant = await platformContext.Tenants
                        .FirstOrDefaultAsync(t => t.Subdomain.ToLower() == subdomain.ToLower() && !t.IsDeleted);

                    if (tenant != null)
                    {
                        resolvedTenantId = tenant.Id;
                        resolvedSchemaName = tenant.SchemaName;
                    }
                }
            }

            // 2. Fallback to Custom Domain
            if (resolvedTenantId == null)
            {
                var tenant = await platformContext.Tenants
                    .FirstOrDefaultAsync(t => t.CustomDomain != null && t.CustomDomain.ToLower() == host.ToLower() && !t.IsDeleted);

                if (tenant != null)
                {
                    resolvedTenantId = tenant.Id;
                    resolvedSchemaName = tenant.SchemaName;
                }
            }

            // 3. Fallback to X-Tenant-Id / X-Tenant-Code Headers
            if (resolvedTenantId == null)
            {
                if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeaderStr) && 
                    Guid.TryParse(tenantHeaderStr, out var tenantIdFromHeader))
                {
                    var tenant = await platformContext.Tenants.FindAsync(tenantIdFromHeader);
                    if (tenant != null)
                    {
                        resolvedTenantId = tenant.Id;
                        resolvedSchemaName = tenant.SchemaName;
                    }
                }
                else if (context.Request.Headers.TryGetValue("X-Tenant-Code", out var tenantCodeHeaderStr))
                {
                    var tenant = await platformContext.Tenants
                        .FirstOrDefaultAsync(t => t.Code.ToLower() == tenantCodeHeaderStr.ToString().ToLower());
                    if (tenant != null)
                    {
                        resolvedTenantId = tenant.Id;
                        resolvedSchemaName = tenant.SchemaName;
                    }
                }
            }

            // 4. Fallback to JWT Claims if authenticated
            if (resolvedTenantId == null && context.User.Identity != null && context.User.Identity.IsAuthenticated)
            {
                var tenantClaim = context.User.FindFirst("tenant_id")?.Value;
                if (Guid.TryParse(tenantClaim, out var tenantIdFromClaims))
                {
                    var tenant = await platformContext.Tenants.FindAsync(tenantIdFromClaims);
                    if (tenant != null)
                    {
                        resolvedTenantId = tenant.Id;
                        resolvedSchemaName = tenant.SchemaName;
                    }
                }
            }

            // If resolved, set the tenant context!
            if (resolvedTenantId != null)
            {
                tenantProvider.SetTenantId(resolvedTenantId.Value);
                tenantProvider.SetTenantSchemaName(resolvedSchemaName ?? "public");
                context.Response.Headers.Append("X-Resolved-Tenant-Schema", resolvedSchemaName ?? "public");
                Console.WriteLine($"[TENANT RESOLVED] Tenant ID: {resolvedTenantId.Value}, Schema: {resolvedSchemaName}, Host: {host}");
            }

            await _next(context);
        }
    }
}
