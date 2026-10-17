<#
  Detection script for an Intune Remediation, with Set-BCBuddyPolicy.ps1 as
  the remediation script. Exits 1 when the shared BC Buddy file is missing or
  different in Edge or Chrome, so Intune runs the remediation; 0 when it is in
  place. Use the same $Url as in Set-BCBuddyPolicy.ps1.
#>

$Url = 'https://example.com/bc-buddy.json'
$Id  = 'jpgpcfecpdcocjlepdfceahamliimjdl'

$keys = @(
  "HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\$Id\policy",
  "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$Id\policy"
)

foreach ($key in $keys) {
  $value = (Get-ItemProperty -Path $key -Name 'sharedConfigUrl' -ErrorAction SilentlyContinue).sharedConfigUrl
  if ($value -ne $Url) {
    Write-Output "Not set: $key"
    exit 1
  }
}

Write-Output 'BC Buddy shared file is set.'
exit 0
