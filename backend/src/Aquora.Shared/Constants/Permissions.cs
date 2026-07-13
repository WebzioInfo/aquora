namespace Aquora.Shared.Constants
{
    public static class Permissions
    {
        // Tenant permissions
        public const string TenantRead = "Permissions.Tenant.Read";
        public const string TenantWrite = "Permissions.Tenant.Write";

        // User/Role permissions
        public const string UsersRead = "Permissions.Users.Read";
        public const string UsersWrite = "Permissions.Users.Write";
        public const string RolesRead = "Permissions.Roles.Read";
        public const string RolesWrite = "Permissions.Roles.Write";

        // Audit Logs
        public const string AuditRead = "Permissions.Audit.Read";

        // Organization Hierarchy permissions
        public const string HierarchyRead = "Permissions.Hierarchy.Read";
        public const string HierarchyWrite = "Permissions.Hierarchy.Write";

        // General
        public const string DashboardRead = "Permissions.Dashboard.Read";
    }
}
