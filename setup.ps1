# Marketplace Watcher - one-shot local setup.
# Run from PowerShell in this folder:  .\setup.ps1
# Installs everything, asks a few plain-English questions, configures the
# app, starts it, and (optionally) makes it start automatically at login.
# Safe to re-run later if you want to change your answers.

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
Set-Location $projectDir

Write-Host "== Marketplace Watcher setup ==" -ForegroundColor Cyan

Write-Host "`nInstalling dependencies (this can take a few minutes the first time)..."
npm install
npx playwright install chromium

$envPath = Join-Path $projectDir ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "`nGenerating a secret key and setting up the database..."
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    $dataDir = Join-Path $projectDir "data"
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    $dbPath = (Join-Path $dataDir "app.db") -replace '\\', '/'
    @"
DATABASE_URL="file:$dbPath"
APP_SECRET="$secret"
"@ | Set-Content -Path $envPath -Encoding utf8
} else {
    Write-Host "`n.env already exists, keeping it as-is."
}

npx prisma db push
npm run build

Write-Host "`n== A few questions ==" -ForegroundColor Cyan

$location = Read-Host "What city or zip code should it search near?"
$radius = Read-Host "How many miles are you willing to travel?"

Write-Host "`nWhich days should it check Marketplace?"
$daysInput = Read-Host "Type days like 'mon,wed,fri', or just press Enter for every day"
if ([string]::IsNullOrWhiteSpace($daysInput)) {
    $days = "sun,mon,tue,wed,thu,fri,sat"
} else {
    $days = ($daysInput -split ",") | ForEach-Object { $_.Trim().ToLower().Substring(0, [Math]::Min(3, $_.Trim().Length)) } | Join-String -Separator ","
}

$freqInput = Read-Host "How often while active, in minutes? (press Enter for 120 = every 2 hours)"
$freq = if ([string]::IsNullOrWhiteSpace($freqInput)) { "120" } else { $freqInput }

Write-Host "`nNow, what are you looking for? Add one or more items."
$items = @()
while ($true) {
    $label = Read-Host "`nItem name (or press Enter to stop adding items)"
    if ([string]::IsNullOrWhiteSpace($label)) { break }
    $keywords = Read-Host "  Required keywords, comma-separated (e.g. 'golf, club')"
    $maxPrice = Read-Host "  Max price in dollars (press Enter for no limit)"
    $items += [PSCustomObject]@{ label = $label; keywords = $keywords; maxPrice = $maxPrice }
}

$rand = -join ((48..57) + (97..102) | Get-Random -Count 8 | ForEach-Object { [char]$_ })
$ntfyTopic = "marketplace-$rand"

Write-Host "`n== Starting the app ==" -ForegroundColor Cyan

$alreadyRunning = $false
try {
    $probe = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 2
    if ($probe.StatusCode -eq 200) { $alreadyRunning = $true }
} catch {}

if (-not $alreadyRunning) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start >> logs.txt 2>&1" -WorkingDirectory $projectDir -WindowStyle Hidden
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
    }
    if (-not $ready) {
        Write-Host "App didn't come up within 30 seconds - check logs.txt for errors." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Already running."
}

Write-Host "`nSaving your settings..."
Invoke-RestMethod -Uri "http://localhost:3000/api/settings" -Method Post -ContentType "application/json" `
    -Body (@{ home_location = $location; home_radius_miles = $radius } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Uri "http://localhost:3000/api/settings" -Method Post -ContentType "application/json" `
    -Body (@{ scan_days = $days; scan_interval_minutes = $freq } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Uri "http://localhost:3000/api/settings" -Method Post -ContentType "application/json" `
    -Body (@{ ntfy_topic = $ntfyTopic } | ConvertTo-Json) | Out-Null

foreach ($item in $items) {
    $body = @{ label = $item.label; keywords = $item.keywords }
    if (-not [string]::IsNullOrWhiteSpace($item.maxPrice)) { $body.maxPrice = [int]$item.maxPrice }
    Invoke-RestMethod -Uri "http://localhost:3000/api/wishlist" -Method Post -ContentType "application/json" `
        -Body ($body | ConvertTo-Json) | Out-Null
}

Write-Host "`n== Auto-start at login ==" -ForegroundColor Cyan
$makeAutostart = Read-Host "Start this automatically every time you log in? (Y/n)"
if ($makeAutostart -ne "n" -and $makeAutostart -ne "N") {
    $startupFolder = [Environment]::GetFolderPath('Startup')
    $shortcutPath = Join-Path $startupFolder "MarketplaceWatcher.lnk"
    $wshell = New-Object -ComObject WScript.Shell
    $shortcut = $wshell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $projectDir "start.bat"
    $shortcut.WorkingDirectory = $projectDir
    $shortcut.Save()
    Write-Host "Added a shortcut to your Startup folder."
}

Write-Host "`n=====================================" -ForegroundColor Green
Write-Host "All set. Dashboard: http://localhost:3000" -ForegroundColor Green
Write-Host "Your ntfy topic (subscribe to this in the ntfy app): $ntfyTopic" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`nOne manual step left: open http://localhost:3000/settings in your"
Write-Host "browser and paste your exported Facebook cookies (see README)."
