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
    [Authorize]
    [Route("onboarding")]
    [Route("api/v1/onboarding")]
    public class OnboardingController : ApiControllerBase
    {
        private readonly ICompanyOnboardingService _companyOnboardingService;

        public OnboardingController(ICompanyOnboardingService companyOnboardingService)
        {
            _companyOnboardingService = companyOnboardingService;
        }

        [HttpPost("company")]
        public async Task<ActionResult<ApiResponse<CompanyOnboardingResponse>>> OnboardCompany(
            [FromBody] CompanyOnboardingRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            try
            {
                var result = await _companyOnboardingService.OnboardCompanyAsync(userId, request);
                return Success(result, "Company onboarding completed. Invite Your Team.");
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("already initialized"))
            {
                return Conflict(Failure<CompanyOnboardingResponse>(ex.Message, "Company already initialized."));
            }
        }

        [HttpPost("retry")]
        public async Task<ActionResult<ApiResponse<CompanyOnboardingResponse>>> RetryOnboarding()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            try
            {
                var result = await _companyOnboardingService.RetryOnboardingAsync(userId);
                return Success(result, "Tenant provisioning restarted successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(Failure<CompanyOnboardingResponse>(ex.Message));
            }
        }

        [HttpGet("status")]
        public async Task<ActionResult<ApiResponse<object>>> GetProvisioningStatus()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            try
            {
                var status = await _companyOnboardingService.GetProvisioningStatusAsync(userId);
                return Success<object>(status, "Provisioning status retrieved.");
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(Failure<object>(ex.Message));
            }
        }
    }
}
