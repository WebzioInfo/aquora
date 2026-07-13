using System.Collections.Generic;
using System.Security.Claims;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces
{
    public interface ITokenService
    {
        string GenerateAccessToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions);
        string GenerateRefreshToken();
        ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
    }
}
