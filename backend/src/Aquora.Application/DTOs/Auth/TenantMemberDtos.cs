using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Auth
{
    public class InviteTenantMemberRequest
    {
        public string Email { get; set; }
        public Guid RoleId { get; set; }
        public string? Message { get; set; }
    }

    public class AcceptInviteRequest
    {
        public string Token { get; set; }
        public string? FullName { get; set; }
        public string? Password { get; set; }
    }

    public class UpdateTenantMemberRoleRequest
    {
        public Guid RoleId { get; set; }
    }

    public class UserMembershipDto
    {
        public Guid Id { get; set; }
        public Guid PlatformUserId { get; set; }
        public Guid TenantId { get; set; }
        public Guid RoleId { get; set; }
        public string Status { get; set; }
        public DateTime? JoinedAt { get; set; }
    }

    public class TenantMembersResponse
    {
        public List<UserMembershipDto> Members { get; set; } = new List<UserMembershipDto>();
    }
}
