using System.Threading;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Search;

namespace Aquora.Application.Interfaces.Services
{
    public interface IGlobalSearchService
    {
        Task<GlobalSearchResponseDto> SearchAsync(GlobalSearchRequestDto request, CancellationToken cancellationToken = default);
    }
}
