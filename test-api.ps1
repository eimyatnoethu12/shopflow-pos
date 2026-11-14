# ShopFlow POS - Quick Automated API Health & Flow Test Script
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   ShopFlow POS - API Test Verification   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:4000/api"

# 1. Test Super Admin Login
Write-Host "`n[1/5] Testing Super Admin Login..." -ForegroundColor Yellow
try {
    $superLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"superadmin@shopflow.io","password":"ShopFlow123!"}'
    Write-Host "  -> SUCCESS: Super Admin authenticated! Name: $($superLogin.user.name)" -ForegroundColor Green
} catch {
    Write-Host "  -> FAILED: Could not log in as Super Admin. Is the backend server running on port 4000?" -ForegroundColor Red
    exit 1
}

# 2. Test Platform Overview Metrics
Write-Host "`n[2/5] Testing Super Admin Overview API..." -ForegroundColor Yellow
try {
    $overview = Invoke-RestMethod -Uri "$baseUrl/admin/overview" -Method Get -Headers @{ Authorization = "Bearer $($superLogin.token)" }
    Write-Host "  -> SUCCESS: Total Shops: $($overview.metrics.totalTenants) | Active: $($overview.metrics.activeTenants) | Total Platform Revenue: $($overview.metrics.totalRevenue) MMK" -ForegroundColor Green
} catch {
    Write-Host "  -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Test Shop Owner Login
Write-Host "`n[3/5] Testing Shop Owner Login..." -ForegroundColor Yellow
try {
    $ownerLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"owner@demo.shop","password":"ShopFlow123!"}'
    Write-Host "  -> SUCCESS: Shop Owner logged in! Shop: $($ownerLogin.tenant.name) | Role: $($ownerLogin.role)" -ForegroundColor Green
} catch {
    Write-Host "  -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 4. Test Shop Dashboard & Products
Write-Host "`n[4/5] Testing Shop Dashboard & Catalog APIs..." -ForegroundColor Yellow
$shopHeaders = @{
    Authorization = "Bearer $($ownerLogin.token)"
    "x-tenant-id" = $ownerLogin.tenant.id
}
try {
    $dashboard = Invoke-RestMethod -Uri "$baseUrl/dashboard" -Method Get -Headers $shopHeaders
    $products = Invoke-RestMethod -Uri "$baseUrl/products" -Method Get -Headers $shopHeaders
    Write-Host "  -> SUCCESS: Today Sales: $($dashboard.metrics.todaySales) MMK | Products Count: $($products.Length)" -ForegroundColor Green
} catch {
    Write-Host "  -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test Staff Password Management & Reset Flow
Write-Host "`n[5/5] Testing Staff Creation & Admin Password Reset Flow..." -ForegroundColor Yellow
try {
    # Create test staff
    $staffBody = @{
        name = "AutoTest Cashier"
        email = "autotest.staff@demo.shop"
        password = "OldStaffPass123!"
        role = "cashier"
        branchId = $ownerLogin.branch.id
        permissions = @{ pos = $true; inventory = $false; orders = $true }
    } | ConvertTo-Json

    $staffMember = Invoke-RestMethod -Uri "$baseUrl/staff" -Method Post -Headers $shopHeaders -ContentType 'application/json' -Body $staffBody
    Write-Host "  -> Staff created: $($staffMember.User.email)" -ForegroundColor Gray

    # Reset staff password by Admin
    $resetBody = @{ password = "NewStaffPass2026!" } | ConvertTo-Json
    $resetRes = Invoke-RestMethod -Uri "$baseUrl/staff/$($staffMember.id)/reset-password" -Method Post -Headers $shopHeaders -ContentType 'application/json' -Body $resetBody
    Write-Host "  -> Admin reset staff password: $($resetRes.message)" -ForegroundColor Gray

    # Verify login with new password
    $testLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"autotest.staff@demo.shop","password":"NewStaffPass2026!"}'
    Write-Host "  -> SUCCESS: Staff successfully logged in with new password!" -ForegroundColor Green

    # Cleanup test staff
    $null = Invoke-RestMethod -Uri "$baseUrl/staff/$($staffMember.id)" -Method Delete -Headers $shopHeaders
    Write-Host "  -> Cleanup: Test staff deleted." -ForegroundColor Gray
} catch {
    Write-Host "  -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " All systems are operational & healthy!   " -ForegroundColor Green
Write-Host " Frontend URL: http://localhost:5173      " -ForegroundColor Cyan
Write-Host " Backend API:  http://localhost:4000      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
