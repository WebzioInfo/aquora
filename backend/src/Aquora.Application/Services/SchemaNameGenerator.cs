using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class SchemaNameGenerator : ISchemaNameGenerator
    {
        private readonly IPlatformDbContext _platformContext;
        private static readonly Regex ValidSchemaRegex = new("^[a-z][a-z0-9_]*$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public SchemaNameGenerator(IPlatformDbContext platformContext)
        {
            _platformContext = platformContext;
        }

        public async Task<string> GenerateSchemaNameAsync(string inputName)
        {
            if (string.IsNullOrWhiteSpace(inputName))
            {
                throw new ArgumentException("Company or tenant name is required for provisioning.", nameof(inputName));
            }

            // 1. Convert to lowercase, replace non-alphanumeric chars with underscores
            string normalized = inputName.ToLowerInvariant().Trim();
            normalized = Regex.Replace(normalized, @"[^a-z0-9]", "_");
            normalized = Regex.Replace(normalized, @"_+", "_");
            normalized = normalized.Trim('_');

            if (string.IsNullOrEmpty(normalized))
            {
                throw new InvalidOperationException("Failed to generate a valid schema slug from the company name.");
            }

            // 2. Intelligently truncate to fit PostgreSQL schema limits (63 bytes)
            // "aquora_tenant_" is 14 chars. Suffixes (e.g. "_999") can be up to 4 chars.
            // Let's limit the core company slug to 44 characters to be absolutely safe.
            const int maxSlugLength = 44;
            if (normalized.Length > maxSlugLength)
            {
                normalized = normalized.Substring(0, maxSlugLength).Trim('_');
            }

            string baseSchemaName = $"aquora_tenant_{normalized}";

            // 3. Uniqueness Check with numeric suffixes
            int suffix = 1;
            string proposedSchemaName = baseSchemaName;

            while (await _platformContext.Tenants.AnyAsync(t => t.SchemaName == proposedSchemaName))
            {
                suffix++;
                string suffixStr = $"_{suffix}";
                
                int maxBaseLength = 63 - suffixStr.Length;
                if (baseSchemaName.Length > maxBaseLength)
                {
                    proposedSchemaName = baseSchemaName.Substring(0, maxBaseLength).Trim('_') + suffixStr;
                }
                else
                {
                    proposedSchemaName = baseSchemaName + suffixStr;
                }
            }

            // 4. Validate PostgreSQL identifier format
            if (!ValidSchemaRegex.IsMatch(proposedSchemaName) || proposedSchemaName.Length > 63)
            {
                throw new InvalidOperationException($"Generated schema name '{proposedSchemaName}' is not a valid PostgreSQL identifier.");
            }

            return proposedSchemaName;
        }
    }
}
