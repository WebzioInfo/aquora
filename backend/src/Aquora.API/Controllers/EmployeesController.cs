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
        private readonly ITenantProvider _tenantProvider;

        public EmployeesController(
            IPlatformDbContext platformContext,
            ITenantDbContext tenantContext,
            IPasswordHasher passwordHasher,
            ITenantProvider tenantProvider)
        {
            _platformContext = platformContext;
            _tenantContext = tenantContext;
            _passwordHasher = passwordHasher;
            _tenantProvider = tenantProvider;
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
            catch (Exception)
            {
                return Failure<List<EmployeeDto>>("An internal error occurred.", "Failed to load employees.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> CreateEmployee([FromBody] CreateEmployeeRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var usernameNormalized = request.Username.Trim().ToLowerInvariant();
                var emailNormalized = request.Email.Trim().ToLowerInvariant();

                // Unique username check globally across all tenants
                var usernameExists = await _platformContext.Users
                    .AnyAsync(u => u.Username.ToLower() == usernameNormalized && !u.IsDeleted);

                if (usernameExists)
                {
                    return Failure<EmployeeDto>("Username is already taken. Please choose another username.", "Validation Error");
                }

                // Globally unique email mapping check
                var emailExists = await _platformContext.Users
                    .AnyAsync(u => u.Email.ToLower() == emailNormalized && !u.IsDeleted);

                if (emailExists)
                {
                    return Failure<EmployeeDto>("Email is already registered.", "Validation Error");
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
                    Email = emailNormalized,
                    FirstName = firstName,
                    LastName = lastName,
                    PasswordHash = hash,
                    PinHash = hash,
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

                // Wrap in a transaction scope to ensure atomicity across both DbContexts
                using (var scope = new System.Transactions.TransactionScope(
                    System.Transactions.TransactionScopeOption.Required,
                    new System.Transactions.TransactionOptions { IsolationLevel = System.Transactions.IsolationLevel.ReadCommitted },
                    System.Transactions.TransactionScopeAsyncFlowOption.Enabled))
                {
                    await _platformContext.SaveChangesAsync();
                    await _tenantContext.SaveChangesAsync();
                    scope.Complete();
                }

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
                catch (Exception)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee creation platform audit: {"An internal error occurred."}");
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
            catch (DbUpdateException dbEx)
            {
                var details = new System.Text.StringBuilder();
                details.AppendLine($"Database Save Failure: {dbEx.Message}");
                if (dbEx.InnerException is Npgsql.PostgresException pgEx)
                {
                    details.AppendLine($"Postgres Error Code (SqlState): {pgEx.SqlState}");
                    details.AppendLine($"Constraint Name: {pgEx.ConstraintName}");
                    details.AppendLine($"Column Name: {pgEx.ColumnName}");
                    details.AppendLine($"Table Name: {pgEx.TableName}");
                    details.AppendLine($"Error Message: {pgEx.MessageText}");
                    details.AppendLine($"Detail: {pgEx.Detail}");
                }
                var fullError = details.ToString();
                Console.WriteLine($"[CREATE EMPLOYEE DATABASE ERROR]:\n{fullError}");
                return Failure<EmployeeDto>(fullError, "Failed to save database changes during employee creation.");
            }
            catch (Exception ex)
            {
                var fullError = "An internal error occurred.";
                if (ex.InnerException != null)
                {
                    fullError += $"\nInner Exception: {ex.InnerException.ToString()}";
                }
                Console.WriteLine($"[CREATE EMPLOYEE EXCEPTION]:\n{fullError}");
                return Failure<EmployeeDto>(fullError, "Failed to create employee.");
            }
        }

        [HttpPut("{id:guid}")]
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
                catch (Exception)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee update platform audit: {"An internal error occurred."}");
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
            catch (Exception)
            {
                return Failure<EmployeeDto>("An internal error occurred.", "Failed to update employee.");
            }
        }

        [HttpDelete("{id:guid}")]
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
                catch (Exception)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee deletion platform audit: {"An internal error occurred."}");
                }

                return Success(true, "Employee soft-deleted successfully.");
            }
            catch (Exception)
            {
                return Failure<bool>("An internal error occurred.", "Failed to delete employee.");
            }
        }

        [HttpPut("reset-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetPassword([FromBody] ResetEmployeePasswordRequest request)
        {
            try
            {
                var roles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value.ToUpperInvariant()).ToList();
                if (!roles.Contains("COMPANYADMIN"))
                {
                    return StatusCode(403, ApiResponse<bool>.CreateFailure("Only Company Admin can reset employee password.", "Forbidden", HttpContext.TraceIdentifier));
                }

                var tenantId = GetTenantId();

                if (!VerifySecurityPin(tenantId, request.Pin))
                {
                    await LogSecurityAuditAsync(tenantId, "InvalidPin", request.EmployeeId.ToString(), "Invalid Company Secret PIN attempt during password reset.");
                    return BadRequest(ApiResponse<bool>.CreateFailure("Invalid Company Secret PIN.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var user = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.TenantId == tenantId && !u.IsDeleted);

                if (user == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Employee not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var oldValuesJson = System.Text.Json.JsonSerializer.Serialize(new {
                    user.PasswordHash,
                    user.PinHash
                });

                var hash = _passwordHasher.HashPassword(request.PasswordOrPin);
                user.PasswordHash = hash;
                user.PinHash = hash;

                var encryptedPassword = EncryptPassword(request.PasswordOrPin);
                var secrets = GetEmployeeSecrets(tenantId);
                secrets[user.Id] = encryptedPassword;
                SaveEmployeeSecrets(tenantId, secrets);

                await _platformContext.SaveChangesAsync();

                await LogSecurityAuditAsync(tenantId, "UpdatePassword", user.Id.ToString(), $"Updated employee password for: {user.Username ?? user.Email}");

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
                catch (Exception)
                {
                    Console.WriteLine($"[AUDIT LOG FAILURE - NON-BLOCKING]: Failed to write employee reset password platform audit: {"An internal error occurred."}");
                }

                return Success(true, "Password and PIN reset successfully.");
            }
            catch (Exception)
            {
                return Failure<bool>("An internal error occurred.", "Failed to reset password.");
            }
        }

        [HttpPost("security-pin")]
        public async Task<ActionResult<ApiResponse<bool>>> SaveSecurityPin([FromBody] SecuritySettingsRequest request)
        {
            try
            {
                var roles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value.ToUpperInvariant()).ToList();
                if (!roles.Contains("COMPANYADMIN"))
                {
                    return StatusCode(403, ApiResponse<bool>.CreateFailure("Only Company Admin can set the security PIN.", "Forbidden", HttpContext.TraceIdentifier));
                }

                if (request.Pin != request.ConfirmPin)
                {
                    return BadRequest(ApiResponse<bool>.CreateFailure("PIN and Confirm PIN do not match.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var tenantId = GetTenantId();
                var pinHash = _passwordHasher.HashPassword(request.Pin);
                SaveSecurityPinHash(tenantId, pinHash);

                return Success(true, "Security PIN updated successfully.");
            }
            catch (Exception)
            {
                return Failure<bool>("An internal error occurred.", "Failed to save security PIN.");
            }
        }

        [HttpGet("security-pin/status")]
        public ActionResult<ApiResponse<object>> GetSecurityPinStatus()
        {
            try
            {
                var tenantId = GetTenantId();
                var hash = GetSecurityPinHash(tenantId);
                return Success<object>(new { isPinSet = !string.IsNullOrEmpty(hash) }, "PIN status loaded successfully.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to load PIN status.");
            }
        }

        [HttpPost("security-pin/verify")]
        public async Task<ActionResult<ApiResponse<bool>>> VerifyPin([FromBody] VerifyPinRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var isValid = VerifySecurityPin(tenantId, request.Pin);
                if (!isValid)
                {
                    await LogSecurityAuditAsync(tenantId, "InvalidPin", null, "Invalid Company Secret PIN verification attempt.");
                }
                return Success(isValid, "PIN verification checked.");
            }
            catch (Exception)
            {
                return Failure<bool>("An internal error occurred.", "PIN verification failed.");
            }
        }

        [HttpPost("reveal-password")]
        public async Task<ActionResult<ApiResponse<string>>> RevealPassword([FromBody] RevealPasswordRequest request)
        {
            try
            {
                var roles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value.ToUpperInvariant()).ToList();
                if (!roles.Contains("COMPANYADMIN"))
                {
                    return StatusCode(403, ApiResponse<string>.CreateFailure("Only Company Admin can view employee passwords.", "Forbidden", HttpContext.TraceIdentifier));
                }

                var tenantId = GetTenantId();

                if (!VerifySecurityPin(tenantId, request.Pin))
                {
                    await LogSecurityAuditAsync(tenantId, "InvalidPin", request.EmployeeId.ToString(), "Invalid Company Secret PIN attempt during password view.");
                    return BadRequest(ApiResponse<string>.CreateFailure("Invalid Company Secret PIN.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var secrets = GetEmployeeSecrets(tenantId);
                if (!secrets.TryGetValue(request.EmployeeId, out var encryptedPassword))
                {
                    return NotFound(ApiResponse<string>.CreateFailure("Encrypted password not found for this employee.", "Not Found", HttpContext.TraceIdentifier));
                }

                var decrypted = DecryptPassword(encryptedPassword);

                await LogSecurityAuditAsync(tenantId, "ViewPassword", request.EmployeeId.ToString(), "Viewed employee password.");

                return Success(decrypted, "Password decrypted successfully.");
            }
            catch (Exception)
            {
                return Failure<string>("An internal error occurred.", "Failed to reveal password.");
            }
        }

        private string GetSecurityPinFilePath(Guid tenantId)
        {
            var dir = System.IO.Path.Combine(AppContext.BaseDirectory, "settings");
            if (!System.IO.Directory.Exists(dir))
            {
                System.IO.Directory.CreateDirectory(dir);
            }
            return System.IO.Path.Combine(dir, $"security-settings-{tenantId}.json");
        }

        private string GetEmployeeSecretsFilePath(Guid tenantId)
        {
            var dir = System.IO.Path.Combine(AppContext.BaseDirectory, "settings");
            if (!System.IO.Directory.Exists(dir))
            {
                System.IO.Directory.CreateDirectory(dir);
            }
            return System.IO.Path.Combine(dir, $"employee-secrets-{tenantId}.json");
        }

        private string? GetSecurityPinHash(Guid tenantId)
        {
            var path = GetSecurityPinFilePath(tenantId);
            if (!System.IO.File.Exists(path)) return null;
            try
            {
                var json = System.IO.File.ReadAllText(path);
                var dict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                return dict != null && dict.TryGetValue("SecretPinHash", out var hash) ? hash : null;
            }
            catch
            {
                return null;
            }
        }

        private bool VerifySecurityPin(Guid tenantId, string pin)
        {
            var hash = GetSecurityPinHash(tenantId);
            if (string.IsNullOrEmpty(hash)) return false;
            return _passwordHasher.VerifyPassword(pin, hash);
        }

        private void SaveSecurityPinHash(Guid tenantId, string pinHash)
        {
            var path = GetSecurityPinFilePath(tenantId);
            var dict = new Dictionary<string, string> { { "SecretPinHash", pinHash } };
            var json = System.Text.Json.JsonSerializer.Serialize(dict);
            System.IO.File.WriteAllText(path, json);
        }

        private static readonly byte[] AesKey = System.Text.Encoding.UTF8.GetBytes("AquoraSuperSecretKeyPlaceholder123").Take(32).ToArray();
        private static readonly byte[] AesIv = System.Text.Encoding.UTF8.GetBytes("AquoraIVPlh12345").Take(16).ToArray();

        private string EncryptPassword(string plainText)
        {
            using var aes = System.Security.Cryptography.Aes.Create();
            aes.Key = AesKey;
            aes.IV = AesIv;
            using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
            using var ms = new System.IO.MemoryStream();
            using (var cs = new System.Security.Cryptography.CryptoStream(ms, encryptor, System.Security.Cryptography.CryptoStreamMode.Write))
            using (var sw = new System.IO.StreamWriter(cs))
            {
                sw.Write(plainText);
            }
            return Convert.ToBase64String(ms.ToArray());
        }

        private string DecryptPassword(string cipherText)
        {
            using var aes = System.Security.Cryptography.Aes.Create();
            aes.Key = AesKey;
            aes.IV = AesIv;
            using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
            using var ms = new System.IO.MemoryStream(Convert.FromBase64String(cipherText));
            using var cs = new System.Security.Cryptography.CryptoStream(ms, decryptor, System.Security.Cryptography.CryptoStreamMode.Read);
            using var sr = new System.IO.StreamReader(cs);
            return sr.ReadToEnd();
        }

        private Dictionary<Guid, string> GetEmployeeSecrets(Guid tenantId)
        {
            var path = GetEmployeeSecretsFilePath(tenantId);
            if (!System.IO.File.Exists(path)) return new Dictionary<Guid, string>();
            try
            {
                var json = System.IO.File.ReadAllText(path);
                return System.Text.Json.JsonSerializer.Deserialize<Dictionary<Guid, string>>(json) ?? new Dictionary<Guid, string>();
            }
            catch
            {
                return new Dictionary<Guid, string>();
            }
        }

        private void SaveEmployeeSecrets(Guid tenantId, Dictionary<Guid, string> secrets)
        {
            var path = GetEmployeeSecretsFilePath(tenantId);
            var json = System.Text.Json.JsonSerializer.Serialize(secrets);
            System.IO.File.WriteAllText(path, json);
        }

        private async Task LogSecurityAuditAsync(Guid tenantId, string action, string? employeeId, string reason)
        {
            try
            {
                var adminUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value ?? "System";
                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = adminUserId,
                    UserEmail = GetCurrentUserEmail(),
                    Action = action,
                    TableName = "Users",
                    PrimaryKey = employeeId ?? "None",
                    OldValues = "{}",
                    NewValues = System.Text.Json.JsonSerializer.Serialize(new { Reason = reason }),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Device = Request.Headers["User-Agent"].ToString() ?? "Unknown",
                    Reason = reason,
                    Module = "Security"
                };

                _tenantContext.AuditLogs.Add(auditLog);
                await _tenantContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                Console.WriteLine($"[SECURITY AUDIT LOG FAILURE - NON-BLOCKING]: {"An internal error occurred."}");
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
            catch (Exception)
            {
                return Failure<List<Role>>("An internal error occurred.", "Failed to load roles.");
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
            catch (Exception)
            {
                return Failure<List<string>>("An internal error occurred.", "Failed to load departments.");
            }
        }
    }
}
