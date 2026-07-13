using FluentValidation;
using Aquora.Application.DTOs.Auth;

namespace Aquora.Application.Validation
{
    public class RegisterTenantRequestValidator : AbstractValidator<RegisterTenantRequest>
    {
        public RegisterTenantRequestValidator()
        {
            RuleFor(x => x.TenantName)
                .NotEmpty().WithMessage("Tenant name is required.")
                .MaximumLength(100).WithMessage("Tenant name cannot exceed 100 characters.");

            RuleFor(x => x.TenantCode)
                .NotEmpty().WithMessage("Tenant code is required.")
                .MaximumLength(10).WithMessage("Tenant code cannot exceed 10 characters.")
                .Matches("^[a-zA-Z0-9]+$").WithMessage("Tenant code must be alphanumeric.");

            RuleFor(x => x.AdminEmail)
                .NotEmpty().WithMessage("Administrator email is required.")
                .EmailAddress().WithMessage("A valid email address is required.");

            RuleFor(x => x.AdminPassword)
                .NotEmpty().WithMessage("Administrator password is required.")
                .MinimumLength(6).WithMessage("Password must be at least 6 characters long.");

            RuleFor(x => x.AdminFirstName)
                .NotEmpty().WithMessage("Administrator first name is required.")
                .MaximumLength(50).WithMessage("First name cannot exceed 50 characters.");

            RuleFor(x => x.AdminLastName)
                .NotEmpty().WithMessage("Administrator last name is required.")
                .MaximumLength(50).WithMessage("Last name cannot exceed 50 characters.");
        }
    }
}
