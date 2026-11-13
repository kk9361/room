$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
python -m pip install uv
if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11+ first.' }
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
    python -m uv venv --python 3.12 .venv
    if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed.' }
}
python -m uv pip install --python .venv/Scripts/python.exe -r backend/requirements-dev.lock
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
$nodeVersion = (& node --version).TrimStart('v').Split('.')[0]
if ([int]$nodeVersion -lt 22) { throw 'Install Node.js 22.13 or newer before continuing.' }
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Root dependency installation failed.' }
npm --prefix apps/web ci
if ($LASTEXITCODE -ne 0) { throw 'Web dependency installation failed.' }
npm --prefix apps/mobile ci
if ($LASTEXITCODE -ne 0) { throw 'Mobile dependency installation failed.' }
& ./.venv/Scripts/python.exe scripts/configure.py
Write-Output 'Setup complete. Run npm run dev for the local database, API, and web app.'
