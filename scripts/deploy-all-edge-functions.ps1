# Deploy every edge function that has an index.ts (skips shared helper folders).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$FunctionsDir = Join-Path $Root 'supabase\functions'
$Skip = @('_shared', 'shared')

Get-ChildItem $FunctionsDir -Directory |
  Where-Object { $Skip -notcontains $_.Name -and (Test-Path (Join-Path $_.FullName 'index.ts')) } |
  Sort-Object Name |
  ForEach-Object {
    Write-Host "Deploying edge function: $($_.Name)"
    npx supabase functions deploy $_.Name
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

Write-Host 'All edge functions deployed.'
