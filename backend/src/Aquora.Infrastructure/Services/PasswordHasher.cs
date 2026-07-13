using Aquora.Application.Interfaces;
using BC = BCrypt.Net.BCrypt;

namespace Aquora.Infrastructure.Services
{
    public class PasswordHasher : IPasswordHasher
    {
        public string HashPassword(string password)
        {
            return BC.HashPassword(password);
        }

        public bool VerifyPassword(string password, string passwordHash)
        {
            return BC.Verify(password, passwordHash);
        }
    }
}
