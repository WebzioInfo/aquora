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
    public class BankLedgerService : IBankLedgerService
    {
        private readonly ITenantDbContext _context;
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;

        public BankLedgerService(
            ITenantDbContext context,
            IPlatformDbContext platformContext,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext)
        {
            _context = context;
            _platformContext = platformContext;
            _tenantProvider = tenantProvider;
            _currentUserContext = currentUserContext;
        }

        private Guid GetTenantId() => _tenantProvider.TenantId;

        private static DateTime EnsureUtc(DateTime dt)
        {
            return dt.Kind switch
            {
                DateTimeKind.Utc => dt,
                DateTimeKind.Local => dt.ToUniversalTime(),
                _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
            };
        }

        private async Task<Guid> GetCompanyIdAsync()
        {
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
                    .Select(u => new { u.Id, u.FirstName, u.LastName })
                    .ToListAsync();

                foreach (var u in users)
                {
                    var name = !string.IsNullOrWhiteSpace(u.FirstName) ? $"{u.FirstName} {u.LastName}".Trim() : "Unknown User";
                    map[u.Id.ToString()] = name;
                }
            }
            return map;
        }

        public async Task RecalculateBankLedgerBalancesAsync(Guid bankAccountId)
        {
            var tenantId = GetTenantId();
            var bank = await _context.BankAccounts
                .FirstOrDefaultAsync(b => b.Id == bankAccountId && b.TenantId == tenantId);

            if (bank == null) return;

            var allEntries = await _context.BankLedgerEntries
                .Where(x => x.TenantId == tenantId && x.BankAccountId == bankAccountId)
                .OrderBy(x => x.TransactionDate)
                .ThenBy(x => x.CreatedAt)
                .ToListAsync();

            decimal runningBalance = 0m;
            foreach (var entry in allEntries)
            {
                runningBalance = runningBalance - entry.Debit + entry.Credit;
                entry.RunningBalance = runningBalance;
            }

            bank.CurrentBalance = runningBalance;
            bank.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        public async Task SyncExpenseLedgerAsync(
            Guid expenseId,
            Guid bankAccountId,
            DateTime expenseDate,
            string expenseNumber,
            string category,
            string description,
            decimal amount,
            string transactionType = "Expense")
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var utcExpenseDate = EnsureUtc(expenseDate);
            var formattedDescription = string.IsNullOrWhiteSpace(description) 
                ? $"Expense ({category})" 
                : $"[{category}] {description}";

            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    var existingEntry = await _context.BankLedgerEntries
                        .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.RelatedEntityId == expenseId && e.RelatedEntityType == "Expense");

                    if (existingEntry != null)
                    {
                        var oldBankId = existingEntry.BankAccountId;
                        var oldAmount = existingEntry.Debit > 0 ? existingEntry.Debit : existingEntry.Credit;
                        var oldDesc = existingEntry.Description;
                        var oldDate = existingEntry.TransactionDate;

                        var remarksList = new List<string>();
                        if (oldAmount != amount) remarksList.Add($"Amount changed from ₹{oldAmount:N2} to ₹{amount:N2}");
                        if (oldDesc != formattedDescription) remarksList.Add("Details updated");
                        if (oldDate.Date != utcExpenseDate.Date) remarksList.Add($"Date changed from {oldDate:yyyy-MM-dd} to {utcExpenseDate:yyyy-MM-dd}");
                        if (oldBankId != bankAccountId) remarksList.Add("Bank account changed");

                        var remarks = remarksList.Count > 0 ? string.Join(", ", remarksList) : "Updated details";

                        existingEntry.BankAccountId = bankAccountId;
                        existingEntry.TransactionDate = utcExpenseDate;
                        existingEntry.ReferenceNumber = expenseNumber;
                        existingEntry.TransactionType = transactionType;
                        existingEntry.Description = formattedDescription;
                        existingEntry.Debit = amount;
                        existingEntry.Credit = 0m;
                        existingEntry.UpdatedAt = DateTime.UtcNow;
                        existingEntry.UpdatedBy = _currentUserContext.UserId;

                        await _context.SaveChangesAsync();

                        // Add audit history
                        var audit = new BankLedgerAuditEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankLedgerEntryId = existingEntry.Id,
                            Action = "Edited",
                            OldAmount = oldAmount,
                            NewAmount = amount,
                            Remarks = remarks,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = _currentUserContext.UserId ?? "System"
                        };
                        _context.BankLedgerAuditEntries.Add(audit);
                        await _context.SaveChangesAsync();

                        if (oldBankId != bankAccountId)
                        {
                            await RecalculateBankLedgerBalancesAsync(oldBankId);
                        }
                        await RecalculateBankLedgerBalancesAsync(bankAccountId);
                    }
                    else
                    {
                        var newEntry = new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankAccountId = bankAccountId,
                            TransactionDate = utcExpenseDate,
                            ReferenceNumber = expenseNumber,
                            TransactionType = transactionType,
                            Description = formattedDescription,
                            Debit = amount,
                            Credit = 0m,
                            RunningBalance = 0m,
                            RelatedEntityId = expenseId,
                            RelatedEntityType = "Expense",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = _currentUserContext.UserId ?? "System"
                        };
                        _context.BankLedgerEntries.Add(newEntry);
                        await _context.SaveChangesAsync();

                        // Add audit history
                        var audit = new BankLedgerAuditEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankLedgerEntryId = newEntry.Id,
                            Action = "Created",
                            OldAmount = 0m,
                            NewAmount = amount,
                            Remarks = "Initial expense entry created.",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = _currentUserContext.UserId ?? "System"
                        };
                        _context.BankLedgerAuditEntries.Add(audit);
                        await _context.SaveChangesAsync();

                        await RecalculateBankLedgerBalancesAsync(bankAccountId);
                    }

                    await dbTxn.CommitAsync();
                }
                catch
                {
                    await dbTxn.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task RemoveLedgerEntryForEntityAsync(Guid relatedEntityId, string relatedEntityType)
        {
            var tenantId = GetTenantId();
            var strategy = _context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    var entries = await _context.BankLedgerEntries
                        .Where(e => e.TenantId == tenantId && e.RelatedEntityId == relatedEntityId && e.RelatedEntityType == relatedEntityType)
                        .ToListAsync();

                    if (entries.Any())
                    {
                        var affectedBankIds = entries.Select(e => e.BankAccountId).Distinct().ToList();
                        _context.BankLedgerEntries.RemoveRange(entries);
                        await _context.SaveChangesAsync();

                        foreach (var bankId in affectedBankIds)
                        {
                            await RecalculateBankLedgerBalancesAsync(bankId);
                        }
                    }

                    await dbTxn.CommitAsync();
                }
                catch
                {
                    await dbTxn.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task ReconcileMissingLedgerEntriesAsync(Guid? bankAccountId = null)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();

            var bankQuery = _context.BankAccounts
                .Where(b => b.TenantId == tenantId && !b.IsDeleted);

            if (bankAccountId.HasValue)
            {
                bankQuery = bankQuery.Where(b => b.Id == bankAccountId.Value);
            }

            var banks = await bankQuery.ToListAsync();

            foreach (var bank in banks)
            {
                // Clean up legacy reversal entries if any exist
                var legacyReversals = await _context.BankLedgerEntries
                    .Where(x => x.TenantId == tenantId && x.BankAccountId == bank.Id && x.TransactionType.Contains("Reversal"))
                    .ToListAsync();
                if (legacyReversals.Any())
                {
                    _context.BankLedgerEntries.RemoveRange(legacyReversals);
                    await _context.SaveChangesAsync();
                }

                var existingEntries = await _context.BankLedgerEntries
                    .Where(x => x.TenantId == tenantId && x.BankAccountId == bank.Id)
                    .ToListAsync();

                var newEntries = new List<BankLedgerEntry>();

                // 1. Opening balance check
                if (bank.OpeningBalance > 0 && !existingEntries.Any(e => e.TransactionType == "Opening Balance"))
                {
                    newEntries.Add(new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankAccountId = bank.Id,
                        TransactionDate = EnsureUtc(bank.CreatedAt),
                        ReferenceNumber = "INIT",
                        TransactionType = "Opening Balance",
                        Description = "Opening Balance",
                        Debit = 0m,
                        Credit = bank.OpeningBalance,
                        RunningBalance = 0m,
                        CreatedAt = EnsureUtc(bank.CreatedAt),
                        CreatedBy = bank.CreatedBy ?? "System"
                    });
                }

                // 2. Existing Expenses check
                var expenses = await _context.SimpleExpenses
                    .Where(e => e.TenantId == tenantId && !e.IsDeleted && e.BankAccountId == bank.Id && e.PaymentMethod == "Bank")
                    .ToListAsync();

                foreach (var exp in expenses)
                {
                    var alreadyLedgered = existingEntries.FirstOrDefault(e => e.RelatedEntityId == exp.Id && e.RelatedEntityType == "Expense");
                    if (alreadyLedgered == null)
                    {
                        var formattedDescription = string.IsNullOrWhiteSpace(exp.Description) 
                            ? $"Expense ({exp.Category})" 
                            : $"[{exp.Category}] {exp.Description}";

                        newEntries.Add(new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankAccountId = bank.Id,
                            TransactionDate = EnsureUtc(exp.ExpenseDate),
                            ReferenceNumber = exp.ExpenseNumber,
                            TransactionType = exp.UpdatedAt.HasValue ? "Expense Updated" : "Expense",
                            Description = formattedDescription,
                            Debit = exp.Amount,
                            Credit = 0m,
                            RunningBalance = 0m,
                            RelatedEntityId = exp.Id,
                            RelatedEntityType = "Expense",
                            CreatedAt = EnsureUtc(exp.CreatedAt),
                            CreatedBy = exp.CreatedBy ?? "System"
                        });
                    }
                }

                if (newEntries.Any())
                {
                    _context.BankLedgerEntries.AddRange(newEntries);
                    await _context.SaveChangesAsync();

                    var audits = newEntries.Select(e => new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = e.Id,
                        Action = "Created",
                        OldAmount = 0m,
                        NewAmount = e.Debit > 0 ? e.Debit : e.Credit,
                        Remarks = e.TransactionType == "Opening Balance" ? "Opening balance initialized." : "Initial expense entry created during reconciliation.",
                        CreatedAt = e.CreatedAt,
                        CreatedBy = e.CreatedBy
                    }).ToList();

                    _context.BankLedgerAuditEntries.AddRange(audits);
                    await _context.SaveChangesAsync();
                }

                await RecalculateBankLedgerBalancesAsync(bank.Id);
            }
        }

        public async Task<PagedResult<BankLedgerEntryDto>> GetLedgerAsync(Guid bankAccountId, int pageNumber, int pageSize, string? search, BankLedgerFilterDto filter)
        {
            var tenantId = GetTenantId();

            var hasEntries = await _context.BankLedgerEntries.AnyAsync(x => x.TenantId == tenantId && x.BankAccountId == bankAccountId);
            if (!hasEntries)
            {
                await ReconcileMissingLedgerEntriesAsync(bankAccountId);
            }

            var query = _context.BankLedgerEntries
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.BankAccountId == bankAccountId);

            if (filter != null)
            {
                if (filter.DateFrom.HasValue)
                {
                    var dateFromUtc = EnsureUtc(filter.DateFrom.Value);
                    query = query.Where(x => x.TransactionDate >= dateFromUtc);
                }

                if (filter.DateTo.HasValue)
                {
                    var dateToUtc = EnsureUtc(filter.DateTo.Value);
                    query = query.Where(x => x.TransactionDate <= dateToUtc);
                }

                if (!string.IsNullOrWhiteSpace(filter.TransactionType))
                    query = query.Where(x => x.TransactionType.ToLower() == filter.TransactionType.ToLower());

                if (!string.IsNullOrWhiteSpace(filter.CreatedBy))
                    query = query.Where(x => x.CreatedBy.ToLower().Contains(filter.CreatedBy.ToLower()));

                if (filter.MinimumAmount.HasValue)
                    query = query.Where(x => x.Debit >= filter.MinimumAmount.Value || x.Credit >= filter.MinimumAmount.Value);

                if (filter.MaximumAmount.HasValue)
                    query = query.Where(x => x.Debit <= filter.MaximumAmount.Value || x.Credit <= filter.MaximumAmount.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.ToLower();
                query = query.Where(x => 
                    x.ReferenceNumber.ToLower().Contains(term) || 
                    x.Description.ToLower().Contains(term) ||
                    x.TransactionType.ToLower().Contains(term) ||
                    x.CreatedBy.ToLower().Contains(term));
            }

            var totalCount = await query.CountAsync();

            var isAsc = filter?.SortOrder?.Equals("asc", StringComparison.OrdinalIgnoreCase) ?? false;
            var sortBy = filter?.SortBy?.ToLower() ?? "transactiondate";

            query = (sortBy, isAsc) switch
            {
                ("debit", true) => query.OrderBy(x => x.Debit).ThenBy(x => x.TransactionDate),
                ("debit", false) => query.OrderByDescending(x => x.Debit).ThenByDescending(x => x.TransactionDate),
                ("credit", true) => query.OrderBy(x => x.Credit).ThenBy(x => x.TransactionDate),
                ("credit", false) => query.OrderByDescending(x => x.Credit).ThenByDescending(x => x.TransactionDate),
                ("runningbalance", true) => query.OrderBy(x => x.RunningBalance).ThenBy(x => x.TransactionDate),
                ("runningbalance", false) => query.OrderByDescending(x => x.RunningBalance).ThenByDescending(x => x.TransactionDate),
                ("transactiontype", true) => query.OrderBy(x => x.TransactionType).ThenBy(x => x.TransactionDate),
                ("transactiontype", false) => query.OrderByDescending(x => x.TransactionType).ThenByDescending(x => x.TransactionDate),
                (_, true) => query.OrderBy(x => x.TransactionDate).ThenBy(x => x.CreatedAt),
                _ => query.OrderByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt)
            };

            var entries = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new BankLedgerEntryDto
                {
                    Id = x.Id,
                    BankAccountId = x.BankAccountId,
                    TransactionDate = x.TransactionDate,
                    ReferenceNumber = x.ReferenceNumber,
                    TransactionType = x.TransactionType,
                    Description = x.Description,
                    Debit = x.Debit,
                    Credit = x.Credit,
                    RunningBalance = x.RunningBalance,
                    RelatedEntityId = x.RelatedEntityId,
                    RelatedEntityType = x.RelatedEntityType,
                    CreatedAt = x.CreatedAt,
                    CreatedBy = x.CreatedBy
                })
                .ToListAsync();

            if (entries.Any())
            {
                var createdBys = entries.Select(x => x.CreatedBy).Distinct().ToList();
                var userNamesMap = await ResolveUserNamesBatchAsync(createdBys);

                foreach (var entry in entries)
                {
                    if (!string.IsNullOrWhiteSpace(entry.CreatedBy) && userNamesMap.TryGetValue(entry.CreatedBy, out var name))
                    {
                        entry.CreatedBy = name;
                    }
                }
            }

            return new PagedResult<BankLedgerEntryDto>
            {
                Items = entries,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            };
        }

        public async Task<BankSummaryDto> GetBankSummaryAsync(Guid bankAccountId)
        {
            var tenantId = GetTenantId();
            
            var bankAccount = await _context.BankAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == bankAccountId && b.TenantId == tenantId && !b.IsDeleted);
                
            if (bankAccount == null)
                throw new KeyNotFoundException("Bank account not found.");

            var hasEntries = await _context.BankLedgerEntries.AnyAsync(x => x.TenantId == tenantId && x.BankAccountId == bankAccountId);
            if (!hasEntries)
            {
                await ReconcileMissingLedgerEntriesAsync(bankAccountId);
            }

            var query = _context.BankLedgerEntries
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.BankAccountId == bankAccountId);

            var nowUtc = DateTime.UtcNow;
            var startOfDay = DateTime.SpecifyKind(nowUtc.Date, DateTimeKind.Utc);
            var startOfMonth = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var hasAnyTransactions = await query.AnyAsync();
            var hasAnyDeposits = hasAnyTransactions && await query.AnyAsync(x => x.Credit > 0);
            var hasAnyExpenses = hasAnyTransactions && await query.AnyAsync(x => x.Debit > 0);

            var summary = new BankSummaryDto
            {
                CurrentBalance = bankAccount.CurrentBalance,
                TotalTransactions = hasAnyTransactions ? await query.CountAsync() : 0,
                TotalMoneyReceived = hasAnyTransactions ? await query.SumAsync(x => x.Credit) : 0m,
                TotalMoneyPaid = hasAnyTransactions ? await query.SumAsync(x => x.Debit) : 0m,
                LargestDeposit = hasAnyDeposits ? await query.MaxAsync(x => x.Credit) : 0m,
                LargestExpense = hasAnyExpenses ? await query.MaxAsync(x => x.Debit) : 0m,
                TodaysTransactions = hasAnyTransactions ? await query.CountAsync(x => x.TransactionDate >= startOfDay) : 0,
                ThisMonthTransactions = hasAnyTransactions ? await query.CountAsync(x => x.TransactionDate >= startOfMonth) : 0
            };

            return summary;
        }

        public async Task<Guid> RecordTransactionAsync(
            Guid bankAccountId, 
            DateTime transactionDate, 
            string referenceNumber, 
            string transactionType, 
            string description, 
            decimal amount, 
            Guid? relatedEntityId = null, 
            string? relatedEntityType = null)
        {
            decimal debit = 0m;
            decimal credit = 0m;

            if (transactionType.Equals("Expense", StringComparison.OrdinalIgnoreCase) ||
                transactionType.Equals("Expense Updated", StringComparison.OrdinalIgnoreCase) ||
                transactionType.Equals("Withdrawal", StringComparison.OrdinalIgnoreCase) ||
                transactionType.Equals("Supplier Payment", StringComparison.OrdinalIgnoreCase) ||
                transactionType.Equals("Owner Withdrawal", StringComparison.OrdinalIgnoreCase))
            {
                debit = Math.Abs(amount);
            }
            else if (amount < 0)
            {
                debit = Math.Abs(amount);
            }
            else
            {
                credit = Math.Abs(amount);
            }

            return await RecordTransactionAsync(
                bankAccountId,
                transactionDate,
                referenceNumber,
                transactionType,
                description,
                debit,
                credit,
                relatedEntityId,
                relatedEntityType);
        }

        public async Task<Guid> RecordTransactionAsync(
            Guid bankAccountId, 
            DateTime transactionDate, 
            string referenceNumber, 
            string transactionType, 
            string description, 
            decimal debit,
            decimal credit,
            Guid? relatedEntityId = null, 
            string? relatedEntityType = null)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            
            var bankAccount = await _context.BankAccounts
                .FirstOrDefaultAsync(b => b.Id == bankAccountId && b.TenantId == tenantId && !b.IsDeleted);

            if (bankAccount == null)
                throw new KeyNotFoundException("Bank account not found or access denied.");

            var utcTransactionDate = EnsureUtc(transactionDate);

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    var entry = new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankAccountId = bankAccountId,
                        TransactionDate = utcTransactionDate,
                        ReferenceNumber = referenceNumber,
                        TransactionType = transactionType,
                        Description = description,
                        Debit = debit,
                        Credit = credit,
                        RunningBalance = 0m,
                        RelatedEntityId = relatedEntityId,
                        RelatedEntityType = relatedEntityType,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = _currentUserContext.UserId ?? "System"
                    };

                    _context.BankLedgerEntries.Add(entry);
                    await _context.SaveChangesAsync();

                    var amount = debit > 0 ? debit : credit;
                    var audit = new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = entry.Id,
                        Action = "Created",
                        OldAmount = 0m,
                        NewAmount = amount,
                        Remarks = $"Initial {transactionType} transaction recorded.",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = _currentUserContext.UserId ?? "System"
                    };
                    _context.BankLedgerAuditEntries.Add(audit);
                    await _context.SaveChangesAsync();

                    await RecalculateBankLedgerBalancesAsync(bankAccountId);
                    await dbTxn.CommitAsync();

                    return entry.Id;
                }
                catch
                {
                    await dbTxn.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<List<BankLedgerAuditEntryDto>> GetLedgerHistoryAsync(Guid ledgerEntryId)
        {
            var tenantId = GetTenantId();
            var entry = await _context.BankLedgerEntries
                .FirstOrDefaultAsync(x => x.Id == ledgerEntryId && x.TenantId == tenantId);
            
            if (entry == null) return new List<BankLedgerAuditEntryDto>();

            var audits = await _context.BankLedgerAuditEntries
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.BankLedgerEntryId == ledgerEntryId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            if (!audits.Any())
            {
                // Self-healing
                var amount = entry.Debit > 0 ? entry.Debit : entry.Credit;
                var newAudit = new BankLedgerAuditEntry
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = entry.CompanyId,
                    BankLedgerEntryId = entry.Id,
                    Action = "Created",
                    OldAmount = 0m,
                    NewAmount = amount,
                    Remarks = "Initial transaction recorded (auto-recovered).",
                    CreatedAt = entry.CreatedAt,
                    CreatedBy = entry.CreatedBy
                };
                _context.BankLedgerAuditEntries.Add(newAudit);
                await _context.SaveChangesAsync();

                audits = new List<BankLedgerAuditEntry> { newAudit };
            }

            var changedBys = audits.Select(x => x.CreatedBy).Distinct().ToList();
            var userNamesMap = await ResolveUserNamesBatchAsync(changedBys);

            return audits.Select(x => new BankLedgerAuditEntryDto
            {
                Id = x.Id,
                BankLedgerEntryId = x.BankLedgerEntryId,
                Action = x.Action,
                OldAmount = x.OldAmount,
                NewAmount = x.NewAmount,
                Remarks = x.Remarks,
                ChangedBy = userNamesMap.TryGetValue(x.CreatedBy, out var name) ? name : x.CreatedBy,
                ChangedAt = x.CreatedAt
            }).ToList();
        }
    }
}
