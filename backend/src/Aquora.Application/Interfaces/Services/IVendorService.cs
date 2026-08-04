using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Purchase;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IVendorService
    {
        Task<PagedResult<VendorDto>> GetVendorsAsync(int pageNumber, int pageSize, string? search);
        Task<List<VendorDropdownDto>> GetVendorDropdownAsync();
        Task<VendorDto?> GetVendorByIdAsync(Guid id);
        Task<VendorDetailsDto?> GetVendorDetailsAsync(Guid id);
        Task<VendorDto> CreateVendorAsync(CreateVendorRequest request);
        Task<VendorDto?> UpdateVendorAsync(Guid id, UpdateVendorRequest request);
        Task<bool> ToggleVendorStatusAsync(Guid id);
        Task<bool> DeleteVendorAsync(Guid id);
    }
}
