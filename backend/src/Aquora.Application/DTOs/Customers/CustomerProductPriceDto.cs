using System;

namespace Aquora.Application.DTOs.Customers
{
    public class CustomerProductPriceDto
    {
        public Guid Id { get; set; }
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSku { get; set; } = string.Empty;
        public decimal StandardSellingPrice { get; set; }
        public decimal CustomPrice { get; set; }
        public decimal? DiscountPercentage { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
        public bool IsActive { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SaveCustomerProductPriceRequest
    {
        public Guid ProductId { get; set; }
        public decimal CustomPrice { get; set; }
        public decimal? DiscountPercentage { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Notes { get; set; }
    }

    public class ApplicablePriceResponseDto
    {
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal ApplicablePrice { get; set; }
        public string PriceSource { get; set; } = "StandardCatalog"; // CustomerAgreement, RateRule, StandardCatalog
        public decimal StandardSellingPrice { get; set; }
        public decimal? NegotiatedPrice { get; set; }
        public CustomerPricingHistoryDto? History { get; set; }
    }

    public class CustomerPricingHistoryDto
    {
        public decimal LastPriceCharged { get; set; }
        public DateTime? LastTransactionDate { get; set; }
        public decimal LastQuantity { get; set; }
        public string LastPaymentStatus { get; set; } = string.Empty;
        public decimal CustomerOutstandingBalance { get; set; }
    }
}
