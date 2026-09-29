using System.Text.RegularExpressions;
using FluentValidation;
using Aquora.Application.DTOs.User;

namespace Aquora.Application.Validators
{
    public class UpdateUserProfileRequestValidator : AbstractValidator<UpdateUserProfileRequest>
    {
        public UpdateUserProfileRequestValidator()
        {
            RuleFor(x => x.FirstName)
                .MaximumLength(100).WithMessage("First name cannot exceed 100 characters.")
                .When(x => !string.IsNullOrEmpty(x.FirstName));

            RuleFor(x => x.LastName)
                .MaximumLength(100).WithMessage("Last name cannot exceed 100 characters.")
                .When(x => !string.IsNullOrEmpty(x.LastName));

            RuleFor(x => x.Username)
                .MinimumLength(3).WithMessage("Username must be at least 3 characters long.")
                .MaximumLength(50).WithMessage("Username cannot exceed 50 characters.")
                .Matches(@"^[a-zA-Z0-9_.-]+$").WithMessage("Username can only contain alphanumeric characters, underscores, dots, and hyphens.")
                .When(x => !string.IsNullOrWhiteSpace(x.Username));

            RuleFor(x => x.Phone)
                .Matches(@"^(\+?[0-9\s-]{7,15})?$").WithMessage("Please enter a valid phone number.")
                .When(x => !string.IsNullOrWhiteSpace(x.Phone));

            RuleFor(x => x.Department)
                .MaximumLength(100).WithMessage("Department name cannot exceed 100 characters.")
                .When(x => !string.IsNullOrEmpty(x.Department));

            RuleFor(x => x.Qualification)
                .MaximumLength(150).WithMessage("Qualification cannot exceed 150 characters.")
                .When(x => !string.IsNullOrEmpty(x.Qualification));

            RuleFor(x => x.CertificationDetails)
                .MaximumLength(300).WithMessage("Certification details cannot exceed 300 characters.")
                .When(x => !string.IsNullOrEmpty(x.CertificationDetails));

            RuleFor(x => x.ExperienceYears)
                .InclusiveBetween(0, 60).WithMessage("Experience years must be between 0 and 60.")
                .When(x => x.ExperienceYears.HasValue);

            RuleFor(x => x.AssignedLabStation)
                .MaximumLength(150).WithMessage("Assigned lab station cannot exceed 150 characters.")
                .When(x => !string.IsNullOrEmpty(x.AssignedLabStation));

            RuleFor(x => x.QcResponsibilities)
                .MaximumLength(500).WithMessage("QC responsibilities cannot exceed 500 characters.")
                .When(x => !string.IsNullOrEmpty(x.QcResponsibilities));
        }
    }

    public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
    {
        public ChangePasswordRequestValidator()
        {
            RuleFor(x => x.CurrentPassword)
                .NotEmpty().WithMessage("Current password is required.");

            RuleFor(x => x.NewPassword)
                .NotEmpty().WithMessage("New password is required.")
                .MinimumLength(8).WithMessage("New password must be at least 8 characters long.")
                .Matches("[A-Z]").WithMessage("New password must contain at least one uppercase letter.")
                .Matches("[a-z]").WithMessage("New password must contain at least one lowercase letter.")
                .Matches("[0-9]").WithMessage("New password must contain at least one digit.");

            RuleFor(x => x.ConfirmPassword)
                .NotEmpty().WithMessage("Password confirmation is required.")
                .Equal(x => x.NewPassword).WithMessage("The new password and confirmation password do not match.");
        }
    }
}
