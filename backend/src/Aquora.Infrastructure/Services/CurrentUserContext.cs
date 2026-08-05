using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Aquora.Application.Interfaces;

namespace Aquora.Infrastructure.Services
{
    public class CurrentUserContext : ICurrentUserContext
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserContext(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        private HttpContext? HttpContext => _httpContextAccessor.HttpContext;

        public string? UserId => HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? HttpContext?.User?.FindFirst("sub")?.Value;

        public string? Email => HttpContext?.User?.FindFirst(ClaimTypes.Email)?.Value 
            ?? HttpContext?.User?.FindFirst("email")?.Value;

        public Guid TenantId
        {
            get
            {
                var claim = HttpContext?.User?.FindFirst("tenant_id")?.Value;
                return Guid.TryParse(claim, out var tenantId) ? tenantId : Guid.Empty;
            }
        }

        public IEnumerable<string> Roles => HttpContext?.User?.FindAll(ClaimTypes.Role).Select(c => c.Value) ?? Enumerable.Empty<string>();

        public IEnumerable<string> Permissions => HttpContext?.User?.FindAll("permission").Select(c => c.Value) ?? Enumerable.Empty<string>();

        public string IpAddress
        {
            get
            {
                if (HttpContext?.Request?.Headers != null)
                {
                    if (HttpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) && !string.IsNullOrEmpty(forwardedFor))
                    {
                        return forwardedFor.ToString().Split(',')[0].Trim();
                    }
                    if (HttpContext.Request.Headers.TryGetValue("X-Real-IP", out var realIp) && !string.IsNullOrEmpty(realIp))
                    {
                        return realIp.ToString().Trim();
                    }
                }
                return HttpContext?.Connection?.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            }
        }

        public string UserAgent => HttpContext?.Request?.Headers["User-Agent"].ToString() ?? "Unknown";

        public string? Reason => HttpContext?.Request?.Headers["X-Audit-Reason"].ToString();

        public string Module => HttpContext?.Request?.Headers["X-Audit-Module"].ToString() ?? "Default";

        public bool IsAuthenticated => HttpContext?.User?.Identity?.IsAuthenticated ?? false;

        public bool HasPermission(string permission)
        {
            return Permissions.Contains(permission);
        }
    }
}
