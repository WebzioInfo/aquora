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
    public class BankLedgerService : ILedgerService
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
                .ToListAsync();

            var sortedEntries = allEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToList();

            decimal runningBalance = bank.OpeningBalance;
            foreach (var entry in sortedEntries)
            {
                if (entry.TransactionType == "Opening Balance")
                {
                    entry.RunningBalance = bank.OpeningBalance;
                    continue;
                }

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

            async Task executeBodyAsync()
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

                    if (oldBankId != bankAccountId && oldBankId.HasValue)
                    {
                        await RecalculateBankLedgerBalancesAsync(oldBankId.Value);
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
            }

            if (_context.Database.CurrentTransaction != null)
            {
                await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await executeBodyAsync();
                        await dbTxn.CommitAsync();
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
        }

        public async Task RemoveLedgerEntryForEntityAsync(Guid relatedEntityId, string relatedEntityType)
        {
            var tenantId = GetTenantId();

            async Task executeBodyAsync()
            {
                var entries = await _context.BankLedgerEntries
                    .Where(e => e.TenantId == tenantId && e.RelatedEntityId == relatedEntityId && e.RelatedEntityType == relatedEntityType)
                    .ToListAsync();

                if (entries.Any())
                {
                    var affectedBankIds = entries.Where(e => e.BankAccountId.HasValue).Select(e => e.BankAccountId!.Value).Distinct().ToList();
                    var affectedCashBookIds = entries.Where(e => e.CashBookId.HasValue).Select(e => e.CashBookId!.Value).Distinct().ToList();
                    _context.BankLedgerEntries.RemoveRange(entries);
                    await _context.SaveChangesAsync();

                    foreach (var bankId in affectedBankIds)
                    {
                        await RecalculateBankLedgerBalancesAsync(bankId);
                    }
                    foreach (var cashBookId in affectedCashBookIds)
                    {
                        await RecalculateCashBookLedgerBalancesAsync(cashBookId);
                    }
                }
            }

            if (_context.Database.CurrentTransaction != null)
            {
                await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await executeBodyAsync();
                        await dbTxn.CommitAsync();
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
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
                ("debit", true) => query.OrderBy(x => x.Debit).ThenBy(x => x.TransactionDate).ThenBy(x => x.CreatedAt).ThenBy(x => x.LedgerSequence),
                ("debit", false) => query.OrderByDescending(x => x.Debit).ThenByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.LedgerSequence),
                ("credit", true) => query.OrderBy(x => x.Credit).ThenBy(x => x.TransactionDate).ThenBy(x => x.CreatedAt).ThenBy(x => x.LedgerSequence),
                ("credit", false) => query.OrderByDescending(x => x.Credit).ThenByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.LedgerSequence),
                ("transactiontype", true) => query.OrderBy(x => x.TransactionType).ThenBy(x => x.TransactionDate).ThenBy(x => x.CreatedAt).ThenBy(x => x.LedgerSequence),
                ("transactiontype", false) => query.OrderByDescending(x => x.TransactionType).ThenByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.LedgerSequence),
                (_, true) => query.OrderBy(x => x.TransactionDate).ThenBy(x => x.CreatedAt).ThenBy(x => x.LedgerSequence),
                _ => query.OrderByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.LedgerSequence)
            };

            var entries = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new BankLedgerEntryDto
                {
                    Id = x.Id,
                    BankAccountId = x.BankAccountId ?? Guid.Empty,
                    TransactionDate = x.TransactionDate,
                    ReferenceNumber = x.ReferenceNumber,
                    TransactionType = x.TransactionType,
                    Description = x.Description,
                    Debit = x.Debit,
                    Credit = x.Credit,
                    RunningBalance = x.RunningBalance,
                    RelatedEntityId = x.RelatedEntityId,
                    RelatedEntityType = x.RelatedEntityType,
                    LedgerSequence = x.LedgerSequence,
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

            var lastTx = hasAnyTransactions
                ? await query.OrderByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt).FirstOrDefaultAsync()
                : null;

            var monthlyFlows = hasAnyTransactions
                ? await query.GroupBy(x => new { Year = x.TransactionDate.Year, Month = x.TransactionDate.Month })
                             .Select(g => g.Sum(x => x.Debit + x.Credit))
                             .ToListAsync()
                : new List<decimal>();

            var summary = new BankSummaryDto
            {
                CurrentBalance = bankAccount.CurrentBalance,
                TotalTransactions = hasAnyTransactions ? await query.CountAsync() : 0,
                TotalMoneyReceived = hasAnyTransactions ? await query.SumAsync(x => x.Credit) : 0m,
                TotalMoneyPaid = hasAnyTransactions ? await query.SumAsync(x => x.Debit) : 0m,
                LargestDeposit = hasAnyDeposits ? await query.MaxAsync(x => x.Credit) : 0m,
                LargestExpense = hasAnyExpenses ? await query.MaxAsync(x => x.Debit) : 0m,
                TodaysTransactions = hasAnyTransactions ? await query.CountAsync(x => x.TransactionDate >= startOfDay) : 0,
                ThisMonthTransactions = hasAnyTransactions ? await query.CountAsync(x => x.TransactionDate >= startOfMonth) : 0,
                AverageMonthlyFlow = monthlyFlows.Any() ? monthlyFlows.Average() : 0m,
                LastTransactionDate = lastTx?.TransactionDate,
                LastTransactionDescription = lastTx?.Description,
                LastTransactionAmount = lastTx != null ? (lastTx.Debit > 0 ? -lastTx.Debit : lastTx.Credit) : 0m
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

            async Task<Guid> executeBodyAsync()
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

                return entry.Id;
            }

            if (_context.Database.CurrentTransaction != null)
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

        public async Task RecalculateCashBookLedgerBalancesAsync(Guid cashBookId)
        {
            var tenantId = GetTenantId();
            var cashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == cashBookId && b.TenantId == tenantId);
            if (cashBook == null) return;

            var allEntries = await _context.BankLedgerEntries
                .Where(x => x.TenantId == tenantId && x.CashBookId == cashBookId && x.LedgerAccountType == "CashBook")
                .ToListAsync();

            var sortedEntries = allEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToList();

            decimal runningBalance = cashBook.OpeningBalance;
            foreach (var entry in sortedEntries)
            {
                if (entry.TransactionType == "Opening Balance")
                {
                    entry.RunningBalance = cashBook.OpeningBalance;
                    continue;
                }

                runningBalance = runningBalance - entry.Debit + entry.Credit;
                entry.RunningBalance = runningBalance;
            }

            cashBook.CurrentBalance = runningBalance;
            cashBook.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        public async Task<Guid> RecordCashTransactionAsync(Guid cashBookId, DateTime transactionDate, string referenceNumber, string transactionType, string description, decimal debit, decimal credit, Guid? relatedEntityId = null, string? relatedEntityType = null)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var cashBook = await _context.CashBooks.FirstOrDefaultAsync(b => b.Id == cashBookId && b.TenantId == tenantId && !b.IsDeleted);
            if (cashBook == null) throw new KeyNotFoundException("Cash book not found or access denied.");

            async Task<Guid> executeBodyAsync()
            {
                var entry = new BankLedgerEntry
                {
                    Id = Guid.NewGuid(), TenantId = tenantId, CompanyId = companyId, BankAccountId = null,
                    CashBookId = cashBookId, LedgerAccountType = "CashBook", TransactionDate = EnsureUtc(transactionDate),
                    ReferenceNumber = referenceNumber, TransactionType = transactionType, Description = description,
                    Debit = debit, Credit = credit, RunningBalance = 0m, RelatedEntityId = relatedEntityId,
                    RelatedEntityType = relatedEntityType, CreatedAt = DateTime.UtcNow, CreatedBy = _currentUserContext.UserId ?? "System"
                };
                _context.BankLedgerEntries.Add(entry);
                await _context.SaveChangesAsync();

                _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                {
                    Id = Guid.NewGuid(), TenantId = tenantId, CompanyId = companyId, BankLedgerEntryId = entry.Id,
                    Action = "Created", OldAmount = 0m, NewAmount = debit > 0 ? debit : credit,
                    Remarks = $"Initial {transactionType} transaction recorded.", CreatedAt = DateTime.UtcNow,
                    CreatedBy = _currentUserContext.UserId ?? "System"
                });
                await _context.SaveChangesAsync();
                await RecalculateCashBookLedgerBalancesAsync(cashBookId);
                return entry.Id;
            }

            if (_context.Database.CurrentTransaction != null)
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

        public async Task SyncCashExpenseLedgerAsync(Guid expenseId, Guid cashBookId, DateTime expenseDate, string expenseNumber, string category, string description, decimal amount, string transactionType = "Expense")
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var formattedDescription = string.IsNullOrWhiteSpace(description) ? $"Expense ({category})" : $"[{category}] {description}";

            async Task executeBodyAsync()
            {
                var existingEntry = await _context.BankLedgerEntries.FirstOrDefaultAsync(e => e.TenantId == tenantId && e.RelatedEntityId == expenseId && e.RelatedEntityType == "Expense");
                if (existingEntry != null)
                {
                    var oldCashBookId = existingEntry.CashBookId;
                    var oldBankId = existingEntry.BankAccountId;
                    var oldAmount = existingEntry.Debit > 0 ? existingEntry.Debit : existingEntry.Credit;
                    existingEntry.BankAccountId = null;
                    existingEntry.CashBookId = cashBookId;
                    existingEntry.LedgerAccountType = "CashBook";
                    existingEntry.TransactionDate = EnsureUtc(expenseDate);
                    existingEntry.ReferenceNumber = expenseNumber;
                    existingEntry.TransactionType = transactionType;
                    existingEntry.Description = formattedDescription;
                    existingEntry.Debit = amount;
                    existingEntry.Credit = 0m;
                    existingEntry.UpdatedAt = DateTime.UtcNow;
                    existingEntry.UpdatedBy = _currentUserContext.UserId;
                    _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry { Id = Guid.NewGuid(), TenantId = tenantId, CompanyId = companyId, BankLedgerEntryId = existingEntry.Id, Action = "Edited", OldAmount = oldAmount, NewAmount = amount, Remarks = "Cash book expense updated.", CreatedAt = DateTime.UtcNow, CreatedBy = _currentUserContext.UserId ?? "System" });
                    await _context.SaveChangesAsync();
                    if (oldCashBookId.HasValue && oldCashBookId.Value != cashBookId) await RecalculateCashBookLedgerBalancesAsync(oldCashBookId.Value);
                    if (oldBankId.HasValue && oldBankId.Value != Guid.Empty) await RecalculateBankLedgerBalancesAsync(oldBankId.Value);
                    await RecalculateCashBookLedgerBalancesAsync(cashBookId);
                    return;
                }
                await RecordCashTransactionAsync(cashBookId, expenseDate, expenseNumber, transactionType, formattedDescription, amount, 0m, expenseId, "Expense");
            }

            if (_context.Database.CurrentTransaction != null)
            {
                await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await executeBodyAsync();
                        await dbTxn.CommitAsync();
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
        }

        public async Task ReconcileMissingCashBookLedgerEntriesAsync(Guid? cashBookId = null)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var query = _context.CashBooks.Where(b => b.TenantId == tenantId && !b.IsDeleted);
            if (cashBookId.HasValue) query = query.Where(b => b.Id == cashBookId.Value);
            foreach (var cashBook in await query.ToListAsync())
            {
                var existingEntries = await _context.BankLedgerEntries.Where(x => x.TenantId == tenantId && x.CashBookId == cashBook.Id && x.LedgerAccountType == "CashBook").ToListAsync();
                var newEntries = new List<BankLedgerEntry>();
                if (cashBook.OpeningBalance > 0 && !existingEntries.Any(e => e.TransactionType == "Opening Balance"))
                {
                    newEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CompanyId = companyId, BankAccountId = null, CashBookId = cashBook.Id, LedgerAccountType = "CashBook", TransactionDate = EnsureUtc(cashBook.CreatedAt), ReferenceNumber = "INIT", TransactionType = "Opening Balance", Description = "Opening Balance", Debit = 0m, Credit = cashBook.OpeningBalance, RunningBalance = 0m, CreatedAt = EnsureUtc(cashBook.CreatedAt), CreatedBy = cashBook.CreatedBy ?? "System" });
                }
                var expenses = await _context.SimpleExpenses.Where(e => e.TenantId == tenantId && !e.IsDeleted && e.CashBookId == cashBook.Id && e.PaymentMethod == "Cash").ToListAsync();
                foreach (var exp in expenses.Where(exp => !existingEntries.Any(e => e.RelatedEntityId == exp.Id && e.RelatedEntityType == "Expense")))
                {
                    newEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CompanyId = companyId, BankAccountId = null, CashBookId = cashBook.Id, LedgerAccountType = "CashBook", TransactionDate = EnsureUtc(exp.ExpenseDate), ReferenceNumber = exp.ExpenseNumber, TransactionType = exp.UpdatedAt.HasValue ? "Expense Updated" : "Expense", Description = string.IsNullOrWhiteSpace(exp.Description) ? $"Expense ({exp.Category})" : $"[{exp.Category}] {exp.Description}", Debit = exp.Amount, Credit = 0m, RunningBalance = 0m, RelatedEntityId = exp.Id, RelatedEntityType = "Expense", CreatedAt = EnsureUtc(exp.CreatedAt), CreatedBy = exp.CreatedBy ?? "System" });
                }
                if (newEntries.Any()) { _context.BankLedgerEntries.AddRange(newEntries); await _context.SaveChangesAsync(); }
                await RecalculateCashBookLedgerBalancesAsync(cashBook.Id);
            }
        }

        public async Task<PagedResult<BankLedgerEntryDto>> GetCashBookLedgerAsync(Guid cashBookId, int pageNumber, int pageSize, string? search, BankLedgerFilterDto filter)
        {
            var tenantId = GetTenantId();
            if (!await _context.BankLedgerEntries.AnyAsync(x => x.TenantId == tenantId && x.CashBookId == cashBookId && x.LedgerAccountType == "CashBook")) await ReconcileMissingCashBookLedgerEntriesAsync(cashBookId);
            await RecalculateCashBookLedgerBalancesAsync(cashBookId);
            var query = _context.BankLedgerEntries.AsNoTracking().Where(x => x.TenantId == tenantId && x.CashBookId == cashBookId && x.LedgerAccountType == "CashBook");
            if (!string.IsNullOrWhiteSpace(search)) { var term = search.ToLower(); query = query.Where(x => x.ReferenceNumber.ToLower().Contains(term) || x.Description.ToLower().Contains(term) || x.TransactionType.ToLower().Contains(term)); }
            var totalCount = await query.CountAsync();
            var entries = await query
                .OrderByDescending(x => x.TransactionDate)
                .ThenByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.LedgerSequence)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new BankLedgerEntryDto
                {
                    Id = x.Id,
                    BankAccountId = x.BankAccountId ?? Guid.Empty,
                    TransactionDate = x.TransactionDate,
                    ReferenceNumber = x.ReferenceNumber,
                    TransactionType = x.TransactionType,
                    Description = x.Description,
                    Debit = x.Debit,
                    Credit = x.Credit,
                    RunningBalance = x.RunningBalance,
                    RelatedEntityId = x.RelatedEntityId,
                    RelatedEntityType = x.RelatedEntityType,
                    LedgerSequence = x.LedgerSequence,
                    CreatedAt = x.CreatedAt,
                    CreatedBy = x.CreatedBy
                })
                .ToListAsync();

            if (entries.Any())
            {
                var userNamesMap = await ResolveUserNamesBatchAsync(entries.Select(x => x.CreatedBy));
                foreach (var entry in entries)
                {
                    entry.CreatedBy = userNamesMap.TryGetValue(entry.CreatedBy, out var name) ? name : entry.CreatedBy;
                }
            }

            return new PagedResult<BankLedgerEntryDto> { Items = entries, TotalCount = totalCount, PageNumber = pageNumber, PageSize = pageSize, TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize) };
        }

        public async Task<BankSummaryDto> GetCashBookSummaryAsync(Guid cashBookId)
        {
            var tenantId = GetTenantId();
            var cashBookExists = await _context.CashBooks.AnyAsync(b => b.Id == cashBookId && b.TenantId == tenantId && !b.IsDeleted);
            if (!cashBookExists) throw new KeyNotFoundException("Cash book not found.");

            if (!await _context.BankLedgerEntries.AnyAsync(x => x.TenantId == tenantId && x.CashBookId == cashBookId && x.LedgerAccountType == "CashBook"))
            {
                await ReconcileMissingCashBookLedgerEntriesAsync(cashBookId);
            }
            await RecalculateCashBookLedgerBalancesAsync(cashBookId);

            var cashBook = await _context.CashBooks
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == cashBookId && b.TenantId == tenantId && !b.IsDeleted) 
                ?? throw new KeyNotFoundException("Cash book not found.");

            var query = _context.BankLedgerEntries
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.CashBookId == cashBookId && x.LedgerAccountType == "CashBook");

            var any = await query.AnyAsync();
            var hasAnyDeposits = any && await query.AnyAsync(x => x.Credit > 0);
            var hasAnyExpenses = any && await query.AnyAsync(x => x.Debit > 0);

            var nowUtc = DateTime.UtcNow;
            var startOfDay = DateTime.SpecifyKind(nowUtc.Date, DateTimeKind.Utc);
            var startOfMonth = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var lastTx = any
                ? await query.OrderByDescending(x => x.TransactionDate).ThenByDescending(x => x.CreatedAt).FirstOrDefaultAsync()
                : null;

            var monthlyFlows = any
                ? await query.GroupBy(x => new { Year = x.TransactionDate.Year, Month = x.TransactionDate.Month })
                             .Select(g => g.Sum(x => x.Debit + x.Credit))
                             .ToListAsync()
                : new List<decimal>();

            return new BankSummaryDto 
            { 
                CurrentBalance = cashBook.CurrentBalance, 
                TotalTransactions = any ? await query.CountAsync() : 0, 
                TotalMoneyReceived = any ? await query.SumAsync(x => x.Credit) : 0m, 
                TotalMoneyPaid = any ? await query.SumAsync(x => x.Debit) : 0m, 
                LargestDeposit = hasAnyDeposits ? await query.MaxAsync(x => x.Credit) : 0m, 
                LargestExpense = hasAnyExpenses ? await query.MaxAsync(x => x.Debit) : 0m, 
                TodaysTransactions = any ? await query.CountAsync(x => x.TransactionDate >= startOfDay) : 0, 
                ThisMonthTransactions = any ? await query.CountAsync(x => x.TransactionDate >= startOfMonth) : 0,
                AverageMonthlyFlow = monthlyFlows.Any() ? monthlyFlows.Average() : 0m,
                LastTransactionDate = lastTx?.TransactionDate,
                LastTransactionDescription = lastTx?.Description,
                LastTransactionAmount = lastTx != null ? (lastTx.Debit > 0 ? -lastTx.Debit : lastTx.Credit) : 0m
            };
        }

        public async Task<Guid> AddMoneyAsync(Guid? bankAccountId, Guid? cashBookId, AddMoneyRequest request)
        {
            if (request.Amount <= 0)
                throw new ArgumentException("Amount must be greater than zero.");

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var desc = string.IsNullOrWhiteSpace(request.Description) ? request.Source : $"{request.Source} - {request.Description}";

            if (bankAccountId.HasValue)
            {
                var bankAccount = await _context.BankAccounts
                    .FirstOrDefaultAsync(b => b.Id == bankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);
                if (bankAccount == null) throw new KeyNotFoundException("Bank account not found or access denied.");

                return await RecordTransactionAsync(
                    bankAccountId: bankAccountId.Value,
                    transactionDate: request.Date,
                    referenceNumber: request.ReferenceNo ?? "",
                    transactionType: "Deposit",
                    description: desc,
                    debit: 0m,
                    credit: request.Amount,
                    relatedEntityId: null,
                    relatedEntityType: "Deposit"
                );
            }
            else if (cashBookId.HasValue)
            {
                var cashBook = await _context.CashBooks
                    .FirstOrDefaultAsync(b => b.Id == cashBookId.Value && b.TenantId == tenantId && !b.IsDeleted);
                if (cashBook == null) throw new KeyNotFoundException("Cash book not found or access denied.");

                return await RecordCashTransactionAsync(
                    cashBookId: cashBookId.Value,
                    transactionDate: request.Date,
                    referenceNumber: request.ReferenceNo ?? "",
                    transactionType: "Deposit",
                    description: desc,
                    debit: 0m,
                    credit: request.Amount,
                    relatedEntityId: null,
                    relatedEntityType: "Deposit"
                );
            }
            else
            {
                throw new ArgumentException("Either Bank Account ID or Cash Book ID must be specified.");
            }
        }

        public async Task UpdateDepositAsync(Guid ledgerEntryId, AddMoneyRequest request)
        {
            if (request.Amount <= 0)
                throw new ArgumentException("Amount must be greater than zero.");

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();

            async Task executeBodyAsync()
            {
                var entry = await _context.BankLedgerEntries
                    .FirstOrDefaultAsync(x => x.Id == ledgerEntryId && x.TenantId == tenantId);

                if (entry == null)
                    throw new KeyNotFoundException("Deposit entry not found.");

                if (!entry.TransactionType.Equals("Deposit", StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException("Only deposit transactions can be updated through this workflow.");

                var oldAmount = entry.Credit;
                var desc = string.IsNullOrWhiteSpace(request.Description) ? request.Source : $"{request.Source} - {request.Description}";

                entry.Credit = request.Amount;
                entry.TransactionDate = EnsureUtc(request.Date);
                entry.ReferenceNumber = request.ReferenceNo ?? "";
                entry.Description = desc;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = _currentUserContext.UserId ?? "System";

                _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    BankLedgerEntryId = entry.Id,
                    Action = "Edited",
                    OldAmount = oldAmount,
                    NewAmount = request.Amount,
                    Remarks = $"Deposit updated. Amount changed from ₹{oldAmount:N2} to ₹{request.Amount:N2}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _currentUserContext.UserId ?? "System"
                });

                await _context.SaveChangesAsync();

                if (entry.BankAccountId.HasValue)
                {
                    await RecalculateBankLedgerBalancesAsync(entry.BankAccountId.Value);
                }
                else if (entry.CashBookId.HasValue)
                {
                    await RecalculateCashBookLedgerBalancesAsync(entry.CashBookId.Value);
                }
            }

            if (_context.Database.CurrentTransaction != null)
            {
                await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await executeBodyAsync();
                        await dbTxn.CommitAsync();
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
        }

        public async Task DeleteDepositAsync(Guid ledgerEntryId)
        {
            var tenantId = GetTenantId();

            async Task executeBodyAsync()
            {
                var entry = await _context.BankLedgerEntries
                    .FirstOrDefaultAsync(x => x.Id == ledgerEntryId && x.TenantId == tenantId);

                if (entry == null)
                    throw new KeyNotFoundException("Deposit entry not found.");

                var allowedTypes = new[] { "Deposit", "Withdrawal", "Opening Balance" };
                if (!allowedTypes.Contains(entry.TransactionType, StringComparer.OrdinalIgnoreCase))
                    throw new ArgumentException("Only manual transactions (Deposit, Withdrawal, Opening Balance) can be deleted through this workflow.");

                if (entry.TransactionType.Equals("Opening Balance", StringComparison.OrdinalIgnoreCase))
                {
                    bool hasDependent = false;
                    if (entry.BankAccountId.HasValue)
                    {
                        hasDependent = await _context.BankLedgerEntries
                            .AnyAsync(e => e.TenantId == tenantId && e.BankAccountId == entry.BankAccountId && e.Id != entry.Id);
                    }
                    else if (entry.CashBookId.HasValue)
                    {
                        hasDependent = await _context.BankLedgerEntries
                            .AnyAsync(e => e.TenantId == tenantId && e.CashBookId == entry.CashBookId && e.Id != entry.Id);
                    }
                    if (hasDependent)
                    {
                        throw new InvalidOperationException("Cannot delete opening balance because dependent transactions exist.");
                    }
                }

                var bankAccountId = entry.BankAccountId;
                var cashBookId = entry.CashBookId;

                _context.BankLedgerEntries.Remove(entry);
                await _context.SaveChangesAsync();

                if (bankAccountId.HasValue)
                {
                    await RecalculateBankLedgerBalancesAsync(bankAccountId.Value);
                }
                else if (cashBookId.HasValue)
                {
                    await RecalculateCashBookLedgerBalancesAsync(cashBookId.Value);
                }
            }

            if (_context.Database.CurrentTransaction != null)
            {
                await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await executeBodyAsync();
                        await dbTxn.CommitAsync();
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
        }

        public async Task SyncSalaryPaymentLedgerAsync(
            Guid salaryPaymentId,
            Guid? bankAccountId,
            Guid? cashBookId,
            string paymentMethod,
            DateTime paymentDate,
            string salaryNo,
            string description,
            decimal oldNetSalary,
            decimal newNetSalary,
            string auditRemarks)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var utcPaymentDate = EnsureUtc(paymentDate);

            async Task executeBodyAsync()
            {
                var existingEntry = await _context.BankLedgerEntries
                    .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.RelatedEntityId == salaryPaymentId && e.RelatedEntityType == "SalaryPayment");

                if (existingEntry != null)
                {
                    var oldBankId = existingEntry.BankAccountId;
                    var oldCashBookId = existingEntry.CashBookId;

                    if (paymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
                    {
                        existingEntry.BankAccountId = bankAccountId;
                        existingEntry.CashBookId = null;
                        existingEntry.LedgerAccountType = "BankAccount";
                    }
                    else
                    {
                        existingEntry.BankAccountId = null;
                        existingEntry.CashBookId = cashBookId;
                        existingEntry.LedgerAccountType = "CashBook";
                    }

                    existingEntry.TransactionDate = utcPaymentDate;
                    existingEntry.ReferenceNumber = salaryNo;
                    existingEntry.TransactionType = "Salary Payment";
                    existingEntry.Description = description;
                    existingEntry.Debit = newNetSalary;
                    existingEntry.Credit = 0m;
                    existingEntry.UpdatedAt = DateTime.UtcNow;
                    existingEntry.UpdatedBy = _currentUserContext.UserId;

                    await _context.SaveChangesAsync();

                    // Insert NEW audit history record for this edit
                    var audit = new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = existingEntry.Id,
                        Action = "Updated",
                        OldAmount = oldNetSalary,
                        NewAmount = newNetSalary,
                        Remarks = auditRemarks,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = _currentUserContext.UserId ?? "System"
                    };
                    _context.BankLedgerAuditEntries.Add(audit);
                    await _context.SaveChangesAsync();

                    // Recalculate balances for all affected accounts
                    if (oldBankId.HasValue) 
                        await RecalculateBankLedgerBalancesAsync(oldBankId.Value);
                    if (existingEntry.BankAccountId.HasValue && existingEntry.BankAccountId != oldBankId) 
                        await RecalculateBankLedgerBalancesAsync(existingEntry.BankAccountId.Value);

                    if (oldCashBookId.HasValue) 
                        await RecalculateCashBookLedgerBalancesAsync(oldCashBookId.Value);
                    if (existingEntry.CashBookId.HasValue && existingEntry.CashBookId != oldCashBookId) 
                        await RecalculateCashBookLedgerBalancesAsync(existingEntry.CashBookId.Value);
                }
                else
                {
                    // Fallback creation if ledger entry does not exist
                    if (paymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
                    {
                        await RecordTransactionAsync(
                            bankAccountId: bankAccountId!.Value,
                            transactionDate: utcPaymentDate,
                            referenceNumber: salaryNo,
                            transactionType: "Salary Payment",
                            description: description,
                            debit: newNetSalary,
                            credit: 0m,
                            relatedEntityId: salaryPaymentId,
                            relatedEntityType: "SalaryPayment"
                        );
                    }
                    else
                    {
                        await RecordCashTransactionAsync(
                            cashBookId: cashBookId!.Value,
                            transactionDate: utcPaymentDate,
                            referenceNumber: salaryNo,
                            transactionType: "Salary Payment",
                            description: description,
                            debit: newNetSalary,
                            credit: 0m,
                            relatedEntityId: salaryPaymentId,
                            relatedEntityType: "SalaryPayment"
                        );
                    }
                }
            }

            if (_context.Database.CurrentTransaction != null)
            {
                await executeBodyAsync();
            }
            else
            {
                var strategy = _context.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var dbTxn = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await executeBodyAsync();
                        await dbTxn.CommitAsync();
                    }
                    catch
                    {
                        await dbTxn.RollbackAsync();
                        throw;
                    }
                });
            }
        }
    }
}
