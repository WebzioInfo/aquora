using System;

namespace Aquora.Persistence.Context
{
    public static class TenantSchemaResolver
    {
        private static readonly System.Threading.AsyncLocal<string?> CurrentSchema = new();

        /// <summary>
        /// Set to true by design-time tooling / tests when generating migrations.
        /// </summary>
        public static bool IsDesignTime { get; set; } = false;

        public static string? CurrentSchemaName
        {
            get => CurrentSchema.Value;
            set => CurrentSchema.Value = value;
        }

        /// <summary>
        /// Resolves the active tenant schema name.
        /// Fails fast if migration execution is attempted without setting a tenant schema context.
        /// </summary>
        public static string ResolveRequiredSchema()
        {
            var schema = CurrentSchema.Value;
            if (!string.IsNullOrWhiteSpace(schema))
            {
                return schema;
            }

            if (IsDesignTime)
            {
                return "public";
            }

            throw new InvalidOperationException(
                "Tenant schema context is missing. Tenant migrations cannot execute without an active tenant schema configured in TenantSchemaResolver.CurrentSchemaName.");
        }
    }
}
