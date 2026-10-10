using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Domain.Entities.Finance;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class SimpleAccountsService : ISimpleAccountsService
    {
        private readonly ITenantDbContext _context;
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ILedgerService _bankLedgerService;

        public SimpleAccountsService(
            ITenantDbContext context,
            IPlatformDbContext platformContext,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext,
            ILedgerService bankLedgerService)
        {
            _context = context;
            _platformContext = platformContext;
            _tenantProvider = tenantProvider;
            _currentUserContext = currentUserContext;
            _bankLedgerService = bankLedgerService;
        }

        private Guid GetTenantId() => _tenantProvider.TenantId;

        private async Task<Guid> GetCompanyIdAsync()
        {
            var tenantId = GetTenantId();
            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            return company?.Id ?? Guid.Empty;
        }

        private async Task<Dictionary<string, string>> ResolveUserNamesBatchAsync(IEnumerable<string> userIds)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var distinctIds = userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
            if (!distinctIds.Any()) return map;

            var validGuids = new List<Guid>();
            foreach (var id in distinctIds)
            {
                if (Guid.TryParse(id, out var g))
                {
                    validGuids.Add(g);
                }
                else
                {
                    map[id] = id;
                }
            }

            if (validGuids.Any())
            {
                var users = await _platformContext.Users
                    .Where(u => validGuids.Contains(u.Id))
                    .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                    .ToListAsync();

                foreach (var u in users)
                {
                    var fullName = $"{u.FirstName} {u.LastName}".Trim();
                    if (string.IsNullOrWhiteSpace(fullName))
                    {
                        fullName = u.Email ?? u.Id.ToString();
                    }
                    map[u.Id.ToString()] = fullName;
                }
            }

            return map;
        }

        // ==========================================
        // 1. EXPENSE MANAGEMENT
        // ==========================================
        public async Task<PagedResult<SimpleExpenseDto>> GetExpensesAsync(
            int pageNumber,
            int pageSize,
            string? search,
            DateTime? startDate,
            DateTime? endDate,
            string? category,
            int? month,
            string? paymentMethod)
        {
            var tenantId = GetTenantId();
            var query = _context.SimpleExpenses
                .Include(e => e.BankAccount)
                .Include(e => e.CashBook)
                .Where(e => e.TenantId == tenantId && !e.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(e =>
                    e.ExpenseNumber.ToLower().Contains(term) ||
                    e.Description.ToLower().Contains(term) ||
                    (e.Vendor != null && e.Vendor.ToLower().Contains(term)) ||
                    e.Category.ToLower().Contains(term));
            }

            if (startDate.HasValue)
            {
                query = query.Where(e => e.ExpenseDate >= startDate.Value.ToUniversalTime());
            }

            if (endDate.HasValue)
            {
                query = query.Where(e => e.ExpenseDate <= endDate.Value.ToUniversalTime());
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(e => e.Category.ToLower() == category.Trim().ToLower());
            }

            if (month.HasValue && month.Value >= 1 && month.Value <= 12)
            {
                query = query.Where(e => e.ExpenseDate.Month == month.Value);
            }

            if (!string.IsNullOrWhiteSpace(paymentMethod))
            {
                query = query.Where(e => e.PaymentMethod.ToLower() == paymentMethod.Trim().ToLower());
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.ExpenseDate)
                .ThenByDescending(e => e.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Resolve user full names for CreatedBy
            var userMap = await ResolveUserNamesBatchAsync(items.Select(e => e.CreatedBy));

            var dtos = items.Select(e =>
            {
                var createdName = userMap.TryGetValue(e.CreatedBy, out var name) ? name : e.CreatedBy;
                var paidFromStr = e.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase) && e.BankAccount != null
                    ? $"{e.BankAccount.BankName} - {e.BankAccount.AccountName}"
                    : e.CashBook != null ? e.CashBook.Name : "Cash";

                return new SimpleExpenseDto
                {
                    Id = e.Id,
                    ExpenseNumber = e.ExpenseNumber,
                    ExpenseDate = e.ExpenseDate,
                    Category = e.Category,
                    Vendor = e.Vendor,
                    Description = e.Description,
                    Amount = e.Amount,
                    PaymentMethod = e.PaymentMethod,
                    BankAccountId = e.BankAccountId,
                    BankAccountName = e.BankAccount != null ? $"{e.BankAccount.BankName} ({e.BankAccount.AccountName})" : null,
                    CashBookId = e.CashBookId,
                    CashBookName = e.CashBook?.Name,
                    PaidFrom = paidFromStr,
                    Notes = e.Notes,
                    CreatedBy = e.CreatedBy,
                    CreatedById = e.CreatedBy,
                    CreatedByName = createdName,
                    CreatedDate = e.CreatedAt
                };
            }).ToList();

            return new PagedResult<SimpleExpenseDto>(dtos, totalCount, pageNumber, pageSize);
        }

        public async Task<SimpleExpenseDto?> GetExpenseByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var expense = await _context.SimpleExpenses
                .Include(e => e.BankAccount)
                .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId && !e.IsDeleted);

            if (expense == null) return null;

            var userMap = await ResolveUserNamesBatchAsync(new[] { expense.CreatedBy });
            var createdName = userMap.TryGetValue(expense.CreatedBy, out var name) ? name : expense.CreatedBy;
            var paidFromStr = expense.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase) && expense.BankAccount != null
                ? $"{expense.BankAccount.BankName} - {expense.BankAccount.AccountName}"
                : expense.CashBook != null ? expense.CashBook.Name : "Cash";

            return new SimpleExpenseDto
            {
                Id = expense.Id,
                ExpenseNumber = expense.ExpenseNumber,
                ExpenseDate = expense.ExpenseDate,
                Category = expense.Category,
                Vendor = expense.Vendor,
                Description = expense.Description,
                Amount = expense.Amount,
                PaymentMethod = expense.PaymentMethod,
                BankAccountId = expense.BankAccountId,
                BankAccountName = expense.BankAccount != null ? $"{expense.BankAccount.BankName} ({expense.BankAccount.AccountName})" : null,
                CashBookId = expense.CashBookId,
                CashBookName = expense.CashBook?.Name,
                PaidFrom = paidFromStr,
                Notes = expense.Notes,
                CreatedBy = expense.CreatedBy,
                CreatedById = expense.CreatedBy,
                CreatedByName = createdName,
                CreatedDate = expense.CreatedAt
            };
        }

        public async Task<SimpleExpenseDto> CreateExpenseAsync(CreateSimpleExpenseRequest request)
        {
            if (request.Amount <= 0)
            {
                throw new ArgumentException("Expense amount must be greater than zero.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

            var randomCode = new Random().Next(1000, 9999);
            var expNumber = $"EXP-{DateTime.UtcNow:yyyyMMdd}-{randomCode}";

            var expense = new SimpleExpense
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                ExpenseNumber = expNumber,
                ExpenseDate = request.ExpenseDate.ToUniversalTime(),
                Category = request.Category.Trim(),
                Vendor = request.Vendor?.Trim(),
                Description = request.Description.Trim(),
                Amount = request.Amount,
                PaymentMethod = request.PaymentMethod.Trim(),
                Notes = request.Notes?.Trim(),
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            // Bank balance validation if PaymentMethod == Bank
            BankAccount? bank = null;
            if (expense.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.BankAccountId.HasValue)
                {
                    throw new ArgumentException("Bank Account is required when Payment Method is Bank.");
                }

                bank = await _context.BankAccounts
                    .FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);

                if (bank == null)
                {
                    throw new ArgumentException("Selected Bank Account was not found.");
                }

                expense.BankAccountId = bank.Id;
                expense.CashBookId = null;
            }
            else if (expense.PaymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.CashBookId.HasValue)
                {
                    throw new ArgumentException("Cash Book is required when Payment Method is Cash.");
                }
                var cashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == request.CashBookId.Value && b.TenantId == tenantId && !b.IsDeleted);
                if (cashBook == null) throw new ArgumentException("Selected Cash Book was not found.");
                expense.CashBookId = cashBook.Id;
                expense.BankAccountId = null;
            }

            _context.SimpleExpenses.Add(expense);
            await _context.SaveChangesAsync();

            if (expense.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase) && expense.BankAccountId.HasValue)
            {
                await _bankLedgerService.RecordTransactionAsync(
                    bankAccountId: expense.BankAccountId.Value,
                    transactionDate: expense.ExpenseDate,
                    referenceNumber: expense.ExpenseNumber,
                    transactionType: "Expense",
                    description: string.IsNullOrWhiteSpace(expense.Description) ? $"Expense ({expense.Category})" : expense.Description,
                    debit: expense.Amount,
                    credit: 0m,
                    relatedEntityId: expense.Id,
                    relatedEntityType: "Expense"
                );

                bank = await _context.BankAccounts
                    .FirstOrDefaultAsync(b => b.Id == expense.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);
            }
            else if (expense.PaymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase) && expense.CashBookId.HasValue)
            {
                await _bankLedgerService.RecordCashTransactionAsync(
                    cashBookId: expense.CashBookId.Value,
                    transactionDate: expense.ExpenseDate,
                    referenceNumber: expense.ExpenseNumber,
                    transactionType: "Expense",
                    description: string.IsNullOrWhiteSpace(expense.Description) ? $"Expense ({expense.Category})" : expense.Description,
                    debit: expense.Amount,
                    credit: 0m,
                    relatedEntityId: expense.Id,
                    relatedEntityType: "Expense"
                );
            }

            var userMap = await ResolveUserNamesBatchAsync(new[] { userId });
            var createdName = userMap.TryGetValue(userId, out var n) ? n : userId;
            var paidFromStr = expense.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase) && bank != null
                ? $"{bank.BankName} - {bank.AccountName}"
                : "Cash";

            return new SimpleExpenseDto
            {
                Id = expense.Id,
                ExpenseNumber = expense.ExpenseNumber,
                ExpenseDate = expense.ExpenseDate,
                Category = expense.Category,
                Vendor = expense.Vendor,
                Description = expense.Description,
                Amount = expense.Amount,
                PaymentMethod = expense.PaymentMethod,
                BankAccountId = expense.BankAccountId,
                BankAccountName = bank != null ? $"{bank.BankName} ({bank.AccountName})" : null,
                CashBookId = expense.CashBookId,
                CashBookName = expense.CashBookId.HasValue ? (await _context.CashBooks.Where(c => c.Id == expense.CashBookId.Value).Select(c => c.Name).FirstOrDefaultAsync()) : null,
                PaidFrom = paidFromStr,
                Notes = expense.Notes,
                CreatedBy = expense.CreatedBy,
                CreatedById = expense.CreatedBy,
                CreatedByName = createdName,
                CreatedDate = expense.CreatedAt
            };
        }

        public async Task<SimpleExpenseDto?> UpdateExpenseAsync(Guid id, UpdateSimpleExpenseRequest request)
        {
            if (request.Amount <= 0)
            {
                throw new ArgumentException("Expense amount must be greater than zero.");
            }

            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var expense = await _context.SimpleExpenses
                .Include(e => e.BankAccount)
                .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId && !e.IsDeleted);

            if (expense == null) return null;

            var oldBankAccountId = expense.BankAccountId;
            var oldAmount = expense.Amount;
            var oldPaymentMethod = expense.PaymentMethod;

            // Update properties
            expense.ExpenseDate = request.ExpenseDate.ToUniversalTime();
            expense.Category = request.Category.Trim();
            expense.Vendor = request.Vendor?.Trim();
            expense.Description = request.Description.Trim();
            expense.Amount = request.Amount;
            expense.PaymentMethod = request.PaymentMethod.Trim();
            expense.Notes = request.Notes?.Trim();
            expense.UpdatedAt = DateTime.UtcNow;
            expense.UpdatedBy = userId;

            BankAccount? newBank = null;
            if (expense.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.BankAccountId.HasValue)
                {
                    throw new ArgumentException("Bank Account is required when Payment Method is Bank.");
                }

                newBank = await _context.BankAccounts
                    .FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);

                if (newBank == null)
                {
                    throw new ArgumentException("Selected Bank Account was not found.");
                }

                expense.BankAccountId = newBank.Id;
                expense.CashBookId = null;
                await _context.SaveChangesAsync();

                await _bankLedgerService.SyncExpenseLedgerAsync(
                    expenseId: expense.Id,
                    bankAccountId: newBank.Id,
                    expenseDate: expense.ExpenseDate,
                    expenseNumber: expense.ExpenseNumber,
                    category: expense.Category,
                    description: expense.Description,
                    amount: expense.Amount,
                    transactionType: "Expense Updated"
                );
            }
            else if (expense.PaymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.CashBookId.HasValue)
                {
                    throw new ArgumentException("Cash Book is required when Payment Method is Cash.");
                }
                var newCashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == request.CashBookId.Value && b.TenantId == tenantId && !b.IsDeleted);
                if (newCashBook == null) throw new ArgumentException("Selected Cash Book was not found.");
                expense.BankAccountId = null;
                expense.CashBookId = newCashBook.Id;
                await _context.SaveChangesAsync();
                await _bankLedgerService.SyncCashExpenseLedgerAsync(expense.Id, newCashBook.Id, expense.ExpenseDate, expense.ExpenseNumber, expense.Category, expense.Description, expense.Amount, "Expense Updated");
            }
            else
            {
                expense.BankAccountId = null;
                expense.CashBookId = null;
                await _context.SaveChangesAsync();
                await _bankLedgerService.RemoveLedgerEntryForEntityAsync(expense.Id, "Expense");
            }

            var userMap = await ResolveUserNamesBatchAsync(new[] { expense.CreatedBy });
            var createdName = userMap.TryGetValue(expense.CreatedBy, out var n) ? n : expense.CreatedBy;
            var paidFromStr = expense.PaymentMethod.Equals("Bank", StringComparison.OrdinalIgnoreCase) && newBank != null
                ? $"{newBank.BankName} - {newBank.AccountName}"
                : "Cash";

            return new SimpleExpenseDto
            {
                Id = expense.Id,
                ExpenseNumber = expense.ExpenseNumber,
                ExpenseDate = expense.ExpenseDate,
                Category = expense.Category,
                Vendor = expense.Vendor,
                Description = expense.Description,
                Amount = expense.Amount,
                PaymentMethod = expense.PaymentMethod,
                BankAccountId = expense.BankAccountId,
                BankAccountName = newBank != null ? $"{newBank.BankName} ({newBank.AccountName})" : null,
                PaidFrom = paidFromStr,
                Notes = expense.Notes,
                CreatedBy = expense.CreatedBy,
                CreatedById = expense.CreatedBy,
                CreatedByName = createdName,
                CreatedDate = expense.CreatedAt
            };
        }

        public async Task<bool> DeleteExpenseAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var expense = await _context.SimpleExpenses
                .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId && !e.IsDeleted);

            if (expense == null) return false;

            // Remove Bank Ledger entry and recalculate bank running balance automatically
            await _bankLedgerService.RemoveLedgerEntryForEntityAsync(expense.Id, "Expense");

            expense.IsDeleted = true;
            expense.DeletedAt = DateTime.UtcNow;
            expense.DeletedBy = userId;

            await _context.SaveChangesAsync();
            return true;
        }

        // ==========================================
        // 1B. EXPENSE CATEGORY MANAGEMENT
        // ==========================================
        public async Task<List<ExpenseCategoryDto>> GetExpenseCategoriesAsync(bool includeInactive = false)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();

            var existingCategories = await _context.ExpenseCategories
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .ToListAsync();

            var defaultCategories = new[]
            {
                "Salary",
                "Electricity",
                "Fuel",
                "Maintenance",
                "Vehicle",
                "Rent",
                "Infrastructure",
                "Purchase Related",
                "Stationary",
                "Tax",
                "Miscellaneous",
                "Office",
                "Travel",
                "Utilities"
            };

            var existingNames = new HashSet<string>(existingCategories.Select(c => c.Name.Trim()), StringComparer.OrdinalIgnoreCase);
            var toAdd = new List<ExpenseCategory>();
            var currentUserId = _currentUserContext.UserId ?? "System";

            foreach (var name in defaultCategories)
            {
                if (!existingNames.Contains(name))
                {
                    var cat = new ExpenseCategory
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        Name = name,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId
                    };
                    toAdd.Add(cat);
                    existingCategories.Add(cat);
                    existingNames.Add(name);
                }
            }

            if (toAdd.Count > 0)
            {
                await _context.ExpenseCategories.AddRangeAsync(toAdd);
                await _context.SaveChangesAsync();
            }

            return existingCategories
                .Where(c => includeInactive || c.IsActive)
                .OrderBy(c => c.Name)
                .Select(c => new ExpenseCategoryDto
                {
                    Id = c.Id,
                    TenantId = c.TenantId,
                    CompanyId = c.CompanyId,
                    Name = c.Name,
                    Description = c.Description,
                    IsActive = c.IsActive,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt
                })
                .ToList();
        }

        public async Task<ExpenseCategoryDto?> GetExpenseCategoryByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var category = await _context.ExpenseCategories
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (category == null) return null;

            return new ExpenseCategoryDto
            {
                Id = category.Id,
                TenantId = category.TenantId,
                CompanyId = category.CompanyId,
                Name = category.Name,
                Description = category.Description,
                IsActive = category.IsActive,
                CreatedAt = category.CreatedAt,
                UpdatedAt = category.UpdatedAt
            };
        }

        public async Task<ExpenseCategoryDto> CreateExpenseCategoryAsync(CreateExpenseCategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Category name is required.");
            }

            var trimmedName = request.Name.Trim();
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var currentUserId = _currentUserContext.UserId ?? "System";

            var existing = await _context.ExpenseCategories
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Name.ToLower() == trimmedName.ToLower());

            if (existing != null)
            {
                if (!existing.IsDeleted)
                {
                    if (!existing.IsActive)
                    {
                        // Reactivate if inactive
                        existing.IsActive = true;
                        existing.Description = request.Description?.Trim() ?? existing.Description;
                        existing.UpdatedAt = DateTime.UtcNow;
                        existing.UpdatedBy = currentUserId;
                        await _context.SaveChangesAsync();

                        return new ExpenseCategoryDto
                        {
                            Id = existing.Id,
                            TenantId = existing.TenantId,
                            CompanyId = existing.CompanyId,
                            Name = existing.Name,
                            Description = existing.Description,
                            IsActive = existing.IsActive,
                            CreatedAt = existing.CreatedAt,
                            UpdatedAt = existing.UpdatedAt
                        };
                    }
                    throw new InvalidOperationException($"Category '{trimmedName}' already exists.");
                }

                // If soft-deleted, restore and activate it
                existing.IsDeleted = false;
                existing.DeletedAt = null;
                existing.DeletedBy = null;
                existing.IsActive = true;
                existing.Name = trimmedName;
                existing.Description = request.Description?.Trim();
                existing.UpdatedAt = DateTime.UtcNow;
                existing.UpdatedBy = currentUserId;
                await _context.SaveChangesAsync();

                return new ExpenseCategoryDto
                {
                    Id = existing.Id,
                    TenantId = existing.TenantId,
                    CompanyId = existing.CompanyId,
                    Name = existing.Name,
                    Description = existing.Description,
                    IsActive = existing.IsActive,
                    CreatedAt = existing.CreatedAt,
                    UpdatedAt = existing.UpdatedAt
                };
            }

            var newCategory = new ExpenseCategory
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = trimmedName,
                Description = request.Description?.Trim(),
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId
            };

            await _context.ExpenseCategories.AddAsync(newCategory);
            await _context.SaveChangesAsync();

            return new ExpenseCategoryDto
            {
                Id = newCategory.Id,
                TenantId = newCategory.TenantId,
                CompanyId = newCategory.CompanyId,
                Name = newCategory.Name,
                Description = newCategory.Description,
                IsActive = newCategory.IsActive,
                CreatedAt = newCategory.CreatedAt,
                UpdatedAt = newCategory.UpdatedAt
            };
        }

        public async Task<ExpenseCategoryDto?> UpdateExpenseCategoryAsync(Guid id, UpdateExpenseCategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Category name is required.");
            }

            var trimmedName = request.Name.Trim();
            var tenantId = GetTenantId();
            var currentUserId = _currentUserContext.UserId ?? "System";

            var category = await _context.ExpenseCategories
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (category == null) return null;

            // Check duplicate name on another record
            var duplicate = await _context.ExpenseCategories
                .AnyAsync(c => c.Id != id && c.TenantId == tenantId && !c.IsDeleted && c.Name.ToLower() == trimmedName.ToLower());

            if (duplicate)
            {
                throw new InvalidOperationException($"Another category with name '{trimmedName}' already exists.");
            }

            category.Name = trimmedName;
            category.Description = request.Description?.Trim();
            category.IsActive = request.IsActive;
            category.UpdatedAt = DateTime.UtcNow;
            category.UpdatedBy = currentUserId;

            await _context.SaveChangesAsync();

            return new ExpenseCategoryDto
            {
                Id = category.Id,
                TenantId = category.TenantId,
                CompanyId = category.CompanyId,
                Name = category.Name,
                Description = category.Description,
                IsActive = category.IsActive,
                CreatedAt = category.CreatedAt,
                UpdatedAt = category.UpdatedAt
            };
        }

        public async Task<bool> DeleteExpenseCategoryAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var currentUserId = _currentUserContext.UserId ?? "System";

            var category = await _context.ExpenseCategories
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (category == null) return false;

            // Check if any expenses are linked to this category name
            var hasExpenses = await _context.SimpleExpenses
                .AnyAsync(e => e.TenantId == tenantId && !e.IsDeleted && e.Category.ToLower() == category.Name.ToLower());

            if (hasExpenses)
            {
                // Soft-deactivate so existing historical expenses are preserved
                category.IsActive = false;
                category.UpdatedAt = DateTime.UtcNow;
                category.UpdatedBy = currentUserId;
            }
            else
            {
                category.IsDeleted = true;
                category.DeletedAt = DateTime.UtcNow;
                category.DeletedBy = currentUserId;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        // ==========================================
        // 2. BANK ACCOUNT MANAGEMENT
        // ==========================================
        public async Task<PagedResult<BankAccountDto>> GetBankAccountsAsync(
            int pageNumber,
            int pageSize,
            string? search,
            string? status)
        {
            var tenantId = GetTenantId();
            var query = _context.BankAccounts
                .Where(b => b.TenantId == tenantId && !b.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(b =>
                    b.BankName.ToLower().Contains(term) ||
                    b.AccountName.ToLower().Contains(term) ||
                    b.AccountNumber.ToLower().Contains(term) ||
                    (b.IFSC != null && b.IFSC.ToLower().Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                var st = status.Trim().ToLower();
                query = query.Where(b => b.Status.ToLower() == st || (st == "active" && b.IsActive));
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(b => b.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var dtos = items.Select(b => new BankAccountDto
            {
                Id = b.Id,
                BankName = b.BankName,
                AccountName = b.AccountName,
                AccountNumber = b.AccountNumber,
                IfscCode = b.IfscCode,
                OpeningBalance = b.OpeningBalance,
                CurrentBalance = b.CurrentBalance,
                Notes = b.Notes,
                Status = b.Status,
                CreatedAt = b.CreatedAt,
                CreatedBy = b.CreatedBy
            }).ToList();

            return new PagedResult<BankAccountDto>(dtos, totalCount, pageNumber, pageSize);
        }

        public async Task<List<BankAccountDropdownDto>> GetBankAccountDropdownAsync()
        {
            var tenantId = GetTenantId();
            var banks = await _context.BankAccounts
                .Where(b => b.TenantId == tenantId && !b.IsDeleted && b.IsActive && b.Status == "Active")
                .OrderBy(b => b.BankName)
                .ThenBy(b => b.AccountName)
                .ToListAsync();

            return banks.Select(b => new BankAccountDropdownDto
            {
                Id = b.Id,
                BankName = b.BankName,
                AccountName = b.AccountName,
                AccountNumber = b.AccountNumber,
                CurrentBalance = b.CurrentBalance
            }).ToList();
        }

        public async Task<BankAccountDto?> GetBankAccountByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var bank = await _context.BankAccounts
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);

            if (bank == null) return null;

            return new BankAccountDto
            {
                Id = bank.Id,
                BankName = bank.BankName,
                AccountName = bank.AccountName,
                AccountNumber = bank.AccountNumber,
                IfscCode = bank.IfscCode,
                OpeningBalance = bank.OpeningBalance,
                CurrentBalance = bank.CurrentBalance,
                Notes = bank.Notes,
                Status = bank.Status,
                CreatedAt = bank.CreatedAt,
                CreatedBy = bank.CreatedBy
            };
        }

        public async Task<BankAccountDto> CreateBankAccountAsync(CreateBankAccountRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

            var bank = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BankName = request.BankName.Trim(),
                AccountName = request.AccountName.Trim(),
                AccountNumber = request.AccountNumber.Trim(),
                IfscCode = request.IfscCode.Trim(),
                OpeningBalance = request.OpeningBalance,
                CurrentBalance = 0m, // RecordTransactionAsync will set current balance to opening balance
                Notes = request.Notes?.Trim(),
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId
            };

            _context.BankAccounts.Add(bank);
            await _context.SaveChangesAsync();

            if (request.OpeningBalance > 0)
            {
                await _bankLedgerService.RecordTransactionAsync(
                    bankAccountId: bank.Id,
                    transactionDate: bank.CreatedAt,
                    referenceNumber: "INIT",
                    transactionType: "Opening Balance",
                    description: "Opening Balance",
                    debit: 0m,
                    credit: request.OpeningBalance,
                    relatedEntityId: bank.Id,
                    relatedEntityType: "BankAccount"
                );

                var refreshedBank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == bank.Id);
                if (refreshedBank != null)
                {
                    bank.CurrentBalance = refreshedBank.CurrentBalance;
                }
            }

            return new BankAccountDto
            {
                Id = bank.Id,
                BankName = bank.BankName,
                AccountName = bank.AccountName,
                AccountNumber = bank.AccountNumber,
                IfscCode = bank.IfscCode,
                OpeningBalance = bank.OpeningBalance,
                CurrentBalance = bank.CurrentBalance,
                Notes = bank.Notes,
                Status = bank.Status,
                CreatedAt = bank.CreatedAt,
                CreatedBy = bank.CreatedBy
            };
        }

        public async Task<BankAccountDto?> UpdateBankAccountAsync(Guid id, UpdateBankAccountRequest request)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var bank = await _context.BankAccounts
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);

            if (bank == null) return null;

            bank.BankName = request.BankName.Trim();
            bank.AccountName = request.AccountName.Trim();
            bank.AccountNumber = request.AccountNumber.Trim();
            bank.IfscCode = request.IfscCode.Trim();
            bank.Notes = request.Notes?.Trim();
            bank.Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim();
            bank.IsActive = bank.Status.Equals("Active", StringComparison.OrdinalIgnoreCase);
            bank.UpdatedAt = DateTime.UtcNow;
            bank.UpdatedBy = userId;

            await _context.SaveChangesAsync();

            return new BankAccountDto
            {
                Id = bank.Id,
                BankName = bank.BankName,
                AccountName = bank.AccountName,
                AccountNumber = bank.AccountNumber,
                IfscCode = bank.IfscCode,
                OpeningBalance = bank.OpeningBalance,
                CurrentBalance = bank.CurrentBalance,
                Notes = bank.Notes,
                Status = bank.Status,
                CreatedAt = bank.CreatedAt,
                CreatedBy = bank.CreatedBy
            };
        }

        public async Task<bool> DeleteBankAccountAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var bank = await _context.BankAccounts
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);

            if (bank == null) return false;

            bank.IsDeleted = true;
            bank.DeletedAt = DateTime.UtcNow;
            bank.DeletedBy = userId;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<PagedResult<CashBookDto>> GetCashBooksAsync(int pageNumber, int pageSize, string? search, string? status)
        {
            var tenantId = GetTenantId();
            var query = _context.CashBooks.Where(b => b.TenantId == tenantId && !b.IsDeleted).AsQueryable();
            if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim().ToLower(); query = query.Where(b => b.Name.ToLower().Contains(term) || (b.Description != null && b.Description.ToLower().Contains(term))); }
            if (!string.IsNullOrWhiteSpace(status)) { var st = status.Trim().ToLower(); query = query.Where(b => b.Status.ToLower() == st); }
            var totalCount = await query.CountAsync();
            var items = await query.OrderByDescending(b => b.CreatedAt).Skip((pageNumber - 1) * pageSize).Take(pageSize).ToListAsync();
            return new PagedResult<CashBookDto>(items.Select(ToCashBookDto).ToList(), totalCount, pageNumber, pageSize);
        }

        public async Task<List<CashBookDropdownDto>> GetCashBookDropdownAsync()
        {
            var tenantId = GetTenantId();
            return await _context.CashBooks.Where(b => b.TenantId == tenantId && !b.IsDeleted && b.IsActive && b.Status == "Active").OrderBy(b => b.Name).Select(b => new CashBookDropdownDto { Id = b.Id, Name = b.Name, CurrentBalance = b.CurrentBalance }).ToListAsync();
        }

        public async Task<CashBookDto?> GetCashBookByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var cashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);
            return cashBook == null ? null : ToCashBookDto(cashBook);
        }

        public async Task<CashBookDto> CreateCashBookAsync(CreateCashBookRequest request)
        {
            var tenantId = GetTenantId(); var companyId = await GetCompanyIdAsync(); var userId = _currentUserContext.UserId ?? "System";
            var cashBook = new CashBook { Id = Guid.NewGuid(), TenantId = tenantId, CompanyId = companyId, Name = request.Name.Trim(), Description = request.Description?.Trim(), OpeningBalance = request.OpeningBalance, CurrentBalance = 0m, Notes = request.Notes?.Trim(), Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(), IsActive = string.IsNullOrWhiteSpace(request.Status) || request.Status.Equals("Active", StringComparison.OrdinalIgnoreCase), CreatedAt = DateTime.UtcNow, CreatedBy = userId };
            _context.CashBooks.Add(cashBook); await _context.SaveChangesAsync();
            if (request.OpeningBalance > 0) { await _bankLedgerService.RecordCashTransactionAsync(cashBook.Id, cashBook.CreatedAt, "INIT", "Opening Balance", "Opening Balance", 0m, request.OpeningBalance, cashBook.Id, "CashBook"); var refreshed = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == cashBook.Id); if (refreshed != null) cashBook.CurrentBalance = refreshed.CurrentBalance; }
            return ToCashBookDto(cashBook);
        }

        public async Task<CashBookDto?> UpdateCashBookAsync(Guid id, UpdateCashBookRequest request)
        {
            var tenantId = GetTenantId(); var userId = _currentUserContext.UserId ?? "System";
            var cashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);
            if (cashBook == null) return null;
            cashBook.Name = request.Name.Trim(); cashBook.Description = request.Description?.Trim(); cashBook.Notes = request.Notes?.Trim(); cashBook.Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(); cashBook.IsActive = cashBook.Status.Equals("Active", StringComparison.OrdinalIgnoreCase); cashBook.UpdatedAt = DateTime.UtcNow; cashBook.UpdatedBy = userId;
            await _context.SaveChangesAsync(); return ToCashBookDto(cashBook);
        }

        public async Task<bool> DeleteCashBookAsync(Guid id)
        {
            var tenantId = GetTenantId(); var userId = _currentUserContext.UserId ?? "System";
            var cashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && !b.IsDeleted);
            if (cashBook == null) return false;
            cashBook.IsDeleted = true; cashBook.DeletedAt = DateTime.UtcNow; cashBook.DeletedBy = userId; await _context.SaveChangesAsync(); return true;
        }

        private static CashBookDto ToCashBookDto(CashBook b) => new CashBookDto { Id = b.Id, Name = b.Name, Description = b.Description, OpeningBalance = b.OpeningBalance, CurrentBalance = b.CurrentBalance, Notes = b.Notes, Status = b.Status, CreatedAt = b.CreatedAt, CreatedBy = b.CreatedBy };

        // ==========================================
        // 3. OWNER INVESTMENT MANAGEMENT
        // ==========================================
        public async Task<List<OwnerDto>> GetOwnersAsync()
        {
            var tenantId = GetTenantId();
            var owners = await _context.Owners
                .Include(o => o.InvestmentTransactions.Where(t => !t.IsDeleted))
                .Where(o => o.TenantId == tenantId && !o.IsDeleted)
                .OrderBy(o => o.Name)
                .ToListAsync();

            return owners.Select(o => new OwnerDto
            {
                Id = o.Id,
                UserId = o.UserId,
                Name = o.Name,
                Phone = o.Phone,
                Email = o.Email,
                OwnershipPercentage = o.OwnershipPercentage,
                InitialInvestment = o.InitialInvestment,
                CurrentInvestment = o.CurrentInvestment,
                Notes = o.Notes,
                CreatedAt = o.CreatedAt,
                CreatedBy = o.CreatedBy,
                Transactions = o.InvestmentTransactions.Select(t => new OwnerInvestmentTransactionDto
                {
                    Id = t.Id,
                    OwnerId = t.OwnerId,
                    OwnerName = o.Name,
                    TransactionDate = t.TransactionDate,
                    Amount = t.Amount,
                    TransactionType = t.TransactionType,
                    Notes = t.Notes,
                    CreatedAt = t.CreatedAt,
                    CreatedBy = t.CreatedBy
                }).OrderByDescending(t => t.TransactionDate).ToList()
            }).ToList();
        }

        public async Task<OwnerDto?> GetOwnerByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var owner = await _context.Owners
                .Include(o => o.InvestmentTransactions.Where(t => !t.IsDeleted))
                .FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenantId && !o.IsDeleted);

            if (owner == null) return null;

            return new OwnerDto
            {
                Id = owner.Id,
                UserId = owner.UserId,
                Name = owner.Name,
                Phone = owner.Phone,
                Email = owner.Email,
                OwnershipPercentage = owner.OwnershipPercentage,
                InitialInvestment = owner.InitialInvestment,
                CurrentInvestment = owner.CurrentInvestment,
                Notes = owner.Notes,
                CreatedAt = owner.CreatedAt,
                CreatedBy = owner.CreatedBy,
                Transactions = owner.InvestmentTransactions.Select(t => new OwnerInvestmentTransactionDto
                {
                    Id = t.Id,
                    OwnerId = t.OwnerId,
                    OwnerName = owner.Name,
                    TransactionDate = t.TransactionDate,
                    Amount = t.Amount,
                    TransactionType = t.TransactionType,
                    Notes = t.Notes,
                    CreatedAt = t.CreatedAt,
                    CreatedBy = t.CreatedBy
                }).OrderByDescending(t => t.TransactionDate).ToList()
            };
        }

        public async Task<OwnerDto> CreateOwnerAsync(CreateOwnerRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

            Guid? linkedUserId = request.UserId;
            if (!linkedUserId.HasValue && !string.IsNullOrWhiteSpace(request.Email))
            {
                var emailNormalized = request.Email.Trim().ToLowerInvariant();
                var matchingUser = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Email.ToLower() == emailNormalized && !u.IsDeleted);
                if (matchingUser != null)
                {
                    linkedUserId = matchingUser.Id;
                }
            }

            if (linkedUserId.HasValue)
            {
                var existingOwner = await _context.Owners
                    .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.UserId == linkedUserId.Value && !o.IsDeleted);
                if (existingOwner != null)
                {
                    throw new InvalidOperationException($"An active owner record already exists for this employee/user.");
                }
            }

            var dest = string.IsNullOrWhiteSpace(request.InvestmentReceivedIn)
                ? "Cash"
                : request.InvestmentReceivedIn.Trim();

            if (!dest.Equals("Cash", StringComparison.OrdinalIgnoreCase) &&
                !dest.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("Investment destination must be either 'Cash' or 'BankAccount'.");
            }

            if (dest.Equals("BankAccount", StringComparison.OrdinalIgnoreCase) && request.InitialInvestment > 0 && !request.BankAccountId.HasValue)
            {
                throw new ArgumentException("A valid bank account must be selected when initial investment is received in Bank Account.");
            }

            async Task<OwnerDto> executeBodyAsync()
            {
                var owner = new Owner
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    UserId = linkedUserId,
                    Name = request.Name.Trim(),
                    Phone = request.Phone.Trim(),
                    Email = request.Email?.Trim(),
                    OwnershipPercentage = request.OwnershipPercentage,
                    InitialInvestment = request.InitialInvestment,
                    CurrentInvestment = request.InitialInvestment, // Starts at initial
                    Notes = request.Notes?.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                };

                _context.Owners.Add(owner);
                await _context.SaveChangesAsync();

                if (dest.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
                {
                    if (request.BankAccountId.HasValue && request.InitialInvestment > 0)
                    {
                        var bankAccount = await _context.BankAccounts
                            .FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);
                        if (bankAccount == null)
                        {
                            throw new KeyNotFoundException("Selected bank account was not found or access is denied.");
                        }

                        await _bankLedgerService.RecordTransactionAsync(
                            bankAccountId: request.BankAccountId.Value,
                            transactionDate: owner.CreatedAt,
                            referenceNumber: $"OWNER-{owner.Id.ToString()[..8].ToUpper()}",
                            transactionType: "Owner Investment",
                            description: $"Initial investment by owner {owner.Name}",
                            debit: 0m,
                            credit: request.InitialInvestment,
                            relatedEntityId: owner.Id,
                            relatedEntityType: "Owner"
                        );
                    }
                }
                else
                {
                    // Cash option: Create dedicated Cashbook for this owner
                    var cashBookBaseName = $"{owner.Name.Trim()} Cashbook";
                    var cashBookName = cashBookBaseName;

                    var existingCashBook = await _context.CashBooks
                        .FirstOrDefaultAsync(c => c.TenantId == tenantId && !c.IsDeleted && c.Name.ToLower() == cashBookName.ToLower());
                    if (existingCashBook != null)
                    {
                        cashBookName = $"{cashBookBaseName} ({owner.Id.ToString()[..4].ToUpper()})";
                    }

                    var cashBook = new CashBook
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        Name = cashBookName,
                        Description = $"Dedicated cashbook for owner {owner.Name.Trim()}",
                        OpeningBalance = 0m,
                        CurrentBalance = 0m,
                        Notes = $"Created automatically for owner {owner.Name}",
                        Status = "Active",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userId
                    };

                    _context.CashBooks.Add(cashBook);
                    await _context.SaveChangesAsync();

                    if (request.InitialInvestment > 0)
                    {
                        await _bankLedgerService.RecordCashTransactionAsync(
                            cashBookId: cashBook.Id,
                            transactionDate: owner.CreatedAt,
                            referenceNumber: $"OWNER-{owner.Id.ToString()[..8].ToUpper()}",
                            transactionType: "Owner Investment",
                            description: $"Initial investment by owner {owner.Name}",
                            debit: 0m,
                            credit: request.InitialInvestment,
                            relatedEntityId: owner.Id,
                            relatedEntityType: "Owner"
                        );
                    }
                }

                return new OwnerDto
                {
                    Id = owner.Id,
                    UserId = owner.UserId,
                    Name = owner.Name,
                    Phone = owner.Phone,
                    Email = owner.Email,
                    OwnershipPercentage = owner.OwnershipPercentage,
                    InitialInvestment = owner.InitialInvestment,
                    CurrentInvestment = owner.CurrentInvestment,
                    Notes = owner.Notes,
                    CreatedAt = owner.CreatedAt,
                    CreatedBy = owner.CreatedBy,
                    Transactions = new List<OwnerInvestmentTransactionDto>()
                };
            }

            if (_context.Database.CurrentTransaction != null || !_context.Database.IsRelational())
            {
                return await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                return await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        var res = await executeBodyAsync();
                        await dbTxn.CommitAsync();
                        return res;
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
        }

        public async Task<OwnerDto?> UpdateOwnerAsync(Guid id, UpdateOwnerRequest request)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var owner = await _context.Owners
                .Include(o => o.InvestmentTransactions.Where(t => !t.IsDeleted))
                .FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenantId && !o.IsDeleted);

            if (owner == null) return null;

            owner.Name = request.Name.Trim();
            owner.Phone = request.Phone.Trim();
            owner.Email = request.Email?.Trim();
            owner.OwnershipPercentage = request.OwnershipPercentage;
            owner.Notes = request.Notes?.Trim();
            owner.UpdatedAt = DateTime.UtcNow;
            owner.UpdatedBy = userId;

            await _context.SaveChangesAsync();

            return new OwnerDto
            {
                Id = owner.Id,
                UserId = owner.UserId,
                Name = owner.Name,
                Phone = owner.Phone,
                Email = owner.Email,
                OwnershipPercentage = owner.OwnershipPercentage,
                InitialInvestment = owner.InitialInvestment,
                CurrentInvestment = owner.CurrentInvestment,
                Notes = owner.Notes,
                CreatedAt = owner.CreatedAt,
                CreatedBy = owner.CreatedBy,
                Transactions = owner.InvestmentTransactions.Select(t => new OwnerInvestmentTransactionDto
                {
                    Id = t.Id,
                    OwnerId = t.OwnerId,
                    OwnerName = owner.Name,
                    TransactionDate = t.TransactionDate,
                    Amount = t.Amount,
                    TransactionType = t.TransactionType,
                    Notes = t.Notes,
                    CreatedAt = t.CreatedAt,
                    CreatedBy = t.CreatedBy
                }).OrderByDescending(t => t.TransactionDate).ToList()
            };
        }

        public async Task<bool> DeleteOwnerAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var owner = await _context.Owners
                .FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenantId && !o.IsDeleted);

            if (owner == null) return false;

            owner.IsDeleted = true;
            owner.DeletedAt = DateTime.UtcNow;
            owner.DeletedBy = userId;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<OwnerInvestmentTransactionDto> AddOwnerTransactionAsync(Guid ownerId, CreateOwnerInvestmentTransactionRequest request)
        {
            if (request.Amount <= 0)
            {
                throw new ArgumentException("Transaction amount must be greater than zero.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

            var owner = await _context.Owners
                .FirstOrDefaultAsync(o => o.Id == ownerId && o.TenantId == tenantId && !o.IsDeleted);

            if (owner == null)
            {
                throw new KeyNotFoundException($"Owner with ID '{ownerId}' was not found.");
            }

            var type = request.TransactionType.Trim();
            if (!type.Equals("Investment", StringComparison.OrdinalIgnoreCase) &&
                !type.Equals("Withdrawal", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("Transaction type must be 'Investment' or 'Withdrawal'.");
            }

            // Create Transaction Record
            var txn = new OwnerInvestmentTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                OwnerId = owner.Id,
                TransactionDate = request.TransactionDate.ToUniversalTime(),
                Amount = request.Amount,
                TransactionType = type.Equals("Investment", StringComparison.OrdinalIgnoreCase) ? "Investment" : "Withdrawal",
                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId
            };

            // Update Owner's Current Investment
            if (txn.TransactionType == "Investment")
            {
                owner.CurrentInvestment += request.Amount;
            }
            else
            {
                owner.CurrentInvestment -= request.Amount;
            }

            _context.OwnerInvestmentTransactions.Add(txn);
            await _context.SaveChangesAsync();

            return new OwnerInvestmentTransactionDto
            {
                Id = txn.Id,
                OwnerId = owner.Id,
                OwnerName = owner.Name,
                TransactionDate = txn.TransactionDate,
                Amount = txn.Amount,
                TransactionType = txn.TransactionType,
                Notes = txn.Notes,
                CreatedAt = txn.CreatedAt,
                CreatedBy = txn.CreatedBy
            };
        }

        public async Task<List<OwnerSummaryDto>> GetOwnerSummariesAsync()
        {
            var tenantId = GetTenantId();
            var owners = await _context.Owners
                .Include(o => o.InvestmentTransactions.Where(t => !t.IsDeleted))
                .Where(o => o.TenantId == tenantId && !o.IsDeleted)
                .ToListAsync();

            return owners.Select(o =>
            {
                var totalInvested = o.InvestmentTransactions
                    .Where(t => t.TransactionType == "Investment")
                    .Sum(t => t.Amount);

                var totalWithdrawn = o.InvestmentTransactions
                    .Where(t => t.TransactionType == "Withdrawal")
                    .Sum(t => t.Amount);

                return new OwnerSummaryDto
                {
                    Id = o.Id,
                    Name = o.Name,
                    OwnershipPercentage = o.OwnershipPercentage,
                    InitialInvestment = o.InitialInvestment,
                    CurrentInvestment = o.CurrentInvestment,
                    TotalInvested = o.InitialInvestment + totalInvested,
                    TotalWithdrawn = totalWithdrawn
                };
            }).ToList();
        }

        public async Task<CompanyTotalInvestmentDto> GetCompanyTotalInvestmentAsync()
        {
            var tenantId = GetTenantId();
            var owners = await _context.Owners
                .Include(o => o.InvestmentTransactions.Where(t => !t.IsDeleted))
                .Where(o => o.TenantId == tenantId && !o.IsDeleted)
                .ToListAsync();

            var totalInitial = owners.Sum(o => o.InitialInvestment);
            var totalCurrent = owners.Sum(o => o.CurrentInvestment);

            var totalAdditional = owners
                .SelectMany(o => o.InvestmentTransactions)
                .Where(t => t.TransactionType == "Investment")
                .Sum(t => t.Amount);

            var totalWithdrawn = owners
                .SelectMany(o => o.InvestmentTransactions)
                .Where(t => t.TransactionType == "Withdrawal")
                .Sum(t => t.Amount);

            return new CompanyTotalInvestmentDto
            {
                TotalInitialInvestment = totalInitial,
                TotalCurrentInvestment = totalCurrent,
                TotalAdditionalInvested = totalAdditional,
                TotalWithdrawn = totalWithdrawn,
                TotalOwners = owners.Count
            };
        }

        // ==========================================
        // 4. ASSET SUMMARY
        // ==========================================
        public async Task<AssetSummaryDto> GetAssetSummaryAsync()
        {
            var tenantId = GetTenantId();

            // 1. Finished Goods from Products
            var products = await _context.Products
                .Where(p => !p.IsDeleted)
                .ToListAsync();

            decimal totalFgQty = products.Sum(p => p.CurrentStock);
            decimal totalFgValue = products.Sum(p =>
            {
                decimal unitPrice = p.SellingPrice > 0 ? p.SellingPrice : (p.CostPrice > 0 ? p.CostPrice : 0m);
                return p.CurrentStock * unitPrice;
            });
            decimal avgFgUnitCost = totalFgQty > 0 ? (totalFgValue / totalFgQty) : 0m;

            // 2. Raw Materials
            var rawMaterials = await _context.RawMaterials
                .Where(r => r.TenantId == tenantId && !r.IsDeleted)
                .ToListAsync();

            decimal totalRmQty = rawMaterials.Sum(r => r.CurrentStock);
            decimal totalRmValue = rawMaterials.Sum(r => r.CurrentStock * r.CostPerUnit);
            decimal avgRmUnitCost = totalRmQty > 0 ? (totalRmValue / totalRmQty) : 0m;

            return new AssetSummaryDto
            {
                FinishedGoods = new CategoryAssetSummaryDto
                {
                    TotalQuantity = totalFgQty,
                    AverageUnitCost = Math.Round(avgFgUnitCost, 2),
                    TotalStockValue = totalFgValue
                },
                RawMaterials = new CategoryAssetSummaryDto
                {
                    TotalQuantity = totalRmQty,
                    AverageUnitCost = Math.Round(avgRmUnitCost, 2),
                    TotalStockValue = totalRmValue
                },
                TotalFinishedGoodsValue = totalFgValue,
                TotalRawMaterialValue = totalRmValue,
                CombinedInventoryValue = totalFgValue + totalRmValue
            };
        }

        // ==========================================
        // 5. DASHBOARD SUMMARY API
        // ==========================================
        public async Task<SimpleAccountsDashboardSummaryDto> GetDashboardSummaryAsync()
        {
            var tenantId = GetTenantId();
            var today = DateTime.UtcNow.Date;
            var startOfMonth = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var startOfWeek = today.AddDays(-(int)(today.DayOfWeek == DayOfWeek.Sunday ? 6 : (int)today.DayOfWeek - 1));

            // Expenses
            var expenses = await _context.SimpleExpenses
                .Where(e => e.TenantId == tenantId && !e.IsDeleted)
                .ToListAsync();

            var todaysExpense = expenses.Where(e => e.ExpenseDate.Date == today).Sum(e => e.Amount);
            var thisWeekExpense = expenses.Where(e => e.ExpenseDate.Date >= startOfWeek).Sum(e => e.Amount);
            var thisMonthExpense = expenses.Where(e => e.ExpenseDate >= startOfMonth).Sum(e => e.Amount);
            var totalExpensesSum = expenses.Sum(e => e.Amount);

            // Sales & Outstanding
            var sales = await _context.SalesTransactions
                .Where(s => s.TenantId == tenantId && !s.IsDeleted)
                .ToListAsync();

            var outstandingSales = sales.Sum(s => s.OutstandingAmount);

            var todaysSales = sales
                .Where(s => s.TransactionType == "Sales Dispatch" && s.TransactionDate.Date == today)
                .Sum(s => s.TotalAmount > 0 ? s.TotalAmount : (s.Cases * 15m));

            var todaysReturn = sales
                .Where(s => s.TransactionType == "Customer Return" && s.TransactionDate.Date == today)
                .Sum(s => s.ReturnedAmount > 0 ? s.ReturnedAmount : (s.Cases * 15m));

            var todaysDamage = sales
                .Where(s => s.TransactionType == "Damage" && s.TransactionDate.Date == today)
                .Sum(s => s.DamageCost > 0 ? s.DamageCost : (s.Cases * 15m));

            // Bank Accounts
            var activeBanks = await _context.BankAccounts
                .Where(b => b.TenantId == tenantId && !b.IsDeleted && b.IsActive && b.Status == "Active")
                .ToListAsync();

            var totalBankBalance = activeBanks.Sum(b => b.CurrentBalance);

            // Cash Balance: authoritative from CashBooks if available, otherwise ledger derived
            var activeCashBooks = await _context.CashBooks
                .Where(c => c.TenantId == tenantId && !c.IsDeleted && c.Status == "Active")
                .ToListAsync();

            decimal cashBalance;
            if (activeCashBooks.Any())
            {
                cashBalance = activeCashBooks.Sum(c => c.CurrentBalance);
            }
            else
            {
                var cashSalesReceived = sales.Where(s => s.TransactionType == "Sales Dispatch").Sum(s => s.AmountReceived);
                var cashExpensesSum = expenses.Where(e => e.PaymentMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase)).Sum(e => e.Amount);
                cashBalance = cashSalesReceived - cashExpensesSum;
            }

            // Assets
            var assetSummary = await GetAssetSummaryAsync();

            // Company Investment
            var owners = await _context.Owners
                .Where(o => o.TenantId == tenantId && !o.IsDeleted)
                .ToListAsync();

            var companyInvestment = owners.Sum(o => o.CurrentInvestment);

            return new SimpleAccountsDashboardSummaryDto
            {
                TodaysExpense = todaysExpense,
                ThisWeekExpense = thisWeekExpense,
                ThisMonthExpense = thisMonthExpense,
                OutstandingSales = outstandingSales,
                TodaysSales = todaysSales,
                TodaysReturn = todaysReturn,
                TodaysDamage = todaysDamage,
                FinishedGoodsValue = assetSummary.TotalFinishedGoodsValue,
                RawMaterialValue = assetSummary.TotalRawMaterialValue,
                TotalInventoryValue = assetSummary.CombinedInventoryValue,
                CompanyInvestment = companyInvestment,
                CashBalance = cashBalance < 0 ? 0m : cashBalance,
                TotalBankBalance = totalBankBalance,
                TotalExpenses = totalExpensesSum
            };
        }
    }
}
