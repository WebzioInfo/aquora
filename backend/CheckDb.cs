using System;
using Npgsql;

class Program
{
    static void Main()
    {
        string connStr = ""Host=localhost;Database=aquoradb;Username=postgres;Password=postgres"";
        using var conn = new NpgsqlConnection(connStr);
        conn.Open();
        
        using var cmd = new NpgsqlCommand(""SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'ProductionShifts';"", conn);
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            Console.WriteLine($""{reader.GetString(0)}.{reader.GetString(1)}"");
        }
    }
}
