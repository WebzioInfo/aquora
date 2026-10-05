using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Purchase
{
    public class PurchaseCategoryDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Treatment { get; set; } = "Expense"; // "Inventory", "Asset", "Expense"
        public bool IsSystem { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreatePurchaseCategoryRequest
    {
        [Required(ErrorMessage = "Category name is required.")]
        [StringLength(100, ErrorMessage = "Category name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Purchase treatment is required.")]
        [RegularExpression("^(Inventory|Asset|Expense)$", ErrorMessage = "Treatment must be 'Inventory', 'Asset', or 'Expense'.")]
        public string Treatment { get; set; } = "Expense";

        public string? Description { get; set; }
    }

    public class UpdatePurchaseCategoryRequest
    {
        [Required(ErrorMessage = "Category name is required.")]
        [StringLength(100, ErrorMessage = "Category name cannot exceed 100 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Purchase treatment is required.")]
        [RegularExpression("^(Inventory|Asset|Expense)$", ErrorMessage = "Treatment must be 'Inventory', 'Asset', or 'Expense'.")]
        public string Treatment { get; set; } = "Expense";

        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
