param(
    [Parameter(Mandatory = $true)][string]$BackendUrl,
    [string]$FrontendUrl = 'https://room-six-murex.vercel.app',
    [switch]$TestLogin,
    [PSCredential]$Credential,
    [switch]$AllowLocalHttp
)
$ErrorActionPreference = 'Stop'
$backendAddress = $null
if (-not [Uri]::TryCreate($BackendUrl.Trim().TrimEnd('/'), [UriKind]::Absolute, [ref]$backendAddress)) {
    throw 'Enter the actual backend URL assigned by your backend host.'
}
if ($backendAddress.UserInfo -or $backendAddress.Query -or $backendAddress.Fragment -or
    $backendAddress.AbsolutePath.TrimEnd('/') -notin @('', '/api/v1')) {
    throw 'Use the backend origin or /api/v1 base, without credentials, query strings, or endpoint paths.'
}
if ($backendAddress.Scheme -ne 'https' -and -not ($AllowLocalHttp -and $backendAddress.IsLoopback -and $backendAddress.Scheme -eq 'http')) {
    throw 'The production backend must use HTTPS.'
}
$backendOrigin = $backendAddress.GetLeftPart([UriPartial]::Authority)
$apiBase = "$backendOrigin/api/v1"
$frontendAddress = [Uri]$FrontendUrl
$frontendOrigin = $frontendAddress.GetLeftPart([UriPartial]::Authority)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Invoke-ApiCheck {
    param([string]$Url, [string]$Method = 'GET', [object]$Body, [hashtable]$Headers = @{}, [int]$ExpectedStatus = 200)
    # Windows PowerShell persists custom headers in WebRequestSession.
    # Keep cookies, but never carry a bearer token into an anonymous check.
    $session.Headers.Clear()
    $options = @{
        Uri = $Url; Method = $Method; Headers = $Headers; WebSession = $session
        UseBasicParsing = $true; TimeoutSec = 90; MaximumRedirection = 0
    }
    if ($null -ne $Body) {
        $options.ContentType = 'application/json'
        $options.Body = $Body | ConvertTo-Json -Compress
    }
    try { $response = Invoke-WebRequest @options }
    catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        if ($status -eq $ExpectedStatus) { return $null }
        throw "API check failed: $Method $Url returned status $status; expected $ExpectedStatus. No credentials were logged."
    }
    if ([int]$response.StatusCode -ne $ExpectedStatus) {
        throw "API check returned status $([int]$response.StatusCode) at $Url; expected $ExpectedStatus."
    }
    return $response
}

$health = Invoke-ApiCheck -Url "$apiBase/health"
if (($health.Content | ConvertFrom-Json).status -ne 'ok') { throw 'This endpoint is not the expected health API.' }
$schema = (Invoke-ApiCheck -Url "$backendOrigin/openapi.json").Content | ConvertFrom-Json
if ($schema.info.title -ne 'RoomMate Ledger API' -or -not $schema.paths.'/api/v1/auth/login'.post) {
    throw 'This host does not expose the RoomMate Ledger FastAPI login route. Do not enter login credentials.'
}
Write-Output 'PASS: Verified RoomMate Ledger FastAPI identity and POST /api/v1/auth/login.'
$ready = Invoke-ApiCheck -Url "$apiBase/health/ready"
if (($ready.Content | ConvertFrom-Json).status -ne 'ready') { throw 'Backend database is not ready.' }
Write-Output 'PASS: Database readiness.'
$originHeaders = @{ Origin = $frontendOrigin }
$null = Invoke-ApiCheck -Url "$apiBase/auth/login" -Method POST -Body @{} -Headers $originHeaders -ExpectedStatus 422
Write-Output 'PASS: Login route and request validation.'
$preflight = Invoke-ApiCheck -Url "$apiBase/auth/login" -Method OPTIONS -Headers @{
    Origin = $frontendOrigin
    'Access-Control-Request-Method' = 'POST'
    'Access-Control-Request-Headers' = 'content-type,authorization'
}
if ($preflight.Headers['Access-Control-Allow-Origin'] -ne $frontendOrigin -or
    $preflight.Headers['Access-Control-Allow-Credentials'] -ne 'true') {
    throw 'CORS must allow the exact frontend origin with credentials.'
}
Write-Output 'PASS: Frontend CORS preflight and credentials.'

if ($TestLogin) {
    # Prompt only AFTER verifying the host identity and database readiness.
    if (-not $credential) {
        $credential = Get-Credential -Message 'RoomMate Ledger application login (not your Atlas database login)'
    }
    if (-not $credential) { throw 'Application credentials were not supplied.' }
    $signedIn = $null
    $authHeaders = $null
    try {
        $null = Invoke-ApiCheck -Url "$apiBase/auth/login" -Method POST -Headers $originHeaders -ExpectedStatus 401 -Body @{
            identifier = $credential.UserName; password = [Guid]::NewGuid().ToString('N')
        }
        Write-Output 'PASS: Invalid password rejected.'
        $result = Invoke-ApiCheck -Url "$apiBase/auth/login" -Method POST -Headers $originHeaders -Body @{
            identifier = $credential.UserName; password = $credential.GetNetworkCredential().Password
        }
        $signedIn = $result.Content | ConvertFrom-Json
        if (-not $signedIn.access_token -or $signedIn.refresh_token) { throw 'Unexpected web token response.' }
        $authHeaders = @{ Authorization = "Bearer $($signedIn.access_token)"; Origin = $frontendOrigin }
        $null = Invoke-ApiCheck -Url "$apiBase/auth/me" -Headers $authHeaders
        $null = Invoke-ApiCheck -Url "$apiBase/auth/me" -ExpectedStatus 401
        $null = Invoke-ApiCheck -Url "$apiBase/auth/me" -Headers @{ Authorization = 'Bearer invalid.jwt.token' } -ExpectedStatus 401
        Write-Output 'PASS: Login, bearer validation, and protected account access.'
        if (-not $signedIn.user.must_change_password) {
            $null = Invoke-ApiCheck -Url "$apiBase/rooms" -Headers $authHeaders
            Write-Output 'PASS: Protected dashboard data.'
        } else { Write-Output 'ACTION: Change the temporary administrator password in the website before accessing dashboard data.' }
        $null = Invoke-ApiCheck -Url "$apiBase/auth/refresh" -Method POST -Body @{} -Headers $originHeaders
        Write-Output 'PASS: HttpOnly cookie session refresh.'
    } finally {
        if ($authHeaders) {
            $null = Invoke-ApiCheck -Url "$apiBase/auth/logout" -Method POST -Body @{} -Headers $authHeaders
            $null = Invoke-ApiCheck -Url "$apiBase/auth/me" -Headers $authHeaders -ExpectedStatus 401
            Write-Output 'PASS: Logout and session revocation.'
        }
        $credential = $null; $signedIn = $null; $result = $null; $authHeaders = $null
        $session.Cookies = New-Object System.Net.CookieContainer
    }
}
Write-Output 'API checks passed. Browser login, reload persistence and logout must also be tested at the Vercel website.'
