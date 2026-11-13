param([string]$ApiUrl = 'http://10.0.2.2:8000/api/v1')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath (Join-Path $projectRoot 'apps/mobile')
$env:EXPO_PUBLIC_API_URL = $ApiUrl
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 21+ (Android Studio bundled JDK is supported by Gradle 9.4).' }
if (-not $env:ANDROID_HOME) { throw 'Set ANDROID_HOME to your Android SDK directory.' }
node node_modules/expo/bin/cli prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
Set-Location -LiteralPath (Join-Path $projectRoot 'apps/mobile/android')
./gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' --max-workers=2 --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'artifacts') -Force | Out-Null
$apkPath = Join-Path $projectRoot 'artifacts/RoomMate-Ledger-preview.apk'
Copy-Item -LiteralPath 'app/build/outputs/apk/release/app-release.apk' -Destination $apkPath
$apkHash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$apkPath.sha256", "$apkHash  RoomMate-Ledger-preview.apk`n", [System.Text.Encoding]::ASCII)
Write-Output 'Preview APK: artifacts/RoomMate-Ledger-preview.apk. Use EAS production profile and your signing identity for store distribution.'
