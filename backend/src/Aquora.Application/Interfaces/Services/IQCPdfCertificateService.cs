using System.Threading.Tasks;
using Aquora.Domain.Entities.QC;

namespace Aquora.Application.Interfaces.Services
{
    public interface IQCPdfCertificateService
    {
        Task<byte[]> GenerateCertificatePdfAsync(WaterTestReport report, string companyName, string companyAddress = "");
        string GenerateCertificateHtml(WaterTestReport report, string companyName, string companyAddress = "");
    }
}
