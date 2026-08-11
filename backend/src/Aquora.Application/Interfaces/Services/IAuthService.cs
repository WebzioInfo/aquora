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
        Task<bool> ResetPasswordAsync(PasswordResetRequest request);
        Task LogoutAsync(string userId);
        Task<AuthMeResponse> GetMeAsync(string userId);
        Task<UserSessionResponse> GetSessionAsync(string userId);
    }
}
