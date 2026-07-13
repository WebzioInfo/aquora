using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Hierarchy;

namespace Aquora.Application.Interfaces.Services
{
    public interface IHierarchyService
    {
        Task<List<HierarchyNodeDto>> GetFullTreeAsync();
        Task<HierarchyNodeDto> CreateNodeAsync(string type, HierarchyNodeDto nodeDto);
        Task<HierarchyNodeDto> UpdateNodeAsync(Guid id, string type, HierarchyNodeDto nodeDto);
        Task<bool> DeleteNodeAsync(Guid id, string type);
    }
}
