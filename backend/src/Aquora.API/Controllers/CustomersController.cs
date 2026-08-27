using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Customers;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class CustomersController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ILedgerService _ledgerService;
        private readonly ILogger<CustomersController> _logger;

        public CustomersController(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext,
            ILedgerService ledgerService,
            ILogger<CustomersController> logger)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _ledgerService = ledgerService;
            _logger = logger;
        }

        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "Owner", "CompanyOwner", "SuperAdmin", "PlatformAdmin", "CompanyAdmin", "Accountant", "Admin", "Manager" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _healedCustomerSchemas = new();

        private async Task EnsureCustomerColumnsAsync()
        {
            var schema = string.IsNullOrWhiteSpace(_tenantContext.SchemaName)
                ? "public"
                : _tenantContext.SchemaName;

            if (_healedCustomerSchemas.ContainsKey(schema)) return;

            try
            {
                var sql = $@"
                    ALTER TABLE ""{schema}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Price"" numeric NOT NULL DEFAULT 0;
                    ALTER TABLE ""{schema}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Discount"" numeric NOT NULL DEFAULT 0;
                ";
                await _tenantContext.Database.ExecuteSqlRawAsync(sql);
                _healedCustomerSchemas.TryAdd(schema, true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to self-heal Customers table columns for schema {Schema}", schema);
            }
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<CustomerDto>>>> GetCustomers(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? searchTerm = null,
            [FromQuery] string? customerType = null,
            [FromQuery] string? status = null,
            [FromQuery] string? state = null,
            [FromQuery] string? district = null,
            [FromQuery] string? city = null,
            [FromQuery] string? sortBy = "newest")
        {
            try
            {
                await EnsureCustomerColumnsAsync();
                var query = _tenantContext.Customers.Where(c => !c.IsDeleted).AsQueryable();

                // Tenant Isolation
                var tenantId = _currentUserContext.TenantId;
                query = query.Where(c => c.TenantId == tenantId);

                // Filters
                if (!string.IsNullOrWhiteSpace(customerType))
                {
                    query = query.Where(c => c.CustomerType.ToLower() == customerType.Trim().ToLower());
                }

                if (!string.IsNullOrWhiteSpace(status))
                {
                    query = query.Where(c => c.Status.ToLower() == status.Trim().ToLower());
                }

                if (!string.IsNullOrWhiteSpace(state))
                {
                    query = query.Where(c => c.State.ToLower() == state.Trim().ToLower());
                }

                if (!string.IsNullOrWhiteSpace(district))
                {
                    query = query.Where(c => c.District.ToLower() == district.Trim().ToLower());
                }

                if (!string.IsNullOrWhiteSpace(city))
                {
                    query = query.Where(c => c.City.ToLower() == city.Trim().ToLower());
                }

                // Search (Customer Name, Business Name, Phone, GST, Customer Code)
                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var term = searchTerm.Trim().ToLower();
                    query = query.Where(c => 
                        c.CustomerName.ToLower().Contains(term) ||
                        (c.BusinessName != null && c.BusinessName.ToLower().Contains(term)) ||
                        c.Phone.ToLower().Contains(term) ||
                        (c.GSTNumber != null && c.GSTNumber.ToLower().Contains(term)) ||
                        c.CustomerCode.ToLower().Contains(term)
                    );
                }

                // Sorting
                query = sortBy?.ToLower() switch
                {
                    "oldest" => query.OrderBy(c => c.CreatedAt),
                    "name" => query.OrderBy(c => c.CustomerName),
                    "balance" => query.OrderByDescending(c => c.OpeningBalance),
                    _ => query.OrderByDescending(c => c.CreatedAt) // newest
                };

                var totalCount = await query.CountAsync();
                var items = await query
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .Select(c => new CustomerDto
                    {
                        Id = c.Id,
                        CompanyId = c.CompanyId,
                        CustomerCode = c.CustomerCode,
                        CustomerType = c.CustomerType,
                        CustomerName = c.CustomerName,
                        BusinessName = c.BusinessName,
                        ContactPerson = c.ContactPerson,
                        Phone = c.Phone,
                        AlternatePhone = c.AlternatePhone,
                        Email = c.Email,
                        GSTNumber = c.GSTNumber,
                        PANNumber = c.PANNumber,
                        BusinessType = c.BusinessType,
                        GSTState = c.GSTState,
                        AddressLine1 = c.AddressLine1,
                        AddressLine2 = c.AddressLine2,
                        City = c.City,
                        District = c.District,
                        State = c.State,
                        Country = c.Country,
                        PinCode = c.PinCode,
                        OpeningBalance = c.OpeningBalance,
                        BalanceType = c.BalanceType,
                        CreditLimit = c.CreditLimit,
                        PaymentTerms = c.PaymentTerms,
                        Status = c.Status,
                        IsActive = c.IsActive,
                        Remarks = c.Remarks,
                        CreatedAt = c.CreatedAt,
                        UpdatedAt = c.UpdatedAt,
                        WhatsApp = c.WhatsApp,
                        Website = c.Website,
                        PhotoUrl = c.PhotoUrl,
                        BusinessRegistration = c.BusinessRegistration,
                        BusinessCategory = c.BusinessCategory,
                        Industry = c.Industry,
                        TradeLicense = c.TradeLicense,
                        TaxExempt = c.TaxExempt,
                        AddressesJson = c.AddressesJson,
                        PriceList = c.PriceList,
                        DiscountGroup = c.DiscountGroup,
                        Price = c.Price,
                        Discount = c.Discount,
                        TaxCategory = c.TaxCategory,
                        OutstandingPlaceholder = c.OutstandingPlaceholder,
                        LedgerPlaceholder = c.LedgerPlaceholder,
                        AccountingPlaceholder = c.AccountingPlaceholder,
                        DistributorType = c.DistributorType,
                        CommissionPercentage = c.CommissionPercentage,
                        MonthlySalary = c.MonthlySalary,
                        SecurityDeposit = c.SecurityDeposit,
                        AssignedRoute = c.AssignedRoute,
                        AssignedVehicle = c.AssignedVehicle,
                        AssignedDriver = c.AssignedDriver,
                        AssignedSalesExecutive = c.AssignedSalesExecutive,
                        DefaultDeliveryPriority = c.DefaultDeliveryPriority,
                        WorkingArea = c.WorkingArea,
                        WorkingDays = c.WorkingDays,
                        JarDeposit = c.JarDeposit,
                        OutstandingJars = c.OutstandingJars,
                        MaxJarLimit = c.MaxJarLimit,
                        ReservedEmptyJars = c.ReservedEmptyJars,
                        PreferredJarBrand = c.PreferredJarBrand,
                        PreferredCapMaterial = c.PreferredCapMaterial,
                        SealRequired = c.SealRequired,
                        PreferredDeliveryWindow = c.PreferredDeliveryWindow,
                        EmergencyDelivery = c.EmergencyDelivery,
                        PriorityCustomer = c.PriorityCustomer,
                        PreferredProductsJson = c.PreferredProductsJson,
                        PreferredDeliveryTime = c.PreferredDeliveryTime,
                        DeliveryFrequency = c.DeliveryFrequency,
                        ContactsJson = c.ContactsJson,
                        DocumentsJson = c.DocumentsJson
                    })
                    .ToListAsync();

                var pagedResult = new PagedResult<CustomerDto>(items, totalCount, pageNumber, pageSize);
                return Success(pagedResult, "Customers retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<PagedResult<CustomerDto>>(ex.Message, "Failed to retrieve customers.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<CustomerDto>>> GetCustomerById(Guid id)
        {
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

                if (customer == null)
                {
                    return NotFound(ApiResponse<CustomerDto>.CreateFailure("Customer not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var dto = new CustomerDto
                {
                    Id = customer.Id,
                    CompanyId = customer.CompanyId,
                    CustomerCode = customer.CustomerCode,
                    CustomerType = customer.CustomerType,
                    CustomerName = customer.CustomerName,
                    BusinessName = customer.BusinessName,
                    ContactPerson = customer.ContactPerson,
                    Phone = customer.Phone,
                    AlternatePhone = customer.AlternatePhone,
                    Email = customer.Email,
                    GSTNumber = customer.GSTNumber,
                    PANNumber = customer.PANNumber,
                    BusinessType = customer.BusinessType,
                    GSTState = customer.GSTState,
                    AddressLine1 = customer.AddressLine1,
                    AddressLine2 = customer.AddressLine2,
                    City = customer.City,
                    District = customer.District,
                    State = customer.State,
                    Country = customer.Country,
                    PinCode = customer.PinCode,
                    OpeningBalance = customer.OpeningBalance,
                    BalanceType = customer.BalanceType,
                    CreditLimit = customer.CreditLimit,
                    PaymentTerms = customer.PaymentTerms,
                    Status = customer.Status,
                    IsActive = customer.IsActive,
                    Remarks = customer.Remarks,
                    CreatedAt = customer.CreatedAt,
                    UpdatedAt = customer.UpdatedAt,
                    WhatsApp = customer.WhatsApp,
                    Website = customer.Website,
                    PhotoUrl = customer.PhotoUrl,
                    BusinessRegistration = customer.BusinessRegistration,
                    BusinessCategory = customer.BusinessCategory,
                    Industry = customer.Industry,
                    TradeLicense = customer.TradeLicense,
                    TaxExempt = customer.TaxExempt,
                    AddressesJson = customer.AddressesJson,
                    PriceList = customer.PriceList,
                    DiscountGroup = customer.DiscountGroup,
                    Price = customer.Price,
                    Discount = customer.Discount,
                    TaxCategory = customer.TaxCategory,
                    OutstandingPlaceholder = customer.OutstandingPlaceholder,
                    LedgerPlaceholder = customer.LedgerPlaceholder,
                    AccountingPlaceholder = customer.AccountingPlaceholder,
                    DistributorType = customer.DistributorType,
                    CommissionPercentage = customer.CommissionPercentage,
                    MonthlySalary = customer.MonthlySalary,
                    SecurityDeposit = customer.SecurityDeposit,
                    AssignedRoute = customer.AssignedRoute,
                    AssignedVehicle = customer.AssignedVehicle,
                    AssignedDriver = customer.AssignedDriver,
                    AssignedSalesExecutive = customer.AssignedSalesExecutive,
                    DefaultDeliveryPriority = customer.DefaultDeliveryPriority,
                    WorkingArea = customer.WorkingArea,
                    WorkingDays = customer.WorkingDays,
                    JarDeposit = customer.JarDeposit,
                    OutstandingJars = customer.OutstandingJars,
                    MaxJarLimit = customer.MaxJarLimit,
                    ReservedEmptyJars = customer.ReservedEmptyJars,
                    PreferredJarBrand = customer.PreferredJarBrand,
                    PreferredCapMaterial = customer.PreferredCapMaterial,
                    SealRequired = customer.SealRequired,
                    PreferredDeliveryWindow = customer.PreferredDeliveryWindow,
                    EmergencyDelivery = customer.EmergencyDelivery,
                    PriorityCustomer = customer.PriorityCustomer,
                    PreferredProductsJson = customer.PreferredProductsJson,
                    PreferredDeliveryTime = customer.PreferredDeliveryTime,
                    DeliveryFrequency = customer.DeliveryFrequency,
                    ContactsJson = customer.ContactsJson,
                    DocumentsJson = customer.DocumentsJson
                };

                return Success(dto, "Customer details retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<CustomerDto>(ex.Message, "Failed to retrieve customer.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<CustomerDto>>> CreateCustomer([FromBody] CreateCustomerRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<CustomerDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var tenantId = _currentUserContext.TenantId;

                // Lookup dynamic company context to resolve CompanyId foreign key constraint
                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Tenant configurations are incomplete. Company is missing.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // 1. Core validations
                if (string.IsNullOrWhiteSpace(request.CustomerName))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Customer Name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.Phone))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Phone number is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.CustomerType))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Customer Type is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.PaymentTerms))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Please select Payment Terms.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (request.OpeningBalance < 0)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Opening balance cannot be negative.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // 2. Conditional validations for B2B
                var isB2B = request.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase);
                if (isB2B)
                {
                    if (string.IsNullOrWhiteSpace(request.GSTNumber))
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("GST number is required for B2B customers.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                    if (string.IsNullOrWhiteSpace(request.PANNumber))
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("PAN number is required for B2B customers.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                // 3. Duplicate checks
                var phoneExists = await _tenantContext.Customers.AnyAsync(c => c.TenantId == tenantId && c.Phone == request.Phone.Trim() && !c.IsDeleted);
                if (phoneExists)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("A customer with this phone number already exists within this tenant.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (isB2B && !string.IsNullOrWhiteSpace(request.GSTNumber))
                {
                    var gstExists = await _tenantContext.Customers.AnyAsync(c => c.TenantId == tenantId && c.GSTNumber == request.GSTNumber.Trim() && !c.IsDeleted);
                    if (gstExists)
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("A customer with this GST number already exists within this tenant.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                // 4. Safely generate read-only tenant-specific Customer Code
                var maxCustomer = await _tenantContext.Customers
                    .IgnoreQueryFilters()
                    .Where(c => c.TenantId == tenantId && c.CustomerCode.StartsWith("CUS-"))
                    .OrderByDescending(c => c.CustomerCode)
                    .FirstOrDefaultAsync();

                int nextNumber = 1;
                if (maxCustomer != null)
                {
                    var parts = maxCustomer.CustomerCode.Split('-');
                    if (parts.Length == 2 && int.TryParse(parts[1], out int lastNum))
                    {
                        nextNumber = lastNum + 1;
                    }
                }
                var generatedCustomerCode = $"CUS-{nextNumber:D5}";

                // 5. Initialize Customer Entity
                var customer = new Customer
                {
                    TenantId = tenantId,
                    CompanyId = company.Id,
                    CustomerCode = generatedCustomerCode,
                    CustomerType = request.CustomerType.Trim(),
                    CustomerName = request.CustomerName.Trim(),
                    BusinessName = isB2B ? request.BusinessName?.Trim() : (request.BusinessName?.Trim() ?? null),
                    ContactPerson = request.ContactPerson?.Trim(),
                    Phone = request.Phone.Trim(),
                    AlternatePhone = request.AlternatePhone?.Trim(),
                    Email = request.Email?.Trim(),
                    GSTNumber = isB2B ? request.GSTNumber?.Trim() : null,
                    PANNumber = isB2B ? request.PANNumber?.Trim() : null,
                    BusinessType = isB2B ? request.BusinessType?.Trim() : null,
                    GSTState = isB2B ? request.GSTState?.Trim() : null,
                    AddressLine1 = request.AddressLine1.Trim(),
                    AddressLine2 = request.AddressLine2?.Trim(),
                    City = request.City?.Trim() ?? "",
                    District = request.District?.Trim() ?? "",
                    State = request.State?.Trim() ?? "",
                    Country = request.Country?.Trim() ?? "",
                    PinCode = request.PinCode?.Trim() ?? "",
                    OpeningBalance = request.OpeningBalance,
                    BalanceType = request.BalanceType.Trim(),
                    CreditLimit = request.CreditLimit,
                    PaymentTerms = string.IsNullOrWhiteSpace(request.PaymentTerms) ? "COD" : request.PaymentTerms.Trim(),
                    Status = request.Status.Trim(),
                    IsActive = request.IsActive,
                    Remarks = request.Remarks?.Trim(),
                    WhatsApp = request.WhatsApp?.Trim(),
                    Website = request.Website?.Trim(),
                    PhotoUrl = request.PhotoUrl?.Trim(),
                    BusinessRegistration = request.BusinessRegistration?.Trim(),
                    BusinessCategory = request.BusinessCategory?.Trim(),
                    Industry = request.Industry?.Trim(),
                    TradeLicense = request.TradeLicense?.Trim(),
                    TaxExempt = request.TaxExempt,
                    AddressesJson = request.AddressesJson,
                    PriceList = string.IsNullOrWhiteSpace(request.PriceList) ? null : request.PriceList.Trim(),
                    DiscountGroup = string.IsNullOrWhiteSpace(request.DiscountGroup) ? null : request.DiscountGroup.Trim(),
                    Price = request.Price,
                    Discount = request.Discount,
                    TaxCategory = string.IsNullOrWhiteSpace(request.TaxCategory) ? null : request.TaxCategory.Trim(),
                    OutstandingPlaceholder = request.OutstandingPlaceholder,
                    LedgerPlaceholder = request.LedgerPlaceholder?.Trim(),
                    AccountingPlaceholder = request.AccountingPlaceholder?.Trim(),
                    DistributorType = request.DistributorType?.Trim(),
                    CommissionPercentage = request.CommissionPercentage,
                    MonthlySalary = request.MonthlySalary,
                    SecurityDeposit = request.SecurityDeposit,
                    AssignedRoute = request.AssignedRoute?.Trim(),
                    AssignedVehicle = request.AssignedVehicle?.Trim(),
                    AssignedDriver = request.AssignedDriver?.Trim(),
                    AssignedSalesExecutive = request.AssignedSalesExecutive?.Trim(),
                    DefaultDeliveryPriority = request.DefaultDeliveryPriority?.Trim() ?? "Normal",
                    WorkingArea = request.WorkingArea?.Trim(),
                    WorkingDays = request.WorkingDays?.Trim(),
                    JarDeposit = request.JarDeposit,
                    OutstandingJars = request.OutstandingJars,
                    MaxJarLimit = request.MaxJarLimit,
                    ReservedEmptyJars = request.ReservedEmptyJars,
                    PreferredJarBrand = request.PreferredJarBrand?.Trim(),
                    PreferredCapMaterial = request.PreferredCapMaterial?.Trim(),
                    SealRequired = request.SealRequired,
                    PreferredDeliveryWindow = request.PreferredDeliveryWindow?.Trim(),
                    EmergencyDelivery = request.EmergencyDelivery,
                    PriorityCustomer = request.PriorityCustomer,
                    PreferredProductsJson = request.PreferredProductsJson,
                    PreferredDeliveryTime = request.PreferredDeliveryTime?.Trim(),
                    DeliveryFrequency = request.DeliveryFrequency?.Trim(),
                    ContactsJson = request.ContactsJson,
                    DocumentsJson = request.DocumentsJson
                };

                _tenantContext.Customers.Add(customer);
                await _tenantContext.SaveChangesAsync();

                var dto = new CustomerDto
                {
                    Id = customer.Id,
                    CompanyId = customer.CompanyId,
                    CustomerCode = customer.CustomerCode,
                    CustomerType = customer.CustomerType,
                    CustomerName = customer.CustomerName,
                    BusinessName = customer.BusinessName,
                    ContactPerson = customer.ContactPerson,
                    Phone = customer.Phone,
                    AlternatePhone = customer.AlternatePhone,
                    Email = customer.Email,
                    GSTNumber = customer.GSTNumber,
                    PANNumber = customer.PANNumber,
                    BusinessType = customer.BusinessType,
                    GSTState = customer.GSTState,
                    AddressLine1 = customer.AddressLine1,
                    AddressLine2 = customer.AddressLine2,
                    City = customer.City,
                    District = customer.District,
                    State = customer.State,
                    Country = customer.Country,
                    PinCode = customer.PinCode,
                    OpeningBalance = customer.OpeningBalance,
                    BalanceType = customer.BalanceType,
                    CreditLimit = customer.CreditLimit,
                    PaymentTerms = customer.PaymentTerms,
                    Status = customer.Status,
                    IsActive = customer.IsActive,
                    Remarks = customer.Remarks,
                    CreatedAt = customer.CreatedAt,
                    WhatsApp = customer.WhatsApp,
                    Website = customer.Website,
                    PhotoUrl = customer.PhotoUrl,
                    BusinessRegistration = customer.BusinessRegistration,
                    BusinessCategory = customer.BusinessCategory,
                    Industry = customer.Industry,
                    TradeLicense = customer.TradeLicense,
                    TaxExempt = customer.TaxExempt,
                    AddressesJson = customer.AddressesJson,
                    PriceList = customer.PriceList,
                    DiscountGroup = customer.DiscountGroup,
                    Price = customer.Price,
                    Discount = customer.Discount,
                    TaxCategory = customer.TaxCategory,
                    OutstandingPlaceholder = customer.OutstandingPlaceholder,
                    LedgerPlaceholder = customer.LedgerPlaceholder,
                    AccountingPlaceholder = customer.AccountingPlaceholder,
                    DistributorType = customer.DistributorType,
                    CommissionPercentage = customer.CommissionPercentage,
                    MonthlySalary = customer.MonthlySalary,
                    SecurityDeposit = customer.SecurityDeposit,
                    AssignedRoute = customer.AssignedRoute,
                    AssignedVehicle = customer.AssignedVehicle,
                    AssignedDriver = customer.AssignedDriver,
                    AssignedSalesExecutive = customer.AssignedSalesExecutive,
                    DefaultDeliveryPriority = customer.DefaultDeliveryPriority,
                    WorkingArea = customer.WorkingArea,
                    WorkingDays = customer.WorkingDays,
                    JarDeposit = customer.JarDeposit,
                    OutstandingJars = customer.OutstandingJars,
                    MaxJarLimit = customer.MaxJarLimit,
                    ReservedEmptyJars = customer.ReservedEmptyJars,
                    PreferredJarBrand = customer.PreferredJarBrand,
                    PreferredCapMaterial = customer.PreferredCapMaterial,
                    SealRequired = customer.SealRequired,
                    PreferredDeliveryWindow = customer.PreferredDeliveryWindow,
                    EmergencyDelivery = customer.EmergencyDelivery,
                    PriorityCustomer = customer.PriorityCustomer,
                    PreferredProductsJson = customer.PreferredProductsJson,
                    PreferredDeliveryTime = customer.PreferredDeliveryTime,
                    DeliveryFrequency = customer.DeliveryFrequency,
                    ContactsJson = customer.ContactsJson,
                    DocumentsJson = customer.DocumentsJson
                };

                return Success(dto, "Customer created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating customer {CustomerName}", request.CustomerName);
                var isPaymentTermsIssue = (ex.InnerException?.Message.Contains("PaymentTerms", StringComparison.OrdinalIgnoreCase) == true) || ex.Message.Contains("PaymentTerms", StringComparison.OrdinalIgnoreCase);
                if (isPaymentTermsIssue)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Please select Payment Terms before continuing.", "Validation Error", HttpContext.TraceIdentifier));
                }
                return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Unable to save customer. Please review the highlighted fields and try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<CustomerDto>>> UpdateCustomer(Guid id, [FromBody] UpdateCustomerRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<CustomerDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var tenantId = _currentUserContext.TenantId;
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

                if (customer == null)
                {
                    return NotFound(ApiResponse<CustomerDto>.CreateFailure("Customer not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // 1. Core validations
                if (string.IsNullOrWhiteSpace(request.CustomerName))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Customer name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.Phone))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Phone number is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.CustomerType))
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Customer type is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (request.OpeningBalance < 0)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Opening balance cannot be negative.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // 2. Conditional validations B2B
                var isB2B = request.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase);
                if (isB2B)
                {
                    if (string.IsNullOrWhiteSpace(request.GSTNumber))
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("GST number is required for B2B customers.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                    if (string.IsNullOrWhiteSpace(request.PANNumber))
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("PAN number is required for B2B customers.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                // 3. Duplicate checks (excluding this customer ID)
                if (customer.Phone != request.Phone.Trim())
                {
                    var phoneExists = await _tenantContext.Customers.AnyAsync(c => c.TenantId == tenantId && c.Phone == request.Phone.Trim() && c.Id != id && !c.IsDeleted);
                    if (phoneExists)
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("A customer with this phone number already exists within this tenant.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                if (isB2B && !string.IsNullOrWhiteSpace(request.GSTNumber) && customer.GSTNumber != request.GSTNumber.Trim())
                {
                    var gstExists = await _tenantContext.Customers.AnyAsync(c => c.TenantId == tenantId && c.GSTNumber == request.GSTNumber.Trim() && c.Id != id && !c.IsDeleted);
                    if (gstExists)
                    {
                        return BadRequest(ApiResponse<CustomerDto>.CreateFailure("A customer with this GST number already exists within this tenant.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                // 4. Update fields (CustomerCode and TenantId remain read-only)
                customer.CustomerType = request.CustomerType.Trim();
                customer.CustomerName = request.CustomerName.Trim();
                customer.BusinessName = isB2B ? request.BusinessName?.Trim() : (request.BusinessName?.Trim() ?? null);
                customer.ContactPerson = request.ContactPerson?.Trim();
                customer.Phone = request.Phone.Trim();
                customer.AlternatePhone = request.AlternatePhone?.Trim();
                customer.Email = request.Email?.Trim();
                customer.GSTNumber = isB2B ? request.GSTNumber?.Trim() : null;
                customer.PANNumber = isB2B ? request.PANNumber?.Trim() : null;
                customer.BusinessType = isB2B ? request.BusinessType?.Trim() : null;
                customer.GSTState = isB2B ? request.GSTState?.Trim() : null;
                customer.AddressLine1 = request.AddressLine1.Trim();
                customer.AddressLine2 = request.AddressLine2?.Trim();
                customer.City = request.City?.Trim() ?? "";
                customer.District = request.District?.Trim() ?? "";
                customer.State = request.State?.Trim() ?? "";
                customer.Country = request.Country?.Trim() ?? "";
                customer.PinCode = request.PinCode?.Trim() ?? "";
                customer.OpeningBalance = request.OpeningBalance;
                customer.BalanceType = request.BalanceType.Trim();
                customer.CreditLimit = request.CreditLimit;
                if (!string.IsNullOrWhiteSpace(request.PaymentTerms))
                {
                    customer.PaymentTerms = request.PaymentTerms.Trim();
                }
                customer.Status = request.Status.Trim();
                customer.IsActive = request.IsActive;
                customer.Remarks = request.Remarks?.Trim();
                customer.WhatsApp = request.WhatsApp?.Trim();
                customer.Website = request.Website?.Trim();
                customer.PhotoUrl = request.PhotoUrl?.Trim();
                customer.BusinessRegistration = request.BusinessRegistration?.Trim();
                customer.BusinessCategory = request.BusinessCategory?.Trim();
                customer.Industry = request.Industry?.Trim();
                customer.TradeLicense = request.TradeLicense?.Trim();
                customer.TaxExempt = request.TaxExempt;
                customer.AddressesJson = request.AddressesJson;
                customer.PriceList = string.IsNullOrWhiteSpace(request.PriceList) ? null : request.PriceList.Trim();
                customer.DiscountGroup = string.IsNullOrWhiteSpace(request.DiscountGroup) ? null : request.DiscountGroup.Trim();
                customer.Price = request.Price;
                customer.Discount = request.Discount;
                customer.TaxCategory = string.IsNullOrWhiteSpace(request.TaxCategory) ? null : request.TaxCategory.Trim();
                customer.OutstandingPlaceholder = request.OutstandingPlaceholder;
                customer.LedgerPlaceholder = request.LedgerPlaceholder?.Trim();
                customer.AccountingPlaceholder = request.AccountingPlaceholder?.Trim();
                customer.DistributorType = request.DistributorType?.Trim();
                customer.CommissionPercentage = request.CommissionPercentage;
                customer.MonthlySalary = request.MonthlySalary;
                customer.SecurityDeposit = request.SecurityDeposit;
                customer.AssignedRoute = request.AssignedRoute?.Trim();
                customer.AssignedVehicle = request.AssignedVehicle?.Trim();
                customer.AssignedDriver = request.AssignedDriver?.Trim();
                customer.AssignedSalesExecutive = request.AssignedSalesExecutive?.Trim();
                customer.DefaultDeliveryPriority = request.DefaultDeliveryPriority?.Trim() ?? "Normal";
                customer.WorkingArea = request.WorkingArea?.Trim();
                customer.WorkingDays = request.WorkingDays?.Trim();
                customer.JarDeposit = request.JarDeposit;
                customer.OutstandingJars = request.OutstandingJars;
                customer.MaxJarLimit = request.MaxJarLimit;
                customer.ReservedEmptyJars = request.ReservedEmptyJars;
                customer.PreferredJarBrand = request.PreferredJarBrand?.Trim();
                customer.PreferredCapMaterial = request.PreferredCapMaterial?.Trim();
                customer.SealRequired = request.SealRequired;
                customer.PreferredDeliveryWindow = request.PreferredDeliveryWindow?.Trim();
                customer.EmergencyDelivery = request.EmergencyDelivery;
                customer.PriorityCustomer = request.PriorityCustomer;
                customer.PreferredProductsJson = request.PreferredProductsJson;
                customer.PreferredDeliveryTime = request.PreferredDeliveryTime?.Trim();
                customer.DeliveryFrequency = request.DeliveryFrequency?.Trim();
                customer.ContactsJson = request.ContactsJson;
                customer.DocumentsJson = request.DocumentsJson;

                _tenantContext.Customers.Update(customer);
                await _tenantContext.SaveChangesAsync();

                var dto = new CustomerDto
                {
                    Id = customer.Id,
                    CompanyId = customer.CompanyId,
                    CustomerCode = customer.CustomerCode,
                    CustomerType = customer.CustomerType,
                    CustomerName = customer.CustomerName,
                    BusinessName = customer.BusinessName,
                    ContactPerson = customer.ContactPerson,
                    Phone = customer.Phone,
                    AlternatePhone = customer.AlternatePhone,
                    Email = customer.Email,
                    GSTNumber = customer.GSTNumber,
                    PANNumber = customer.PANNumber,
                    BusinessType = customer.BusinessType,
                    GSTState = customer.GSTState,
                    AddressLine1 = customer.AddressLine1,
                    AddressLine2 = customer.AddressLine2,
                    City = customer.City,
                    District = customer.District,
                    State = customer.State,
                    Country = customer.Country,
                    PinCode = customer.PinCode,
                    OpeningBalance = customer.OpeningBalance,
                    BalanceType = customer.BalanceType,
                    CreditLimit = customer.CreditLimit,
                    PaymentTerms = customer.PaymentTerms,
                    Status = customer.Status,
                    IsActive = customer.IsActive,
                    Remarks = customer.Remarks,
                    CreatedAt = customer.CreatedAt,
                    UpdatedAt = customer.UpdatedAt,
                    WhatsApp = customer.WhatsApp,
                    Website = customer.Website,
                    PhotoUrl = customer.PhotoUrl,
                    BusinessRegistration = customer.BusinessRegistration,
                    BusinessCategory = customer.BusinessCategory,
                    Industry = customer.Industry,
                    TradeLicense = customer.TradeLicense,
                    TaxExempt = customer.TaxExempt,
                    AddressesJson = customer.AddressesJson,
                    PriceList = customer.PriceList,
                    DiscountGroup = customer.DiscountGroup,
                    Price = customer.Price,
                    Discount = customer.Discount,
                    TaxCategory = customer.TaxCategory,
                    OutstandingPlaceholder = customer.OutstandingPlaceholder,
                    LedgerPlaceholder = customer.LedgerPlaceholder,
                    AccountingPlaceholder = customer.AccountingPlaceholder,
                    DistributorType = customer.DistributorType,
                    CommissionPercentage = customer.CommissionPercentage,
                    MonthlySalary = customer.MonthlySalary,
                    SecurityDeposit = customer.SecurityDeposit,
                    AssignedRoute = customer.AssignedRoute,
                    AssignedVehicle = customer.AssignedVehicle,
                    AssignedDriver = customer.AssignedDriver,
                    AssignedSalesExecutive = customer.AssignedSalesExecutive,
                    DefaultDeliveryPriority = customer.DefaultDeliveryPriority,
                    WorkingArea = customer.WorkingArea,
                    WorkingDays = customer.WorkingDays,
                    JarDeposit = customer.JarDeposit,
                    OutstandingJars = customer.OutstandingJars,
                    MaxJarLimit = customer.MaxJarLimit,
                    ReservedEmptyJars = customer.ReservedEmptyJars,
                    PreferredJarBrand = customer.PreferredJarBrand,
                    PreferredCapMaterial = customer.PreferredCapMaterial,
                    SealRequired = customer.SealRequired,
                    PreferredDeliveryWindow = customer.PreferredDeliveryWindow,
                    EmergencyDelivery = customer.EmergencyDelivery,
                    PriorityCustomer = customer.PriorityCustomer,
                    PreferredProductsJson = customer.PreferredProductsJson,
                    PreferredDeliveryTime = customer.PreferredDeliveryTime,
                    DeliveryFrequency = customer.DeliveryFrequency,
                    ContactsJson = customer.ContactsJson,
                    DocumentsJson = customer.DocumentsJson
                };

                return Success(dto, "Customer updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating customer {CustomerId}", id);
                var isPaymentTermsIssue = (ex.InnerException?.Message.Contains("PaymentTerms", StringComparison.OrdinalIgnoreCase) == true) || ex.Message.Contains("PaymentTerms", StringComparison.OrdinalIgnoreCase);
                if (isPaymentTermsIssue)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Please select Payment Terms before continuing.", "Validation Error", HttpContext.TraceIdentifier));
                }
                return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Unable to save customer. Please review the highlighted fields and try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteCustomer(Guid id)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<bool>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var tenantId = _currentUserContext.TenantId;
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

                if (customer == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Customer not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                _tenantContext.Customers.Remove(customer); // Triggers soft delete dynamically
                await _tenantContext.SaveChangesAsync();

                return Success(true, "Customer deleted successfully (soft deleted).");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to delete customer.");
            }
        }

        [HttpPost("{id}/payments")]
        public async Task<ActionResult<ApiResponse<CustomerDto>>> RecordCustomerPayment(Guid id, [FromBody] RecordCustomerPaymentRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<CustomerDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            if (request == null || request.Amount <= 0)
            {
                return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Payment amount must be greater than zero.", "Validation Error", HttpContext.TraceIdentifier));
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
            }

            using var dbTransaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);
                if (customer == null)
                {
                    return NotFound(ApiResponse<CustomerDto>.CreateFailure("Customer not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // Check authoritative outstanding balance
                if (customer.OutstandingPlaceholder <= 0)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Customer has no outstanding balance to collect.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (request.Amount > customer.OutstandingPlaceholder)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure($"Collection amount (₹{request.Amount:N2}) cannot exceed current customer outstanding balance of ₹{customer.OutstandingPlaceholder:N2}.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var paymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Cash" : request.PaymentMethod.Trim();
                var isBank = IsBankPaymentMethod(paymentMethod);
                var isCash = paymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase);

                if (!isCash && !isBank)
                {
                    return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Collection payment method must be Cash or Bank.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (isBank && (!request.BankAccountId.HasValue || request.BankAccountId.Value == Guid.Empty))
                {
                    var firstBank = await _tenantContext.BankAccounts.FirstOrDefaultAsync(b => b.TenantId == tenantId && !b.IsDeleted);
                    if (firstBank != null) request.BankAccountId = firstBank.Id;
                    else return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Company Bank Account is required for bank/electronic payment.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (paymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase) && (!request.CashBookId.HasValue || request.CashBookId.Value == Guid.Empty))
                {
                    var firstCash = await _tenantContext.CashBooks.FirstOrDefaultAsync(c => c.TenantId == tenantId && !c.IsDeleted);
                    if (firstCash != null) request.CashBookId = firstCash.Id;
                    else return BadRequest(ApiResponse<CustomerDto>.CreateFailure("Company Cash Register is required for cash payment.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var randomCode = new Random().Next(1000, 9999);
                var paymentRef = string.IsNullOrWhiteSpace(request.ReferenceNumber) ? $"PAY-{DateTime.UtcNow:yyyyMMdd}-{randomCode}" : request.ReferenceNumber.Trim();

                // Update Customer Balance
                customer.OutstandingPlaceholder = Math.Max(0m, customer.OutstandingPlaceholder - request.Amount);

                // Append Customer Ledger Entry
                AppendCustomerLedgerEntry(customer, "Customer Payment Received", paymentRef, 0m, request.Amount, customer.OutstandingPlaceholder);

                // FIFO allocation to customer's open credit sales transactions
                var openSales = await _tenantContext.SalesTransactions
                    .Where(t => t.TenantId == tenantId && t.CustomerId == id && !t.IsDeleted && (t.PaymentStatus == "Pending" || t.PaymentStatus == "Partial" || t.PaymentStatus == "Partially Paid" || t.OutstandingAmount > 0))
                    .OrderBy(t => t.TransactionDate)
                    .ThenBy(t => t.CreatedAt)
                    .ToListAsync();

                decimal remainingPayment = request.Amount;
                foreach (var sale in openSales)
                {
                    if (remainingPayment <= 0) break;

                    decimal saleTotal = sale.TotalAmount;
                    decimal currentPaid = sale.AmountReceived;
                    decimal currentOutstanding = sale.OutstandingAmount > 0 ? sale.OutstandingAmount : Math.Max(0m, saleTotal - currentPaid);

                    if (currentOutstanding <= 0) continue;

                    decimal alloc = Math.Min(remainingPayment, currentOutstanding);
                    sale.AmountReceived += alloc;
                    sale.OutstandingAmount = Math.Max(0m, saleTotal - sale.AmountReceived);
                    sale.PaymentStatus = sale.OutstandingAmount <= 0 ? "Paid" : "Partially Paid";

                    _tenantContext.SalesTransactions.Update(sale);
                    remainingPayment -= alloc;
                }

                _tenantContext.Customers.Update(customer);
                await _tenantContext.SaveChangesAsync();

                // Post to Bank Ledger or Cash Register
                if (isBank && request.BankAccountId.HasValue)
                {
                    await _ledgerService.RecordTransactionAsync(
                        request.BankAccountId.Value,
                        request.PaymentDate != default ? request.PaymentDate : DateTime.UtcNow,
                        paymentRef,
                        "Customer Collection",
                        $"Customer payment received from {customer.CustomerName}. Ref: {paymentRef}",
                        0m,
                        request.Amount,
                        customer.Id,
                        "CustomerPayment");
                }
                else if (paymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase) && request.CashBookId.HasValue)
                {
                    await _ledgerService.RecordCashTransactionAsync(
                        request.CashBookId.Value,
                        request.PaymentDate != default ? request.PaymentDate : DateTime.UtcNow,
                        paymentRef,
                        "Customer Collection",
                        $"Customer payment received from {customer.CustomerName}. Ref: {paymentRef}",
                        0m,
                        request.Amount,
                        customer.Id,
                        "CustomerPayment");
                }

                await dbTransaction.CommitAsync();

                var dto = MapCustomerToDto(customer);
                return Success(dto, $"Payment of ₹{request.Amount:N2} recorded successfully for {customer.CustomerName}.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Failed to record customer payment for customer {CustomerId}", id);
                return Failure<CustomerDto>(ex.Message, "Failed to record customer payment.");
            }
        }

        private static bool IsBankPaymentMethod(string? paymentMethod)
        {
            var method = paymentMethod?.Trim();
            return method != null &&
                (method.Equals("Bank", StringComparison.OrdinalIgnoreCase) ||
                 method.Equals("BankAccount", StringComparison.OrdinalIgnoreCase) ||
                 method.Equals("UPI", StringComparison.OrdinalIgnoreCase) ||
                 method.Equals("Cheque", StringComparison.OrdinalIgnoreCase));
        }

        private void AppendCustomerLedgerEntry(Customer customer, string type, string refNo, decimal debit, decimal credit, decimal balance)
        {
            var list = new List<CustomerLedgerEntry>();
            if (!string.IsNullOrWhiteSpace(customer.LedgerPlaceholder))
            {
                try
                {
                    list = System.Text.Json.JsonSerializer.Deserialize<List<CustomerLedgerEntry>>(customer.LedgerPlaceholder) ?? new List<CustomerLedgerEntry>();
                }
                catch {}
            }

            list.Add(new CustomerLedgerEntry
            {
                Date = DateTime.UtcNow,
                TransactionType = type,
                Reference = refNo,
                Debit = debit,
                Credit = credit,
                Balance = balance
            });

            customer.LedgerPlaceholder = System.Text.Json.JsonSerializer.Serialize(list);
        }

        private CustomerDto MapCustomerToDto(Customer customer)
        {
            return new CustomerDto
            {
                Id = customer.Id,
                CompanyId = customer.CompanyId,
                CustomerCode = customer.CustomerCode,
                CustomerType = customer.CustomerType,
                CustomerName = customer.CustomerName,
                BusinessName = customer.BusinessName,
                ContactPerson = customer.ContactPerson,
                Phone = customer.Phone,
                AlternatePhone = customer.AlternatePhone,
                Email = customer.Email,
                GSTNumber = customer.GSTNumber,
                PANNumber = customer.PANNumber,
                BusinessType = customer.BusinessType,
                GSTState = customer.GSTState,
                AddressLine1 = customer.AddressLine1,
                AddressLine2 = customer.AddressLine2,
                City = customer.City,
                District = customer.District,
                State = customer.State,
                Country = customer.Country,
                PinCode = customer.PinCode,
                OpeningBalance = customer.OpeningBalance,
                BalanceType = customer.BalanceType,
                CreditLimit = customer.CreditLimit,
                PaymentTerms = customer.PaymentTerms,
                Status = customer.Status,
                IsActive = customer.IsActive,
                Remarks = customer.Remarks,
                CreatedAt = customer.CreatedAt,
                UpdatedAt = customer.UpdatedAt,
                WhatsApp = customer.WhatsApp,
                Website = customer.Website,
                PhotoUrl = customer.PhotoUrl,
                BusinessRegistration = customer.BusinessRegistration,
                BusinessCategory = customer.BusinessCategory,
                Industry = customer.Industry,
                TradeLicense = customer.TradeLicense,
                TaxExempt = customer.TaxExempt,
                AddressesJson = customer.AddressesJson,
                PriceList = customer.PriceList,
                DiscountGroup = customer.DiscountGroup,
                Price = customer.Price,
                Discount = customer.Discount,
                TaxCategory = customer.TaxCategory,
                OutstandingPlaceholder = customer.OutstandingPlaceholder,
                LedgerPlaceholder = customer.LedgerPlaceholder,
                AccountingPlaceholder = customer.AccountingPlaceholder,
                DistributorType = customer.DistributorType,
                CommissionPercentage = customer.CommissionPercentage,
                MonthlySalary = customer.MonthlySalary,
                SecurityDeposit = customer.SecurityDeposit,
                AssignedRoute = customer.AssignedRoute,
                AssignedVehicle = customer.AssignedVehicle,
                AssignedDriver = customer.AssignedDriver,
                AssignedSalesExecutive = customer.AssignedSalesExecutive,
                DefaultDeliveryPriority = customer.DefaultDeliveryPriority,
                WorkingArea = customer.WorkingArea,
                WorkingDays = customer.WorkingDays,
                JarDeposit = customer.JarDeposit,
                OutstandingJars = customer.OutstandingJars,
                MaxJarLimit = customer.MaxJarLimit,
                ReservedEmptyJars = customer.ReservedEmptyJars,
                PreferredJarBrand = customer.PreferredJarBrand,
                PreferredCapMaterial = customer.PreferredCapMaterial,
                SealRequired = customer.SealRequired,
                PreferredDeliveryWindow = customer.PreferredDeliveryWindow,
                EmergencyDelivery = customer.EmergencyDelivery,
                PriorityCustomer = customer.PriorityCustomer,
                PreferredProductsJson = customer.PreferredProductsJson,
                PreferredDeliveryTime = customer.PreferredDeliveryTime,
                DeliveryFrequency = customer.DeliveryFrequency,
                ContactsJson = customer.ContactsJson,
                DocumentsJson = customer.DocumentsJson
            };
        }
    }

    public class CustomerLedgerEntry
    {
        public DateTime Date { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public string Reference { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal Balance { get; set; }
    }

    public class RecordCustomerPaymentRequest
    {
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = "Cash";
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
    }
}
