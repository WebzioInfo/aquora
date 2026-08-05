using System;
using System.IO;
using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IExportService
    {
        Task<byte[]> GenerateExportAsync(string format);
    }
}
