using System;
using System.IO;
using System.Text.RegularExpressions;

class Program
{
    static void Main(string[] args)
    {
        var text = File.ReadAllText("full_migration_script.sql");
        // Find any 2-part or 3-part identifiers: "foo"."bar"
        var matches = Regex.Matches(text, @"""([^""]+)""\s*\.\s*""([^""]+)""");
        var qualifiers = new System.Collections.Generic.HashSet<string>();
        foreach (Match m in matches)
        {
            qualifiers.Add(m.Groups[1].Value);
        }

        Console.WriteLine("All schema qualifiers found in full_migration_script.sql:");
        foreach (var q in qualifiers)
        {
            Console.WriteLine($"  Qualifier: '{q}'");
        }
    }
}
