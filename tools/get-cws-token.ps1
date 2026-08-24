<#
  Fetches the refresh token the release workflow needs for the Chrome Web Store.

  You run this once, by hand, after creating an OAuth client in Google Cloud.
  It opens your browser, catches the redirect on localhost, and swaps the code
  for a refresh token — the value that goes into the CWS_REFRESH_TOKEN secret.

  The token is printed and nothing is written to disk: it is a credential, and
  a file is easy to commit by accident.

  Usage:
    pwsh -File tools/get-cws-token.ps1 -ClientId <id> -ClientSecret <secret>

  See the "Releasing" section of DEVELOPMENT.md for the surrounding setup.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$ClientId,
  [Parameter(Mandatory)] [string]$ClientSecret,
  # Any free port; it only has to match what the OAuth client allows, and a
  # Desktop-app client allows every loopback port.
  [int]$Port = 8818
)

$ErrorActionPreference = 'Stop'

$redirect = "http://localhost:$Port/"
$scope = 'https://www.googleapis.com/auth/chromewebstore'

# access_type=offline asks for a refresh token at all; prompt=consent asks for
# one again on a repeat run. Without both you get an access token that is dead
# in an hour and no way to renew it.
$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
  '?client_id=' + [uri]::EscapeDataString($ClientId) +
  '&redirect_uri=' + [uri]::EscapeDataString($redirect) +
  '&response_type=code' +
  '&access_type=offline' +
  '&prompt=consent' +
  '&scope=' + [uri]::EscapeDataString($scope)

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($redirect)
try {
  $listener.Start()
} catch {
  throw "Could not listen on $redirect - is the port in use? Try -Port with another number. ($($_.Exception.Message))"
}

Write-Host ''
Write-Host 'A browser window is opening. Sign in with the account that owns the'
Write-Host 'Chrome Web Store item and approve the request.'
Write-Host ''
Write-Host 'Google will warn that the app is unverified: that is expected for an'
Write-Host 'app only you use. Choose "Advanced" and then "Go to ... (unsafe)".'
Write-Host ''
Write-Host "Waiting on $redirect ..."

try {
  Start-Process $authUrl | Out-Null
} catch {
  Write-Host ''
  Write-Host 'Could not open a browser. Paste this into one yourself:'
  Write-Host $authUrl
}

try {
  $context = $listener.GetContext()   # blocks until Google redirects back
  $code = $context.Request.QueryString['code']
  $failure = $context.Request.QueryString['error']

  $message = if ($code) { 'Done. You can close this tab and go back to the terminal.' }
             else { "Authorisation failed: $failure" }
  $body = [System.Text.Encoding]::UTF8.GetBytes(
    "<!doctype html><meta charset=utf-8><title>BC Buddy</title>" +
    "<body style='font:15px system-ui;padding:2rem'>$message</body>")
  $context.Response.ContentType = 'text/html; charset=utf-8'
  $context.Response.OutputStream.Write($body, 0, $body.Length)
  $context.Response.Close()
} finally {
  $listener.Stop()
  $listener.Close()
}

if (-not $code) { throw "No authorisation code came back: $failure" }

$response = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -Body @{
  client_id     = $ClientId
  client_secret = $ClientSecret
  code          = $code
  grant_type    = 'authorization_code'
  redirect_uri  = $redirect
}

if (-not $response.refresh_token) {
  throw 'Google returned no refresh token. Revoke the app at ' +
    'https://myaccount.google.com/permissions and run this again, so the ' +
    'consent screen appears afresh.'
}

Write-Host ''
Write-Host 'CWS_REFRESH_TOKEN:' -ForegroundColor Green
Write-Host $response.refresh_token
Write-Host ''
Write-Host 'Store it as a repository secret. It does not expire on its own, but'
Write-Host 'it dies after seven days if the OAuth consent screen is still in'
Write-Host '"Testing" — set it to "In production" first.'
