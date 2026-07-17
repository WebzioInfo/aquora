using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IProvisioningProgressReporter
    {
        Task ReportProgressAsync(string userId, int progress, string stage, string message);
        Task ReportFailureAsync(string userId, string stage, string reason);
    }
}
