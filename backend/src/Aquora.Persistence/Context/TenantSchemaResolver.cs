namespace Aquora.Persistence.Context
{
    public static class TenantSchemaResolver
    {
        private static readonly System.Threading.AsyncLocal<string?> CurrentSchema = new();

        public static string? CurrentSchemaName
        {
            get => CurrentSchema.Value;
            set => CurrentSchema.Value = value;
        }
    }
}
