using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;

namespace Aquora.Application.Extensions
{
    public static class TenantDbContextCompanyExtensions
    {
        /// <summary>
        /// Retrieves the mandatory single Company root record for the current tenant workspace.
        /// Throws an InvalidOperationException if zero records exist, or if more than one record exists.
        /// </summary>
        public static async Task<Company> GetSingletonCompanyAsync(this ITenantDbContext context, CancellationToken cancellationToken = default)
        {
            var activeCompanies = await context.Companies
                .Where(c => !c.IsDeleted)
                .Take(2)
                .ToListAsync(cancellationToken);

            if (activeCompanies.Count == 0)
            {
                throw new InvalidOperationException("No company root found in the tenant workspace. The workspace must be provisioned first.");
            }

            if (activeCompanies.Count > 1)
            {
                throw new InvalidOperationException("Invariant violation: Multiple active company roots found in the tenant workspace. Exactly one company is allowed per tenant.");
            }

            return activeCompanies[0];
        }

        /// <summary>
        /// Retrieves the single Company root if present, or null if uninitialized.
        /// Throws an InvalidOperationException if corruption (> 1 company) is detected.
        /// </summary>
        public static async Task<Company?> FindSingletonCompanyAsync(this ITenantDbContext context, CancellationToken cancellationToken = default)
        {
            var activeCompanies = await context.Companies
                .Where(c => !c.IsDeleted)
                .Take(2)
                .ToListAsync(cancellationToken);

            if (activeCompanies.Count > 1)
            {
                throw new InvalidOperationException("Invariant violation: Multiple active company roots found in the tenant workspace. Exactly one company is allowed per tenant.");
            }

            return activeCompanies.FirstOrDefault();
        }
    }
}
