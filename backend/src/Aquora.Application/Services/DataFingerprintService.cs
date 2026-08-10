using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Globalization;

namespace Aquora.Application.Services
{
    public static class DataFingerprintService
    {
        public static string ComputeTableFingerprint(
            List<Dictionary<string, object>> rows, 
            IEnumerable<string>? targetColumns = null, 
            List<string>? ignoredColumns = null)
        {
            string canonicalPayload = ComputeTableCanonicalPayload(rows, targetColumns, ignoredColumns);
            return ComputeSha256(canonicalPayload);
        }

        public static string ComputeTableCanonicalPayload(
            List<Dictionary<string, object>> rows, 
            IEnumerable<string>? targetColumns = null, 
            List<string>? ignoredColumns = null)
        {
            if (rows == null || rows.Count == 0)
            {
                return "EMPTY_TABLE";
            }

            HashSet<string>? allowedSet = null;
            if (targetColumns != null)
            {
                allowedSet = new HashSet<string>(targetColumns, StringComparer.OrdinalIgnoreCase);
            }

            var canonicalRows = new List<string>();

            foreach (var row in rows)
            {
                var validKeys = row.Keys
                    .Where(k => (allowedSet == null || allowedSet.Contains(k)) && 
                                (ignoredColumns == null || !ignoredColumns.Contains(k, StringComparer.OrdinalIgnoreCase)))
                    .OrderBy(k => k, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var colTokens = new List<string>();
                foreach (var key in validKeys)
                {
                    var rawVal = row[key];
                    string canonicalVal = NormalizeValue(rawVal);
                    colTokens.Add($"{key.ToLowerInvariant()}={canonicalVal}");
                }

                canonicalRows.Add(string.Join("|", colTokens));
            }

            canonicalRows.Sort(StringComparer.Ordinal);
            return string.Join("\n", canonicalRows);
        }

        public static string NormalizeValue(object? val)
        {
            var unified = UnifyValue(val);
            if (unified == null || unified == DBNull.Value) return "<NULL>";

            if (unified is bool b) return b ? "true" : "false";

            if (unified is Guid g) return g.ToString("D").ToLowerInvariant();

            if (unified is DateTime dt)
            {
                var utcDt = dt.Kind == DateTimeKind.Unspecified 
                    ? DateTime.SpecifyKind(dt, DateTimeKind.Utc) 
                    : dt.ToUniversalTime();
                return utcDt.ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ", CultureInfo.InvariantCulture);
            }

            if (unified is DateTimeOffset dto)
            {
                return dto.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ", CultureInfo.InvariantCulture);
            }

            if (unified is decimal d)
            {
                return d.ToString("G29", CultureInfo.InvariantCulture);
            }

            if (unified is float || unified is double || unified is int || unified is long || unified is short || unified is byte)
            {
                return Convert.ToDecimal(unified).ToString("G29", CultureInfo.InvariantCulture);
            }

            if (unified is byte[] bytes)
            {
                return Convert.ToHexString(bytes).ToLowerInvariant();
            }

            string str = unified.ToString() ?? "";
            return NormalizeStringValue(str);
        }

        private static object? UnifyValue(object? val)
        {
            if (val == null || val == DBNull.Value) return null;

            if (val is JsonElement je)
            {
                switch (je.ValueKind)
                {
                    case JsonValueKind.Null:
                    case JsonValueKind.Undefined:
                        return null;
                    case JsonValueKind.True:
                        return true;
                    case JsonValueKind.False:
                        return false;
                    case JsonValueKind.Number:
                        if (je.TryGetDecimal(out decimal numDec)) return numDec;
                        if (je.TryGetDouble(out double numDbl)) return (decimal)numDbl;
                        return je.GetRawText();
                    case JsonValueKind.String:
                        return je.GetString();
                    default:
                        return je.GetRawText();
                }
            }

            return val;
        }

        private static string NormalizeStringValue(string input)
        {
            if (string.Equals(input, "null", StringComparison.OrdinalIgnoreCase)) return "<NULL>";

            if (Guid.TryParse(input, out var g))
            {
                return g.ToString("D").ToLowerInvariant();
            }

            if (DateTime.TryParse(input, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dt))
            {
                var utcDt = dt.Kind == DateTimeKind.Unspecified 
                    ? DateTime.SpecifyKind(dt, DateTimeKind.Utc) 
                    : dt.ToUniversalTime();
                return utcDt.ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ", CultureInfo.InvariantCulture);
            }

            return input;
        }

        public static string ComputeSha256(string text)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(text));
            return Convert.ToHexString(hashBytes).ToLowerInvariant();
        }
    }
}
