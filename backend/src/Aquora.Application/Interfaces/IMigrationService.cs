using System.Threading.Tasks;

namespace Aquora.Application.Interfaces
{
    public interface IMigrationService
    {
        /// <summary>
        /// Executes migrations for the platform database and all active tenant databases.
        /// </summary>
        /// <returns>A task representing the asynchronous operation.</returns>
        Task MigrateAllAsync();
    }
}
