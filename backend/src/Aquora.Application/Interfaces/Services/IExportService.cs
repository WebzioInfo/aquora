using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IExportService
    {
        Task<byte[]> GenerateExportAsync(string format);
        Task<string> GenerateTenantSqlDumpAsync(string schemaName);
    }
}
