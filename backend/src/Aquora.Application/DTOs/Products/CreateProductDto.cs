using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Products
{
    public class CreateProductDto
    {
        [Required(ErrorMessage = "Product name is required.")]
        [StringLength(150, ErrorMessage = "Product name cannot exceed 150 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Brand is required.")]
        public Guid BrandId { get; set; }

        [StringLength(50, ErrorMessage = "SKU cannot exceed 50 characters.")]
        public string? SKU { get; set; }

        public bool IsActive { get; set; } = true;
        [Range(0, 100, ErrorMessage = "GST rate must be between 0 and 100.")]
        public decimal? GstRate { get; set; }
        public decimal? OpeningStock { get; set; }
        public string Category { get; set; } = "Bottle";
        public int DisplayOrder { get; set; } = 0;
        public string? BottleSize { get; set; }
        public string? ImageUrl { get; set; }
    }
}
