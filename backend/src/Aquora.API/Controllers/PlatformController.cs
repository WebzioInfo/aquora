using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class PlatformController : ApiControllerBase
    {
        private readonly IPlatformDbContext _platformContext;

        public PlatformController(IPlatformDbContext platformContext)
        {
            _platformContext = platformContext;
        }

        [HttpGet("users")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetPlatformUsers()
        {
            try
            {
                var userRoles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).ToList();
                var isPlatformAdmin = userRoles.Contains("PlatformAdmin") || userRoles.Contains("SuperAdmin");

                if (!isPlatformAdmin)
                {
                    return StatusCode(403, Failure<List<object>>("Access denied. Platform Admin privileges required.", "Forbidden"));
                }

                var users = await _platformContext.Users
                    .Where(u => !u.IsDeleted)
                    .OrderBy(u => u.Email)
                    .Select(u => new
                    {
                        id = u.Id,
                        name = $"{u.FirstName} {u.LastName}".Trim(),
                        email = u.Email,
                        privileges = u.IsPlatformAdmin ? "SuperAdmin" : "Standard",
                        status = u.IsActive ? "Active" : "Inactive"
                    })
                    .ToListAsync();

                // Detailed logging
                Serilog.Log.Information("[PLATFORM AUDIT] Loaded {Count} platform users.", users.Count);

                return Success<List<object>>(users.Cast<object>().ToList(), "Platform users loaded successfully.");
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "[PLATFORM AUDIT] Failed to load platform users.");
                return Failure<List<object>>(ex.Message, "Failed to load platform users.");
            }
        }

        [HttpGet("tenants")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetPlatformTenants()
        {
            try
            {
                var userRoles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).ToList();
                var isPlatformAdmin = userRoles.Contains("PlatformAdmin") || userRoles.Contains("SuperAdmin");

                if (!isPlatformAdmin)
                {
                    return StatusCode(403, Failure<List<object>>("Access denied. Platform Admin privileges required.", "Forbidden"));
                }

                var tenants = await _platformContext.Tenants
                    .Where(t => !t.IsDeleted)
                    .OrderBy(t => t.Name)
                    .Select(t => new
                    {
                        id = t.Id,
                        name = t.Name,
                        schema = t.SchemaName,
                        subdomain = t.Subdomain,
                        status = t.IsActive ? "Active" : "Inactive"
                    })
                    .ToListAsync();

                // Detailed logging
                Serilog.Log.Information("[PLATFORM AUDIT] Loaded {Count} platform tenants.", tenants.Count);

                return Success<List<object>>(tenants.Cast<object>().ToList(), "Tenants loaded successfully.");
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "[PLATFORM AUDIT] Failed to load platform tenants.");
                return Failure<List<object>>(ex.Message, "Failed to load tenants.");
            }
        }
    }
}
