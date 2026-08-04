using Microsoft.Extensions.DependencyInjection;
using FluentValidation;
using System.Reflection;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;

namespace Aquora.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            // Register all FluentValidation validators from this assembly
            services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

            // Register services
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ITenantService, TenantService>();
            services.AddScoped<ICompanyOnboardingService, CompanyOnboardingService>();
            services.AddScoped<IHierarchyService, HierarchyService>();
            services.AddScoped<ISchemaNameGenerator, SchemaNameGenerator>();
            services.AddScoped<IInventoryMovementService, InventoryMovementService>();
            services.AddScoped<IPriceListService, PriceListService>();
            services.AddScoped<IDiscountGroupService, DiscountGroupService>();

            services.AddScoped<IProductionService, ProductionService>();
            services.AddScoped<IFinanceService, FinanceService>();
            services.AddScoped<IBusinessFinanceService, BusinessFinanceService>();
            services.AddScoped<IStationConfigurationService, StationConfigurationService>();
            services.AddScoped<ISimpleAccountsService, SimpleAccountsService>();
            services.AddScoped<IVendorService, VendorService>();
            services.AddScoped<IPurchaseService, PurchaseService>();
            services.AddScoped<ILedgerService, BankLedgerService>();
            services.AddScoped<IBankLedgerService>(sp => sp.GetRequiredService<ILedgerService>());
            services.AddScoped<IHealthService, HealthService>();
            return services;
        }
    }
}
