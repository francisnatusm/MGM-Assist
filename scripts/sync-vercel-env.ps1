# Sync variables from .env.local to Vercel Production (run after: vercel login)
# Usage:  cd "e:\MGM Assist"
#         vercel link   # pick mgm-assist if asked
#         .\scripts\sync-vercel-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile"
}

$keys = @(
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "ANTHROPIC_API_KEY",
  "BRIGHTDATA_API_TOKEN",
  "USAJOBS_API_KEY",
  "USAJOBS_EMAIL"
)

Write-Host "Linking project (if needed)..."
Push-Location $root
vercel link --yes 2>$null

foreach ($key in $keys) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) {
    Write-Host "Skip $key (not in .env.local)"
    continue
  }
  $value = $line -replace "^$key=", "" -replace '^"|"$', ""
  Write-Host "Setting $key on Production..."
  $value | vercel env add $key production --force
}

Write-Host ""
Write-Host "Done. Redeploy: vercel --prod"
Pop-Location
