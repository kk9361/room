$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:APP_ENV = 'development'
& (Join-Path $projectRoot '.venv/Scripts/python.exe') (Join-Path $projectRoot 'scripts/check_atlas.py')
if ($LASTEXITCODE -ne 0) { throw 'Atlas connection failed. Correct the private database configuration before starting FastAPI.' }
Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
& (Join-Path $projectRoot '.venv/Scripts/python.exe') -m uvicorn app.main:app --host 127.0.0.1 --port 8000
