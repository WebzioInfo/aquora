using System.Threading.Tasks;
using Aquora.Application.DTOs.User;

namespace Aquora.Application.Interfaces.Services
{
    public interface IUserProfileService
    {
        Task<UserProfileDto> GetProfileAsync(string userId);
        Task<UserProfileDto> UpdateProfileAsync(string userId, UpdateUserProfileRequest request);
        Task<RequestPasswordChangeOtpResponse> RequestPasswordChangeOtpAsync(string userId, ChangePasswordRequest request);
        Task<bool> VerifyPasswordChangeOtpAsync(string userId, VerifyPasswordChangeOtpRequest request);
        Task<bool> ResendPasswordChangeOtpAsync(string userId);
        Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request);
        Task<UserSecuritySummaryDto> GetSecuritySummaryAsync(string userId);
        Task<UserProfileDto> UpdateAvatarAsync(string userId, string? photoUrl);
        Task<UserProfileDto> UploadAvatarAsync(string userId, System.IO.Stream fileStream, string fileName, string contentType);
        Task<UserProfileDto> RemoveAvatarAsync(string userId);
        Task<UserProfileDto> UploadSignatureAsync(string userId, System.IO.Stream fileStream, string fileName, string contentType);
        Task<UserProfileDto> RemoveSignatureAsync(string userId);
    }
}
