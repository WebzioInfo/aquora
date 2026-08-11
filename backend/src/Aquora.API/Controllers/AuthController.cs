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
    [Route("auth")]
    public class AuthController : ApiControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<ActionResult<ApiResponse<bool>>> Register([FromBody] RegisterRequest request)
        {
            var result = await _authService.RegisterAsync(request);
            return Success(result, "Registration successful. Please verify your email.");
        }

        [HttpPost("verify-otp")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> VerifyOtp([FromBody] VerifyOtpRequest request)
        {
            var result = await _authService.VerifyOtpAsync(request);
            return Success(result, "Email verified successfully.");
        }

        [HttpPost("send-otp")]
        public async Task<ActionResult<ApiResponse<bool>>> SendOtp([FromBody] SendOtpRequest request, CancellationToken cancellationToken)
        {
            var result = await _authService.SendOtpAsync(request, cancellationToken);
            return Success(result, "OTP code sent successfully.");
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<AuthMeResponse>>> Me()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var result = await _authService.GetMeAsync(userId);
            return Success(result, "User profile loaded successfully.");
        }

        [Authorize]
        [HttpGet("session")]
        public async Task<ActionResult<ApiResponse<UserSessionResponse>>> Session()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserSessionResponse>("User identity claim not found.", "Unauthorized access."));
            }

            try
            {
                var result = await _authService.GetSessionAsync(userId);
                return Success(result, "User session state loaded successfully.");
            }
            catch (UnauthorizedAccessException ex)
            {
                Console.WriteLine($"[AUTH CONTROLLER 401]: Session request unauthorized: {ex.Message}");
                return Unauthorized(Failure<UserSessionResponse>(ex.Message, "Unauthorized access."));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUTH CONTROLLER ERROR]: Unexpected error in Session endpoint: {ex.Message}");
                return StatusCode(500, Failure<UserSessionResponse>("An unexpected error occurred loading session.", ex.Message));
            }
        }

        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
        {
            var result = await _authService.LoginAsync(request);
            return Success(result, "Login successful.");
        }

        [HttpPost("refresh-token")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> RefreshToken([FromBody] RefreshTokenRequest request)
        {
            var result = await _authService.RefreshTokenAsync(request);
            return Success(result, "Token refreshed successfully.");
        }

        [HttpPost("reset-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetPassword([FromBody] PasswordResetRequest request)
        {
            var result = await _authService.ResetPasswordAsync(request);
            if (!result)
            {
                return Failure<bool>("Email not found.", "Password reset failed.");
            }
            return Success(true, "Password has been reset successfully.");
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult<ApiResponse<object>>> Logout()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (!string.IsNullOrEmpty(userId))
            {
                await _authService.LogoutAsync(userId);
            }
            return Success<object?>(null, "Logged out successfully.");
        }
    }
}
