using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Npgsql;

class Program
{
    static async Task Main()
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(System.IO.Path.GetFullPath(@"..\src\Aquora.API"))
            .AddJsonFile("appsettings.json")
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");

        try
        {
            using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();
            using var cmd = new NpgsqlCommand("INSERT INTO public.\"PlatformAuditLogs\" (\"Id\", \"TenantId\", \"UserId\", \"UserEmail\", \"Action\", \"TableName\", \"PrimaryKey\", \"OldValues\", \"NewValues\", \"Timestamp\", \"IpAddress\", \"Device\", \"Reason\", \"Module\") VALUES (@id, @tId, null, 'test', 'test', 'test', null, null, null, current_timestamp, null, null, null, null)", conn);
            cmd.Parameters.AddWithValue("id", Guid.NewGuid());
            cmd.Parameters.AddWithValue("tId", Guid.Empty);
            await cmd.ExecuteNonQueryAsync();
            Console.WriteLine("SUCCESS!");
        }
        catch (Exception ex)
        {
            Console.WriteLine("DB EXCEPTION: " + ex.Message);
        }
    }
}
