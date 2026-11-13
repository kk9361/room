param(
    [Parameter(Mandatory = $true)][string]$BackendUrl,
    [string]$FrontendUrl = 'https://room-six-murex.vercel.app',
    [switch]$UseProxy
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$nodeVersion = [version]((& node --version).Trim().TrimStart('v').Split('-')[0])
if ($nodeVersion -lt [version]'22.13.0') { throw 'Install Node.js 22.13 or newer before deploying.' }
& "$PSScriptRoot/Test-ProductionApi.ps1" -BackendUrl $BackendUrl -FrontendUrl $FrontendUrl

$npxPath = (Get-Command npx.cmd -ErrorAction Stop).Source
$backendAddress = [Uri]$BackendUrl.Trim()
$backendOrigin = $backendAddress.GetLeftPart([UriPartial]::Authority)
$browserBase = if ($UseProxy) { '/api/v1' } else { "$backendOrigin/api/v1" }

& $npxPath --yes vercel@latest login
if ($LASTEXITCODE -ne 0) { throw 'Vercel sign-in did not complete.' }
Write-Output 'Link the existing Vercel project serving your production website. Its Root Directory must remain apps/web.'
& $npxPath --yes vercel@latest link
if ($LASTEXITCODE -ne 0) { throw 'Vercel project linking did not complete.' }
$browserBase | & $npxPath --yes vercel@latest env add NEXT_PUBLIC_API_BASE_URL --environment production --type config --force
if ($LASTEXITCODE -ne 0) { throw 'Could not configure the public API base.' }
$backendOrigin | & $npxPath --yes vercel@latest env add API_INTERNAL_URL --environment production --type config --force
if ($LASTEXITCODE -ne 0) { throw 'Could not configure the server API proxy.' }
& $npxPath --yes vercel@latest deploy --prod
if ($LASTEXITCODE -ne 0) { throw 'Vercel production deployment failed.' }
Write-Output 'Deployment command completed. Verify browser login, dashboard access, reload persistence and logout before treating the production fix as complete.'
