using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Products
{
    public class UpdateProductDto
    {
        [Required(ErrorMessage = "Product name is required.")]
        [StringLength(150, ErrorMessage = "Product name cannot exceed 150 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Brand is required.")]
        public Guid BrandId { get; set; }

        [StringLength(50, ErrorMessage = "SKU cannot exceed 50 characters.")]
        public string? SKU { get; set; }

        public bool IsActive { get; set; }
        public decimal? CurrentStock { get; set; }
        public decimal? SellingPrice { get; set; }
        public decimal? CostPrice { get; set; }
        public string Category { get; set; } = "Bottle";
        public int DisplayOrder { get; set; } = 0;
        public string? BottleSize { get; set; }
        public string? ImageUrl { get; set; }
    }

    public class UpdateProductPriceDto
    {
        [Required(ErrorMessage = "Enter a valid unit price.")]
        [Range(0, 100000000, ErrorMessage = "Enter a valid unit price.")]
        public decimal SellingPrice { get; set; }
        public decimal? CostPrice { get; set; }
    }
}
