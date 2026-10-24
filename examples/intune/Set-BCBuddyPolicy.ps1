<#
  Sets the shared BC Buddy file for every user of this computer, in Microsoft
  Edge and Google Chrome, through browser policy. BC Buddy then loads it by
  itself and the address cannot be changed on the settings page.

  Intune: Devices > Scripts and remediations. Use it as a Platform script
  (runs once), or as the remediation script of a Remediation together with
  Detect-BCBuddyPolicy.ps1 (keeps it in place). Run it as SYSTEM, in 64-bit
  PowerShell.

  Put your own address in $Url. The extension ID is BC Buddy's in the Chrome
  Web Store; Edge installs it from there too.
#>

$Url = 'https://example.com/bc-buddy.json'
$Id  = 'jpgpcfecpdcocjlepdfceahamliimjdl'

$keys = @(
  "HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\$Id\policy",
  "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$Id\policy"
)

foreach ($key in $keys) {
  # -Force creates the missing parent keys. Only when the key is missing:
  # on an existing key it would throw away what is already there.
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name 'sharedConfigUrl' -Value $Url -Type String
}

Write-Output "BC Buddy shared file set to $Url"
