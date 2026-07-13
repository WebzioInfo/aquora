using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface ISchemaNameGenerator
    {
        Task<string> GenerateSchemaNameAsync(string inputName);
    }
}
