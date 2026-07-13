using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;

namespace Aquora.API.Authorization
{
    public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
    {
        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context, 
            PermissionRequirement requirement)
        {
            if (context.User == null)
            {
                return Task.CompletedTask;
            }

            var permissions = context.User.FindAll("permission").Select(c => c.Value).ToList();
            var hasPermission = permissions.Any(p => p.Equals(requirement.Permission, StringComparison.OrdinalIgnoreCase));
            var userId = context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                         ?? context.User?.FindFirst("sub")?.Value 
                         ?? "Anonymous";

            Console.WriteLine($"[AUTHORIZATION DECISION]: User '{userId}' requesting permission '{requirement.Permission}' - Result: {(hasPermission ? "Granted" : "Denied")}");

            if (hasPermission)
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
