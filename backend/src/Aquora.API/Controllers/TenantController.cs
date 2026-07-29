using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class TenantController : ApiControllerBase
    {
        private readonly ITenantService _tenantService;

        public TenantController(ITenantService tenantService)
        {
            _tenantService = tenantService;
        }

        [HttpPost("send-otp")]
        public async Task<ActionResult<ApiResponse<bool>>> SendOtp([FromBody] OtpSendRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return Failure<bool>("Email is required.", "Failed to send OTP.");
            }

            var result = await _tenantService.SendOtpAsync(request.Email);
            return Success(result, "OTP code sent successfully (check debug console).");
        }

        [HttpPost("verify-otp")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> VerifyOtp([FromBody] OTPRegisterRequest request)
        {
            var response = await _tenantService.VerifyOtpAndCreateUserAsync(request);
            return Success(response, "OTP verified and user registered successfully.");
        }

        [Authorize]
        [HttpPost("onboard")]
        public async Task<ActionResult<ApiResponse<Guid>>> Onboard([FromBody] OnboardingRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            var tenantId = await _tenantService.OnboardTenantAsync(userId, request);
            return Success(tenantId, "Tenant onboarded and PostgreSQL schema provisioned successfully.");
        }
    }

    public class OtpSendRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
