using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Finance;
using Aquora.Domain.Entities.Finance;

using System.ComponentModel.DataAnnotations;
using Aquora.Application.Interfaces;

namespace Aquora.Application.Services
{
    public class FinanceService : IFinanceService
    {
        private readonly ITenantDbContext _context;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _userProvider;

        public FinanceService(ITenantDbContext context, ITenantProvider tenantProvider, ICurrentUserContext userProvider)
        {
            _context = context;
            _tenantProvider = tenantProvider;
            _userProvider = userProvider;
        }

        
        private async Task<Guid> GetCompanyIdAsync()
        {
            var company = await _context.Companies.FirstOrDefaultAsync();
            if (company == null) throw new InvalidOperationException("No company found for this tenant.");
            return company.Id;
        }

        public async Task<List<AccountGroupDto>> GetAccountGroupsAsync()
        {
            var groups = await _context.AccountGroups
                .OrderBy(g => g.Code)
                .ToListAsync();
                
            return groups.Select(g => new AccountGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Type = g.Type,
                Code = g.Code,
                ParentGroupId = g.ParentGroupId
            }).ToList();
        }

        public async Task<List<AccountDto>> GetAccountsAsync()
        {
            var accounts = await _context.Accounts
                .Include(a => a.AccountGroup)
                .OrderBy(a => a.AccountCode)
                .ToListAsync();
                
            return accounts.Select(a => new AccountDto
            {
                Id = a.Id,
                AccountName = a.AccountName,
                AccountCode = a.AccountCode,
                AccountGroupId = a.AccountGroupId,
                GroupName = a.AccountGroup?.Name ?? "",
                OpeningBalance = a.OpeningBalance,
                BalanceType = a.BalanceType,
                CurrentBalance = a.CurrentBalance,
                IsActive = a.IsActive
            }).ToList();
        }

        public async Task<AccountDto> CreateAccountAsync(string name, string code, Guid groupId, decimal openingBalance, string balanceType)
        {
            var exists = await _context.Accounts.AnyAsync(a => a.AccountCode == code);
            if (exists) throw new ValidationException("Account code already exists.");
            
            var account = new Account
            {
                TenantId = _tenantProvider.TenantId,
                CompanyId = (await _context.Companies.FirstAsync()).Id,
                AccountName = name,
                AccountCode = code,
                AccountGroupId = groupId,
                OpeningBalance = openingBalance,
                BalanceType = balanceType,
                CurrentBalance = openingBalance,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userProvider.UserId.ToString()
            };
            
            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();
            
            return new AccountDto { Id = account.Id, AccountName = account.AccountName };
        }

        public async Task<List<JournalEntryDto>> GetJournalEntriesAsync(DateTime? startDate, DateTime? endDate)
        {
            var query = _context.JournalEntries
                .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
                .AsQueryable();
                
            if (startDate.HasValue) query = query.Where(j => j.TransactionDate >= startDate.Value);
            if (endDate.HasValue) query = query.Where(j => j.TransactionDate <= endDate.Value);
            
            var entries = await query.OrderByDescending(j => j.TransactionDate).ToListAsync();
            
            return entries.Select(MapToDto).ToList();
        }

        public async Task<JournalEntryDto> GetJournalEntryAsync(Guid id)
        {
            var entry = await _context.JournalEntries
                .Include(j => j.Lines)
                .ThenInclude(l => l.Account)
                .FirstOrDefaultAsync(j => j.Id == id);
                
            if (entry == null) throw new KeyNotFoundException("Journal entry not found");
            return MapToDto(entry);
        }

        public async Task<JournalEntryDto> CreateJournalEntryAsync(CreateJournalEntryRequest request)
        {
            if (request.Lines.Count < 2) throw new ValidationException("Journal entry must have at least two lines.");
            
            decimal totalDebit = request.Lines.Sum(l => l.DebitAmount);
            decimal totalCredit = request.Lines.Sum(l => l.CreditAmount);
            
            if (totalDebit != totalCredit) throw new ValidationException($"Debits ({totalDebit}) must equal Credits ({totalCredit}).");
            
            using var transaction = await _context.Database.BeginTransactionAsync();
            
            var entry = new JournalEntry
            {
                TenantId = _tenantProvider.TenantId,
                CompanyId = (await _context.Companies.FirstAsync()).Id,
                VoucherNumber = $"JV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000,9999)}",
                TransactionDate = request.TransactionDate,
                VoucherType = request.VoucherType,
                ReferenceNumber = request.ReferenceNumber,
                Remarks = request.Remarks,
                TotalAmount = totalDebit,
                Status = "Posted",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userProvider.UserId.ToString()
            };
            
            foreach (var line in request.Lines)
            {
                var account = await _context.Accounts.FindAsync(line.AccountId);
                if (account == null) throw new KeyNotFoundException($"Account {line.AccountId} not found");
                
                entry.Lines.Add(new JournalEntryLine
                {
                    TenantId = _tenantProvider.TenantId,
                    CompanyId = (await _context.Companies.FirstAsync()).Id,
                    AccountId = line.AccountId,
                    Description = line.Description,
                    DebitAmount = line.DebitAmount,
                    CreditAmount = line.CreditAmount
                });
                
                // Update running balance (simplified logic, assumes Dr positive for Assets, Cr positive for Liabs)
                if (line.DebitAmount > 0)
                {
                    if (account.BalanceType == "Dr") account.CurrentBalance += line.DebitAmount;
                    else account.CurrentBalance -= line.DebitAmount;
                }
                if (line.CreditAmount > 0)
                {
                    if (account.BalanceType == "Cr") account.CurrentBalance += line.CreditAmount;
                    else account.CurrentBalance -= line.CreditAmount;
                }
            }
            
            _context.JournalEntries.Add(entry);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            
            return MapToDto(entry);
        }

        public Task PostJournalEntryAsync(Guid id)
        {
            throw new NotImplementedException();
        }

        public async Task SeedDefaultChartOfAccountsAsync()
        {
            if (await _context.AccountGroups.AnyAsync()) return;
            
            var assets = new AccountGroup { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, Name = "Assets", Type = "Asset", Code = "1000", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var liabilities = new AccountGroup { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, Name = "Liabilities", Type = "Liability", Code = "2000", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var equity = new AccountGroup { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, Name = "Equity", Type = "Equity", Code = "3000", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var revenue = new AccountGroup { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, Name = "Revenue", Type = "Revenue", Code = "4000", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var expenses = new AccountGroup { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, Name = "Expenses", Type = "Expense", Code = "5000", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            
            _context.AccountGroups.AddRange(assets, liabilities, equity, revenue, expenses);
            await _context.SaveChangesAsync();
            
            var cash = new Account { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, AccountName = "Cash", AccountCode = "1001", AccountGroupId = assets.Id, BalanceType = "Dr", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var bank = new Account { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, AccountName = "Bank Account", AccountCode = "1002", AccountGroupId = assets.Id, BalanceType = "Dr", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var sales = new Account { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, AccountName = "Sales Revenue", AccountCode = "4001", AccountGroupId = revenue.Id, BalanceType = "Cr", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var electricity = new Account { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, AccountName = "Electricity Expense", AccountCode = "5001", AccountGroupId = expenses.Id, BalanceType = "Dr", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            var accountsReceivable = new Account { TenantId = _tenantProvider.TenantId, CompanyId = (await _context.Companies.FirstAsync()).Id, AccountName = "Accounts Receivable", AccountCode = "1200", AccountGroupId = assets.Id, BalanceType = "Dr", CreatedAt = DateTime.UtcNow, CreatedBy = "System" };
            
            _context.Accounts.AddRange(cash, bank, sales, electricity, accountsReceivable);
            await _context.SaveChangesAsync();
        }
        

        public async Task<List<AssetDto>> GetAssetsAsync()
        {
            var assets = await _context.Assets.OrderByDescending(a => a.PurchaseDate).ToListAsync();
            return assets.Select(a => new AssetDto { Id = a.Id, Name = a.AssetName, AssetType = a.AssetCategory, PurchasePrice = a.PurchasePrice, PurchaseDate = a.PurchaseDate, CurrentValue = a.CurrentValue }).ToList();
        }

        public async Task<AssetDto> CreateAssetAsync(string name, string type, decimal price, DateTime date)
        {
            var companyId = await GetCompanyIdAsync();
            var asset = new Asset { TenantId = _tenantProvider.TenantId, CompanyId = companyId, AssetName = name, AssetCategory = type, PurchasePrice = price, PurchaseDate = date, CurrentValue = price, CreatedAt = DateTime.UtcNow, CreatedBy = _userProvider.UserId.ToString() };
            _context.Assets.Add(asset);
            await _context.SaveChangesAsync();
            return new AssetDto { Id = asset.Id, Name = asset.AssetName, AssetType = asset.AssetCategory, PurchasePrice = asset.PurchasePrice, PurchaseDate = asset.PurchaseDate, CurrentValue = asset.CurrentValue };
        }

        public async Task<List<ExpenseRecordDto>> GetExpensesAsync()
        {
            var expenses = await _context.ExpenseRecords.OrderByDescending(e => e.ExpenseDate).ToListAsync();
            return expenses.Select(e => new ExpenseRecordDto { Id = e.Id, Description = e.Remarks ?? string.Empty, Category = e.Category, Amount = e.Amount, ExpenseDate = e.ExpenseDate, Status = e.Status }).ToList();
        }

        public async Task<ExpenseRecordDto> CreateExpenseAsync(string desc, string category, decimal amount, DateTime date)
        {
            var companyId = await GetCompanyIdAsync();
            var expense = new ExpenseRecord { TenantId = _tenantProvider.TenantId, CompanyId = companyId, Remarks = desc, Category = category, Amount = amount, ExpenseDate = date, Status = "Posted", CreatedAt = DateTime.UtcNow, CreatedBy = _userProvider.UserId.ToString() };
            _context.ExpenseRecords.Add(expense);
            await _context.SaveChangesAsync();
            return new ExpenseRecordDto { Id = expense.Id, Description = expense.Remarks ?? string.Empty, Category = expense.Category, Amount = expense.Amount, ExpenseDate = expense.ExpenseDate, Status = expense.Status };
        }

        private JournalEntryDto MapToDto(JournalEntry j)
        {
            return new JournalEntryDto
            {
                Id = j.Id,
                VoucherNumber = j.VoucherNumber,
                TransactionDate = j.TransactionDate,
                VoucherType = j.VoucherType,
                ReferenceNumber = j.ReferenceNumber,
                Remarks = j.Remarks,
                TotalAmount = j.TotalAmount,
                Status = j.Status,
                Lines = j.Lines?.Select(l => new JournalEntryLineDto
                {
                    Id = l.Id,
                    AccountId = l.AccountId,
                    AccountName = l.Account?.AccountName ?? "",
                    Description = l.Description,
                    DebitAmount = l.DebitAmount,
                    CreditAmount = l.CreditAmount
                }).ToList() ?? new List<JournalEntryLineDto>()
            };
        }
    }
}
