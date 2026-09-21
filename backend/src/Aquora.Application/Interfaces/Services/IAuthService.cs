using System.Threading;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Auth;

namespace Aquora.Application.Interfaces.Services
{
    public interface IAuthService
    {
        Task<bool> RegisterAsync(RegisterRequest request);
        Task<bool> SendOtpAsync(SendOtpRequest request, CancellationToken cancellationToken = default);
        Task<LoginResponse> VerifyOtpAsync(VerifyOtpRequest request);
        Task<LoginResponse> LoginAsync(LoginRequest request);
        Task<LoginResponse> RefreshTokenAsync(RefreshTokenRequest request);
        
        // Password Reset & Recovery
        Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task<VerifyPasswordResetOtpResponse> VerifyPasswordResetOtpAsync(VerifyPasswordResetOtpRequest request, string? ipAddress = null);
        Task<bool> ResetPasswordAsync(PasswordResetRequest request, string? ipAddress = null);
        Task<bool> ResendOtpAsync(ResendOtpRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);

        // Account Email Change & Re-verification
        Task<bool> RequestEmailChangeAsync(string userId, RequestEmailChangeRequest request, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task<bool> VerifyEmailChangeAsync(string userId, VerifyEmailChangeRequest request, string? ipAddress = null);

        Task LogoutAsync(string userId);
        Task<AuthMeResponse> GetMeAsync(string userId);
        Task<UserSessionResponse> GetSessionAsync(string userId);
    }
}
