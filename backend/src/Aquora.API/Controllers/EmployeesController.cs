using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.API.Controllers;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Employees;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class EmployeesController : ApiControllerBase
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantDbContext _tenantContext;
        private readonly IPasswordHasher _passwordHasher;

        public EmployeesController(
            IPlatformDbContext platformContext,
            ITenantDbContext tenantContext,
            IPasswordHasher passwordHasher)
        {
            _platformContext = platformContext;
            _tenantContext = tenantContext;
            _passwordHasher = passwordHasher;
        }

        private Guid GetTenantId()
        {
            var claim = User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var tenantId))
            {
                throw new UnauthorizedAccessException("Tenant context is missing or invalid.");
            }
            return tenantId;
        }

        private string GetCurrentUserEmail()
        {
            return User.FindFirst("email")?.Value ?? User.Identity?.Name ?? "System";
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetEmployees()
        {
            try
            {
                var tenantId = GetTenantId();
                var users = await _platformContext.Users
                    .Where(u => u.TenantId == tenantId && !u.IsDeleted)
                    .OrderByDescending(u => u.CreatedAt)
                    .ToListAsync();

                var roles = await _tenantContext.Roles.ToListAsync();
                var userRoles = await _tenantContext.UserRoles.ToListAsync();

                var result = new List<EmployeeDto>();
                foreach (var user in users)
                {
                    var userRoleLink = userRoles.FirstOrDefault(ur => ur.UserId == user.Id);
                    var role = userRoleLink != null ? roles.FirstOrDefault(r => r.Id == userRoleLink.RoleId) : null;

                    result.Add(new EmployeeDto
                    {
                        Id = user.Id,
                        FullName = $"{user.FirstName} {user.LastName}".Trim(),
                        Username = user.Username ?? user.Email,
                        RoleName = role?.Name ?? "Employee",
                        RoleCode = role?.Code ?? "EMPLOYEE",
                        Department = user.Department ?? "Operations",
                        IsActive = user.IsActive,
                        CreatedAt = user.CreatedAt,
                        LastLogin = user.LastLoginAt
                    });
                }

                return Success(result, "Employees loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<EmployeeDto>>(ex.Message, "Failed to load employees.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> CreateEmployee([FromBody] CreateEmployeeRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var usernameNormalized = request.Username.Trim().ToLowerInvariant();

                // Unique username check per tenant
                var usernameExists = await _platformContext.Users
                    .AnyAsync(u => u.TenantId == tenantId && u.Username.ToLower() == usernameNormalized && !u.IsDeleted);

                if (usernameExists)
                {
                    return Failure<EmployeeDto>($"Username '{request.Username}' is already taken inside this tenant.", "Validation Error");
                }

                // Check role existence inside tenant schema
                var role = await _tenantContext.Roles
                    .FirstOrDefaultAsync(r => r.Code.ToUpper() == request.RoleCode.ToUpper() || r.Name.ToLower() == request.RoleCode.ToLower());

                if (role == null)
                {
                    return Failure<EmployeeDto>($"Role Code '{request.RoleCode}' is invalid or does not exist for this tenant.", "Validation Error");
                }

                // Split full name
                var parts = request.FullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                var firstName = parts.Length > 0 ? parts[0] : string.Empty;
                var lastName = parts.Length > 1 ? parts[1] : string.Empty;

                // Password/PIN hashing
                var hash = _passwordHasher.HashPassword(request.PasswordOrPin);

                var newUser = new User
                {
                    Id = Guid.NewGuid(),
                    Username = request.Username.Trim(),
                    Email = $"{usernameNormalized}@aquora-tenant.com", // Unique email mapping
                    FirstName = firstName,
                    LastName = lastName,
                    PasswordHash = hash,
                    PinHash = hash, // Automatic PasswordHash + PinHash update
                    TenantId = tenantId,
                    Department = request.Department ?? "Operations",
                    IsActive = true,
                    EmailVerified = true,
                    TokenVersion = 0
                };

                _platformContext.Users.Add(newUser);

                // UserMembership link in Platform Db
                var membership = new UserMembership
                {
                    Id = Guid.NewGuid(),
                    PlatformUserId = newUser.Id,
                    TenantId = tenantId,
                    RoleId = role.Id,
                    Status = "Active",
                    JoinedAt = DateTime.UtcNow
                };
                _platformContext.UserMemberships.Add(membership);

                // UserRole link in Tenant Db
                var tenantUserRole = new UserRole
                {
                    Id = Guid.NewGuid(),
                    UserId = newUser.Id,
                    RoleId = role.Id,
                    TenantId = tenantId
                };
                _tenantContext.UserRoles.Add(tenantUserRole);

                await _platformContext.SaveChangesAsync();
                await _tenantContext.SaveChangesAsync();

                // Non-blocking Platform Audit Trail logging
                try
                {
                    var auditLog = new PlatformAuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        UserId = newUser.Id.ToString(),
                        UserEmail = GetCurrentUserEmail(),
                        Action = "Insert",
                        TableName = "Users",
                        PrimaryKey = newUser.Id.ToString(),
                        OldValues = "{}",
                        NewValues = System.Text.Json.JsonSerializer.Serialize(new {
                            newUser.Id,
                            newUser.Username,
                            newUser.Email,
                            newUser.FirstName,
                            newUser.LastName,
                            newUser.Department,
                            RoleName = role.Name,
                            RoleCode = role.Code
                        }),
                        Timestamp = DateTime.UtcNow,
                        IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                        Reason = "Employee creation",
                        Module = "User Management"
                    };
                    _platformContext.PlatformAuditLogs.Add(auditLog);
                    await _platformContext.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee creation platform audit: {ex.Message}");
                }

                var dto = new EmployeeDto
                {
                    Id = newUser.Id,
                    FullName = request.FullName.Trim(),
                    Username = newUser.Username,
                    RoleName = role.Name,
                    RoleCode = role.Code,
                    Department = newUser.Department,
                    IsActive = newUser.IsActive,
                    CreatedAt = newUser.CreatedAt,
                    LastLogin = null
                };

                return Success(dto, "Employee created successfully.");
            }
            catch (Exception ex)
            {
                return Failure<EmployeeDto>(ex.Message, "Failed to create employee.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> UpdateEmployee(Guid id, [FromBody] UpdateEmployeeRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var user = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId && !u.IsDeleted);

                if (user == null)
                {
                    return NotFound(ApiResponse<EmployeeDto>.CreateFailure("Employee not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // Check role
                var role = await _tenantContext.Roles
                    .FirstOrDefaultAsync(r => r.Code.ToUpper() == request.RoleCode.ToUpper() || r.Name.ToLower() == request.RoleCode.ToLower());

                if (role == null)
                {
                    return Failure<EmployeeDto>($"Role Code '{request.RoleCode}' is invalid.", "Validation Error");
                }

                // Capture old values before mutation
                var oldValuesJson = System.Text.Json.JsonSerializer.Serialize(new {
                    user.FirstName,
                    user.LastName,
                    user.Department,
                    user.IsActive
                });

                // Update details
                var parts = request.FullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                user.FirstName = parts.Length > 0 ? parts[0] : string.Empty;
                user.LastName = parts.Length > 1 ? parts[1] : string.Empty;
                user.Department = request.Department ?? "Operations";
                user.IsActive = request.IsActive;

                // Update Role link in Platform DB
                var membership = await _platformContext.UserMemberships
                    .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id && m.TenantId == tenantId);
                if (membership != null)
                {
                    membership.RoleId = role.Id;
                    membership.Status = user.IsActive ? "Active" : "Inactive";
                }

                // Update Role link in Tenant DB
                var tenantUserRole = await _tenantContext.UserRoles
                    .FirstOrDefaultAsync(ur => ur.UserId == user.Id && ur.TenantId == tenantId);
                if (tenantUserRole != null)
                {
                    tenantUserRole.RoleId = role.Id;
                }
                else
                {
                    _tenantContext.UserRoles.Add(new UserRole
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        RoleId = role.Id,
                        TenantId = tenantId
                    });
                }

                await _platformContext.SaveChangesAsync();
                await _tenantContext.SaveChangesAsync();

                // Non-blocking Platform Audit Trail logging
                try
                {
                    var auditLog = new PlatformAuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        UserId = user.Id.ToString(),
                        UserEmail = GetCurrentUserEmail(),
                        Action = "Update",
                        TableName = "Users",
                        PrimaryKey = user.Id.ToString(),
                        OldValues = oldValuesJson,
                        NewValues = System.Text.Json.JsonSerializer.Serialize(new {
                            FirstName = user.FirstName,
                            LastName = user.LastName,
                            Department = user.Department,
                            IsActive = user.IsActive,
                            RoleName = role.Name,
                            RoleCode = role.Code
                        }),
                        Timestamp = DateTime.UtcNow,
                        IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                        Reason = "Employee profile update",
                        Module = "User Management"
                    };
                    _platformContext.PlatformAuditLogs.Add(auditLog);
                    await _platformContext.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee update platform audit: {ex.Message}");
                }

                var dto = new EmployeeDto
                {
                    Id = user.Id,
                    FullName = $"{user.FirstName} {user.LastName}".Trim(),
                    Username = user.Username ?? user.Email,
                    RoleName = role.Name,
                    RoleCode = role.Code,
                    Department = user.Department,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt,
                    LastLogin = user.LastLoginAt
                };

                return Success(dto, "Employee updated successfully.");
            }
            catch (Exception ex)
            {
                return Failure<EmployeeDto>(ex.Message, "Failed to update employee.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteEmployee(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var user = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId && !u.IsDeleted);

                if (user == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Employee not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var oldValuesJson = System.Text.Json.JsonSerializer.Serialize(new {
                    user.Id,
                    user.Username,
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.Department,
                    user.IsActive
                });

                user.IsDeleted = true;
                user.DeletedAt = DateTime.UtcNow;
                user.DeletedBy = GetCurrentUserEmail();

                // Remove memberships and role links
                var memberships = await _platformContext.UserMemberships
                    .Where(m => m.PlatformUserId == user.Id && m.TenantId == tenantId)
                    .ToListAsync();
                _platformContext.UserMemberships.RemoveRange(memberships);

                var tenantUserRoles = await _tenantContext.UserRoles
                    .Where(ur => ur.UserId == user.Id && ur.TenantId == tenantId)
                    .ToListAsync();
                _tenantContext.UserRoles.RemoveRange(tenantUserRoles);

                await _platformContext.SaveChangesAsync();
                await _tenantContext.SaveChangesAsync();

                // Non-blocking Platform Audit Trail logging
                try
                {
                    var auditLog = new PlatformAuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        UserId = user.Id.ToString(),
                        UserEmail = GetCurrentUserEmail(),
                        Action = "Delete",
                        TableName = "Users",
                        PrimaryKey = user.Id.ToString(),
                        OldValues = oldValuesJson,
                        NewValues = "{}",
                        Timestamp = DateTime.UtcNow,
                        IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                        Reason = "Employee deletion",
                        Module = "User Management"
                    };
                    _platformContext.PlatformAuditLogs.Add(auditLog);
                    await _platformContext.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee deletion platform audit: {ex.Message}");
                }

                return Success(true, "Employee soft-deleted successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to delete employee.");
            }
        }

        [HttpPut("reset-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetPassword([FromBody] ResetEmployeePasswordRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var user = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.TenantId == tenantId && !u.IsDeleted);

                if (user == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Employee not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // Capture old hashes before mutation
                var oldValuesJson = System.Text.Json.JsonSerializer.Serialize(new {
                    user.PasswordHash,
                    user.PinHash
                });

                // Automatic PasswordHash + PinHash update
                var hash = _passwordHasher.HashPassword(request.PasswordOrPin);
                user.PasswordHash = hash;
                user.PinHash = hash;

                await _platformContext.SaveChangesAsync();

                // Non-blocking Platform Audit Trail logging
                try
                {
                    var auditLog = new PlatformAuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        UserId = user.Id.ToString(),
                        UserEmail = GetCurrentUserEmail(),
                        Action = "Update",
                        TableName = "Users",
                        PrimaryKey = user.Id.ToString(),
                        OldValues = oldValuesJson,
                        NewValues = System.Text.Json.JsonSerializer.Serialize(new {
                            PasswordHash = hash,
                            PinHash = hash
                        }),
                        Timestamp = DateTime.UtcNow,
                        IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                        Reason = "Password/PIN reset",
                        Module = "User Management"
                    };
                    _platformContext.PlatformAuditLogs.Add(auditLog);
                    await _platformContext.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee reset password platform audit: {ex.Message}");
                }

                return Success(true, "Password and PIN reset successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to reset password.");
            }
        }

        [HttpGet("roles")]
        public async Task<ActionResult<ApiResponse<List<Role>>>> GetRoles()
        {
            try
            {
                var roles = await _tenantContext.Roles
                    .OrderBy(r => r.Name)
                    .ToListAsync();
                return Success(roles, "Roles loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<Role>>(ex.Message, "Failed to load roles.");
            }
        }

        [HttpGet("departments")]
        public async Task<ActionResult<ApiResponse<List<string>>>> GetDepartments()
        {
            try
            {
                var dbDepartments = new List<string>
                {
                    "Operations",
                    "Production",
                    "HR",
                    "Sales"
                };

                return Success(dbDepartments, "Departments loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<string>>(ex.Message, "Failed to load departments.");
            }
        }
    }
}
