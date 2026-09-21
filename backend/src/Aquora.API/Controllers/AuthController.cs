using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Common.Exceptions;
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

        private string? GetClientIp()
        {
            return HttpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var ip)
                ? ip.ToString().Split(',')[0].Trim()
                : HttpContext.Connection.RemoteIpAddress?.ToString();
        }

        [HttpPost("register")]
        public async Task<ActionResult<ApiResponse<bool>>> Register([FromBody] RegisterRequest request)
        {
            try
            {
                var result = await _authService.RegisterAsync(request);
                return Success(result, "Registration successful. Please verify your email.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Registration failed.");
            }
        }

        [HttpPost("verify-otp")]
        [HttpPost("verify-email-otp")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> VerifyOtp([FromBody] VerifyOtpRequest request)
        {
            try
            {
                var result = await _authService.VerifyOtpAsync(request);
                return Success(result, "Email verified successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<LoginResponse>(ex.Message, "Verification failed.");
            }
        }

        [HttpPost("send-otp")]
        [HttpPost("send-verification-otp")]
        public async Task<ActionResult<ApiResponse<bool>>> SendOtp([FromBody] SendOtpRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var result = await _authService.SendOtpAsync(request, cancellationToken);
                return Success(result, "Verification code sent successfully.");
            }
            catch (OtpRateLimitException ex)
            {
                return StatusCode(429, Failure<bool>(ex.Message, "Rate Limit Exceeded"));
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Dispatch failed.");
            }
        }

        [HttpPost("forgot-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var clientIp = GetClientIp();
                var result = await _authService.ForgotPasswordAsync(request, clientIp, cancellationToken);
                return Success(result, "If an account exists for this email, a verification code has been sent.");
            }
            catch (OtpRateLimitException ex)
            {
                return StatusCode(429, Failure<bool>(ex.Message, "Rate Limit Exceeded"));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUTH FORGOT-PASSWORD WARN]: {ex.Message}");
                // Maintain account enumeration defense: return success message on unexpected error
                return Success(true, "If an account exists for this email, a verification code has been sent.");
            }
        }

        [HttpPost("verify-password-reset-otp")]
        public async Task<ActionResult<ApiResponse<VerifyPasswordResetOtpResponse>>> VerifyPasswordResetOtp([FromBody] VerifyPasswordResetOtpRequest request)
        {
            try
            {
                var clientIp = GetClientIp();
                var result = await _authService.VerifyPasswordResetOtpAsync(request, clientIp);
                return Success(result, "Verification code confirmed.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<VerifyPasswordResetOtpResponse>(ex.Message, "Verification failed.");
            }
        }

        [HttpPost("reset-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetPassword([FromBody] PasswordResetRequest request)
        {
            try
            {
                var clientIp = GetClientIp();
                var result = await _authService.ResetPasswordAsync(request, clientIp);
                return Success(result, "Password has been reset successfully. Please sign in with your new password.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Password reset failed.");
            }
        }

        [HttpPost("resend-password-reset-otp")]
        [HttpPost("resend-otp")]
        public async Task<ActionResult<ApiResponse<bool>>> ResendOtp([FromBody] ResendOtpRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var clientIp = GetClientIp();
                var result = await _authService.ResendOtpAsync(request, clientIp, cancellationToken);
                return Success(result, "Verification code sent successfully.");
            }
            catch (OtpRateLimitException ex)
            {
                return StatusCode(429, Failure<bool>(ex.Message, "Rate Limit Exceeded"));
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Failed to resend code.");
            }
        }

        [Authorize]
        [HttpPost("request-email-change")]
        public async Task<ActionResult<ApiResponse<bool>>> RequestEmailChange([FromBody] RequestEmailChangeRequest request, CancellationToken cancellationToken)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var clientIp = GetClientIp();
                var result = await _authService.RequestEmailChangeAsync(userId, request, clientIp, cancellationToken);
                return Success(result, "Verification code sent to your new email address.");
            }
            catch (OtpRateLimitException ex)
            {
                return StatusCode(429, Failure<bool>(ex.Message, "Rate Limit Exceeded"));
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Email change request failed.");
            }
        }

        [Authorize]
        [HttpPost("verify-email-change")]
        public async Task<ActionResult<ApiResponse<bool>>> VerifyEmailChange([FromBody] VerifyEmailChangeRequest request)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var clientIp = GetClientIp();
                var result = await _authService.VerifyEmailChangeAsync(userId, request, clientIp);
                return Success(result, "Email address updated and verified successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Email change verification failed.");
            }
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
            try
            {
                var result = await _authService.LoginAsync(request);
                return Success(result, "Login successful.");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(Failure<LoginResponse>(ex.Message, "Authentication Failed"));
            }
            catch (Exception ex)
            {
                return Failure<LoginResponse>(ex.Message, "Login error");
            }
        }

        [HttpPost("refresh-token")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> RefreshToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                var result = await _authService.RefreshTokenAsync(request);
                return Success(result, "Token refreshed successfully.");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(Failure<LoginResponse>(ex.Message, "Unauthorized access."));
            }
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
