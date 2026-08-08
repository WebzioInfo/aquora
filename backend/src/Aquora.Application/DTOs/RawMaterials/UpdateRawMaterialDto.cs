using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.RawMaterials
{
    public class UpdateRawMaterialDto
    {
        [Required(ErrorMessage = "Raw material name is required.")]
        [StringLength(150, ErrorMessage = "Raw material name cannot exceed 150 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Category is required.")]
        public string Category { get; set; } = string.Empty;

        [Required(ErrorMessage = "Unit is required.")]
        public string Unit { get; set; } = string.Empty;

        public bool IsActive { get; set; }

        public decimal? CurrentStock { get; set; }

        public decimal? CostPerUnit { get; set; }
    }

    public class UpdateRawMaterialPriceDto
    {
        [Required(ErrorMessage = "Enter a valid unit price.")]
        [Range(0, 100000000, ErrorMessage = "Enter a valid unit price.")]
        public decimal CostPerUnit { get; set; }
    }
}
