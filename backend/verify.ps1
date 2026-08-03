$baseUrl = "http://localhost:5000/api/v1"
$email = "sinankuttasseri123@gmail.com"
$password = "TenantAdmin@2026!"
$tenantId = "de73da72-2307-489c-b474-bf9cdc6137ee"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "STARTING TRANSACTION FLOW VALIDATION" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Login
Write-Host "1. Logging in..."
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -Headers @{"X-Tenant-Id" = $tenantId}
    if ($loginRes.success) {
        $token = $loginRes.data.accessToken
        Write-Host "   Login successful! JWT token retrieved." -ForegroundColor Green
    } else {
        Write-Host "   Login failed: $($loginRes.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Login request failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "X-Tenant-Id" = $tenantId
}

# 2. Get Bank Accounts
Write-Host "2. Retrieving Bank Accounts..."
try {
    $banksRes = Invoke-RestMethod -Uri "$baseUrl/bank-accounts" -Method Get -Headers $headers
    if ($banksRes.success -and $banksRes.data.items.Count -gt 0) {
        $bank = $banksRes.data.items[0]
        $bankId = $bank.id
        $bankName = $bank.name
        $initialBalance = [decimal]$bank.currentBalance
        Write-Host "   Found Bank Account: $bankName (ID: $bankId)" -ForegroundColor Green
        Write-Host "   Initial Balance: INR $initialBalance" -ForegroundColor Green
    } else {
        Write-Host "   No bank accounts found or request failed." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Retrieve Bank Accounts failed: $_" -ForegroundColor Red
    exit 1
}

# 3. Create Expense of INR 1000
Write-Host "3. Creating new Expense of INR 1000..."
$expenseDate = (Get-Date).ToUniversalTime().ToString("o")
$createBody = @{
    category = "Office Supplies"
    vendor = "Test Vendor"
    description = "Validation Test Expense"
    amount = 1000.00
    paymentMethod = "Bank"
    bankAccountId = $bankId
    expenseDate = $expenseDate
} | ConvertTo-Json

try {
    $createRes = Invoke-RestMethod -Uri "$baseUrl/expenses" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers
    if ($createRes.success) {
        $expenseId = $createRes.data.id
        Write-Host "   Expense created successfully! ID: $expenseId" -ForegroundColor Green
    } else {
        Write-Host "   Create expense failed: $($createRes.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Create expense request failed: $_" -ForegroundColor Red
    exit 1
}

# 4. Verify Bank Balance Decreased by 1000
Write-Host "4. Verifying Bank Balance after creation..."
try {
    $bankRes = Invoke-RestMethod -Uri "$baseUrl/bank-accounts/$bankId" -Method Get -Headers $headers
    $newBalance = [decimal]$bankRes.data.currentBalance
    $diff = $initialBalance - $newBalance
    Write-Host "   New Balance: INR $newBalance"
    if ($diff -eq 1000.00) {
        Write-Host "   Success: Balance decreased by INR 1000 correctly!" -ForegroundColor Green
    } else {
        Write-Host "   Error: Balance mismatch! Difference is INR $diff (Expected 1000.00)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Verify balance failed: $_" -ForegroundColor Red
    exit 1
}

# 5. Verify Bank Ledger entry is present
Write-Host "5. Verifying Bank Ledger entry..."
try {
    $ledgerRes = Invoke-RestMethod -Uri "$baseUrl/bank-accounts/$bankId/ledger" -Method Get -Headers $headers
    $ledgerEntries = $ledgerRes.data.items
    $matchingLedger = $ledgerEntries | Where-Object { $_.relatedEntityId -eq $expenseId }
    if ($matchingLedger) {
        $ledgerEntryId = $matchingLedger.id
        Write-Host "   Found matching ledger entry: ID: $ledgerEntryId, Details: $($matchingLedger.description), Debit: $($matchingLedger.debit), RunningBalance: $($matchingLedger.runningBalance)" -ForegroundColor Green
    } else {
        Write-Host "   Error: Ledger entry for expense not found!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Verify ledger failed: $_" -ForegroundColor Red
    exit 1
}

# 6. Edit Expense amount to INR 800
Write-Host "6. Editing Expense to INR 800..."
$updateBody = @{
    category = "Office Supplies"
    vendor = "Test Vendor"
    description = "Validation Test Expense (Updated)"
    amount = 800.00
    paymentMethod = "Bank"
    bankAccountId = $bankId
    expenseDate = $expenseDate
} | ConvertTo-Json

try {
    $updateRes = Invoke-RestMethod -Uri "$baseUrl/expenses/$expenseId" -Method Put -Body $updateBody -ContentType "application/json" -Headers $headers
    if ($updateRes.success) {
        Write-Host "   Expense updated successfully!" -ForegroundColor Green
    } else {
        Write-Host "   Update expense failed: $($updateRes.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Update expense request failed: $_" -ForegroundColor Red
    exit 1
}

# 7. Verify Bank Balance updated to initial - 800
Write-Host "7. Verifying Bank Balance after edit..."
try {
    $bankRes2 = Invoke-RestMethod -Uri "$baseUrl/bank-accounts/$bankId" -Method Get -Headers $headers
    $newBalance2 = [decimal]$bankRes2.data.currentBalance
    $diff2 = $initialBalance - $newBalance2
    Write-Host "   New Balance: INR $newBalance2"
    if ($diff2 -eq 800.00) {
        Write-Host "   Success: Balance adjusted to INR 800 deduction correctly!" -ForegroundColor Green
    } else {
        Write-Host "   Error: Balance mismatch! Difference is INR $diff2 (Expected 800.00)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Verify balance after edit failed: $_" -ForegroundColor Red
    exit 1
}

# 8. Verify Bank Ledger Audit Entries exist for the ledger entry
Write-Host "8. Retrieving Ledger Audit History..."
try {
    $historyRes = Invoke-RestMethod -Uri "$baseUrl/bank-accounts/ledger/$ledgerEntryId/history" -Method Get -Headers $headers
    $historyItems = $historyRes.data
    Write-Host "   Found $($historyItems.Count) audit history record(s)." -ForegroundColor Green
    foreach ($item in $historyItems) {
        Write-Host "   History Record - Action: $($item.action), OldAmount: $($item.oldAmount), NewAmount: $($item.newAmount), Remarks: $($item.remarks), UpdatedBy: $($item.createdBy), Date: $($item.createdAt)" -ForegroundColor Yellow
    }
    if ($historyItems.Count -gt 0) {
        Write-Host "   Success: Audit entries verified!" -ForegroundColor Green
    } else {
        Write-Host "   Error: No audit entries found!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Verify audit history failed: $_" -ForegroundColor Red
    exit 1
}

# 9. Delete the Expense
Write-Host "9. Deleting the Expense..."
try {
    $deleteRes = Invoke-RestMethod -Uri "$baseUrl/expenses/$expenseId" -Method Delete -Headers $headers
    if ($deleteRes.success) {
        Write-Host "   Expense deleted successfully!" -ForegroundColor Green
    } else {
        Write-Host "   Delete expense failed: $($deleteRes.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Delete expense request failed: $_" -ForegroundColor Red
    exit 1
}

# 10. Verify Bank Balance restored to initial balance
Write-Host "10. Verifying Bank Balance after deletion..."
try {
    $bankRes3 = Invoke-RestMethod -Uri "$baseUrl/bank-accounts/$bankId" -Method Get -Headers $headers
    $finalBalance = [decimal]$bankRes3.data.currentBalance
    Write-Host "   Final Balance: INR $finalBalance"
    if ($finalBalance -eq $initialBalance) {
        Write-Host "   Success: Bank balance fully restored to INR $initialBalance!" -ForegroundColor Green
    } else {
        Write-Host "   Error: Balance mismatch! Current is INR $finalBalance (Expected INR $initialBalance)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Verify balance after deletion failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "TRANSACTION FLOW VALIDATION PASSED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
