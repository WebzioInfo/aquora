using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.User;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    [Route("api/v1/profile")]
    [Route("api/v1/account")]
    public class UsersController : ApiControllerBase
    {
        private readonly IUserProfileService _profileService;

        public UsersController(IUserProfileService profileService)
        {
            _profileService = profileService;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        }

        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetMyProfile()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var profile = await _profileService.GetProfileAsync(userId);
                return Success(profile, "Profile loaded successfully.");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(Failure<UserProfileDto>(ex.Message, "Unauthorized access."));
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to load user profile.");
            }
        }

        [HttpPut("me")]
        [HttpPatch("me")]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> UpdateMyProfile([FromBody] UpdateUserProfileRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var updatedProfile = await _profileService.UpdateProfileAsync(userId, request);
                return Success(updatedProfile, "Profile updated successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Validation Error");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(Failure<UserProfileDto>(ex.Message, "Unauthorized access."));
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to update profile.");
            }
        }

        [HttpPost("me/change-password")]
        public async Task<ActionResult<ApiResponse<bool>>> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<bool>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var result = await _profileService.ChangePasswordAsync(userId, request);
                return Success(result, "Password changed successfully.");
            }
            catch (InvalidOperationException ex)
            {
                return Failure<bool>(ex.Message, "Password Change Failed");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(Failure<bool>(ex.Message, "Unauthorized access."));
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "An unexpected error occurred while changing password.");
            }
        }

        [HttpGet("me/security")]
        public async Task<ActionResult<ApiResponse<UserSecuritySummaryDto>>> GetSecuritySummary()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserSecuritySummaryDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var summary = await _profileService.GetSecuritySummaryAsync(userId);
                return Success(summary, "Security summary loaded successfully.");
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(Failure<UserSecuritySummaryDto>(ex.Message, "Unauthorized access."));
            }
            catch (Exception ex)
            {
                return Failure<UserSecuritySummaryDto>(ex.Message, "Failed to load security summary.");
            }
        }

        [HttpPost("me/avatar")]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> UpdateAvatar([FromBody] UpdateAvatarRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var updatedProfile = await _profileService.UpdateAvatarAsync(userId, request.PhotoUrl);
                return Success(updatedProfile, "Profile photo updated successfully.");
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to update profile photo.");
            }
        }

        [HttpPost("me/avatar/upload")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> UploadAvatar(Microsoft.AspNetCore.Http.IFormFile file)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(Failure<UserProfileDto>("Please select a valid image file to upload.", "Invalid File"));
            }

            try
            {
                using var stream = file.OpenReadStream();
                var updatedProfile = await _profileService.UploadAvatarAsync(userId, stream, file.FileName, file.ContentType);
                return Success(updatedProfile, "Profile avatar uploaded successfully to cloud storage.");
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to upload avatar image.");
            }
        }

        [HttpDelete("me/avatar")]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> RemoveAvatar()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var updatedProfile = await _profileService.RemoveAvatarAsync(userId);
                return Success(updatedProfile, "Profile photo removed successfully.");
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to remove profile photo.");
            }
        }

        [HttpPost("me/signature/upload")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> UploadSignature(Microsoft.AspNetCore.Http.IFormFile file)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(Failure<UserProfileDto>("Please select a valid signature image file.", "Invalid File"));
            }

            try
            {
                using var stream = file.OpenReadStream();
                var updatedProfile = await _profileService.UploadSignatureAsync(userId, stream, file.FileName, file.ContentType);
                return Success(updatedProfile, "Digital signature uploaded successfully to cloud storage.");
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to upload digital signature.");
            }
        }

        [HttpDelete("me/signature")]
        public async Task<ActionResult<ApiResponse<UserProfileDto>>> RemoveSignature()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Failure<UserProfileDto>("User identity claim not found in current token.", "Unauthorized access."));
            }

            try
            {
                var updatedProfile = await _profileService.RemoveSignatureAsync(userId);
                return Success(updatedProfile, "Digital signature removed successfully.");
            }
            catch (Exception ex)
            {
                return Failure<UserProfileDto>(ex.Message, "Failed to remove digital signature.");
            }
        }
    }
}
