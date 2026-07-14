using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.RawMaterials
{
    public class AddStockDto
    {
        [Required(ErrorMessage = "Quantity is required.")]
        [Range(0.0001, double.MaxValue, ErrorMessage = "Quantity to add must be greater than zero.")]
        public decimal Quantity { get; set; }

        [StringLength(500, ErrorMessage = "Notes cannot exceed 500 characters.")]
        public string? Notes { get; set; }
    }
}
