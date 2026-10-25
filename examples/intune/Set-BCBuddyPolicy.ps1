<#
  Sets the shared BC Buddy file, and optionally the other BC Buddy settings
  IT can lock, for every user of this computer, in Microsoft Edge and Google
  Chrome, through browser policy. BC Buddy then loads the file by itself, and
  what is set here cannot be changed on the settings page.

  Intune: Devices > Scripts and remediations. Use it as a Platform script
  (runs once), or as the remediation script of a Remediation together with
  Detect-BCBuddyPolicy.ps1 (keeps it in place). Run it as SYSTEM, in 64-bit
  PowerShell.

  Put your own address in $Url. Every other setting below is left alone while
  it is $null; give it a value to set and lock it. Use the same values in
  Detect-BCBuddyPolicy.ps1. The extension ID is BC Buddy's in the Chrome Web
  Store; Edge installs it from there too.
#>

$Url = 'https://example.com/bc-buddy.json'
$Id  = 'jpgpcfecpdcocjlepdfceahamliimjdl'

# Areas: $true or $false, or $null to let people choose.
$WebClientEnabled    = $null
$EnvironmentsEnabled = $null
$FeedbackEnabled     = $null

# Help & feedback. Text: $null to leave unset.
$FeedbackEmail           = $null   # e.g. 'helpdesk@example.com'
$FeedbackPriorities      = $null   # e.g. @('Low', 'Normal', 'Urgent'); @() hides the field
$FeedbackDefaultPriority = $null   # one of the priorities, e.g. 'Normal'
$FeedbackSubjectBug      = $null   # e.g. '[{prio}] {type} in {company} ({environment})'
$FeedbackSubjectIdea     = $null
$FeedbackUrgentText      = $null   # shown with the last priority, e.g. 'Urgent? Call the helpdesk on 03 123 45 67.'
$FeedbackUrgentLink      = $null   # 'https://...' or 'tel:+3231234567'

$keys = @(
  "HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\$Id\policy",
  "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$Id\policy"
)

$switches = @{
  webClientEnabled    = $WebClientEnabled
  environmentsEnabled = $EnvironmentsEnabled
  feedbackEnabled     = $FeedbackEnabled
}
$texts = @{
  feedbackEmail           = $FeedbackEmail
  feedbackDefaultPriority = $FeedbackDefaultPriority
  feedbackSubjectBug      = $FeedbackSubjectBug
  feedbackSubjectIdea     = $FeedbackSubjectIdea
  feedbackUrgentText      = $FeedbackUrgentText
  feedbackUrgentLink      = $FeedbackUrgentLink
}

foreach ($key in $keys) {
  # -Force creates the missing parent keys. Only when the key is missing:
  # on an existing key it would throw away what is already there.
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name 'sharedConfigUrl' -Value $Url -Type String

  foreach ($name in $switches.Keys) {
    if ($null -ne $switches[$name]) {
      Set-ItemProperty -Path $key -Name $name -Value ([int][bool]$switches[$name]) -Type DWord
    }
  }
  foreach ($name in $texts.Keys) {
    if ($null -ne $texts[$name]) {
      Set-ItemProperty -Path $key -Name $name -Value $texts[$name] -Type String
    }
  }
  # A list is a subkey with one numbered value per entry.
  if ($null -ne $FeedbackPriorities) {
    $list = Join-Path $key 'feedbackPriorities'
    if (Test-Path $list) { Remove-Item -Path $list -Recurse -Force }
    New-Item -Path $list -Force | Out-Null
    $i = 1
    foreach ($priority in $FeedbackPriorities) {
      Set-ItemProperty -Path $list -Name ([string]$i) -Value $priority -Type String
      $i++
    }
  }
}

Write-Output "BC Buddy shared file set to $Url"
