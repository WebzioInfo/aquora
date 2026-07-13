using System;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Auth;

namespace Aquora.Application.Interfaces.Services
{
    public interface ICompanyOnboardingService
    {
        Task<CompanyOnboardingResponse> OnboardCompanyAsync(Guid userId, CompanyOnboardingRequest request);
    }
}
