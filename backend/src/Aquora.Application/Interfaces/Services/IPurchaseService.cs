using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Purchase;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPurchaseService
    {
        Task<PagedPurchasesResponseDto> GetPurchasesPagedAsync(
            int pageNumber,
            int pageSize,
            string? search,
            DateTime? startDate,
            DateTime? endDate,
            Guid? vendorId,
            string? category,
            string? paymentStatus);

        Task<PagedResult<PurchaseDto>> GetPurchasesAsync(
            int pageNumber,
            int pageSize,
            string? search,
            DateTime? startDate,
            DateTime? endDate,
            Guid? vendorId,
            string? category,
            string? paymentStatus);

        Task<PurchaseDto?> GetPurchaseByIdAsync(Guid id);
        Task<PurchaseDto> CreatePurchaseAsync(CreatePurchaseRequest request);
        Task<PurchaseDto?> UpdatePurchaseAsync(Guid id, UpdatePurchaseRequest request);
        Task<bool> CancelPurchaseAsync(Guid id);
        Task<CreatePurchaseRequest?> DuplicatePurchaseAsync(Guid id);
        Task<bool> DeletePurchaseAsync(Guid id);

        Task<PurchaseDto?> AddPaymentAsync(Guid purchaseId, AddPurchasePaymentRequest request);
        Task<PurchasePaymentDto?> GetPaymentByIdAsync(Guid purchaseId, Guid paymentId);
        Task<PurchaseDto?> UpdatePaymentAsync(Guid purchaseId, Guid paymentId, UpdatePurchasePaymentRequest request);
        Task<PurchaseDto?> DeletePaymentAsync(Guid purchaseId, Guid paymentId);
        Task<List<AssetHistoryDto>> GetAssetHistoryAsync(Guid assetId);

        Task<List<PurchaseCategoryDto>> GetPurchaseCategoriesAsync(bool includeInactive = false);
        Task<PurchaseCategoryDto?> GetPurchaseCategoryByIdAsync(Guid id);
        Task<PurchaseCategoryDto> CreatePurchaseCategoryAsync(CreatePurchaseCategoryRequest request);
        Task<PurchaseCategoryDto?> UpdatePurchaseCategoryAsync(Guid id, UpdatePurchaseCategoryRequest request);
        Task<bool> DeletePurchaseCategoryAsync(Guid id);
    }
}
