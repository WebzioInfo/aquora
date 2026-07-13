using System;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Auth;

namespace Aquora.Application.Interfaces.Services
{
    public interface ITenantService
    {
        Task<bool> SendOtpAsync(string email);
        Task<LoginResponse> VerifyOtpAndCreateUserAsync(OTPRegisterRequest request);
        Task<Guid> OnboardTenantAsync(Guid userId, OnboardingRequest request);
        Task<Guid> InviteMemberAsync(Guid ownerUserId, Guid tenantId, InviteTenantMemberRequest request);
        Task<Guid> AcceptInviteAsync(AcceptInviteRequest request, Guid? existingUserId);
        Task<TenantMembersResponse> GetMembersAsync(Guid tenantId);
        Task<bool> UpdateMemberRoleAsync(Guid tenantId, Guid membershipId, UpdateTenantMemberRoleRequest request);
        Task<bool> DeleteMemberAsync(Guid tenantId, Guid membershipId);
    }
}
