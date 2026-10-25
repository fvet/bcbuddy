<#
  Detection script for an Intune Remediation, with Set-BCBuddyPolicy.ps1 as
  the remediation script. Exits 1 when the shared BC Buddy file, or one of the
  other settings given below, is missing or different in Edge or Chrome, so
  Intune runs the remediation; 0 when everything is in place. Use the same
  values as in Set-BCBuddyPolicy.ps1; $null skips a setting.
#>

$Url = 'https://example.com/bc-buddy.json'
$Id  = 'jpgpcfecpdcocjlepdfceahamliimjdl'

$WebClientEnabled    = $null
$EnvironmentsEnabled = $null
$FeedbackEnabled     = $null

$FeedbackEmail           = $null
$FeedbackPriorities      = $null
$FeedbackDefaultPriority = $null
$FeedbackSubjectBug      = $null
$FeedbackSubjectIdea     = $null

$keys = @(
  "HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\$Id\policy",
  "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$Id\policy"
)

$expected = @{ sharedConfigUrl = $Url }
if ($null -ne $WebClientEnabled)    { $expected.webClientEnabled    = [int][bool]$WebClientEnabled }
if ($null -ne $EnvironmentsEnabled) { $expected.environmentsEnabled = [int][bool]$EnvironmentsEnabled }
if ($null -ne $FeedbackEnabled)     { $expected.feedbackEnabled     = [int][bool]$FeedbackEnabled }
if ($null -ne $FeedbackEmail)           { $expected.feedbackEmail           = $FeedbackEmail }
if ($null -ne $FeedbackDefaultPriority) { $expected.feedbackDefaultPriority = $FeedbackDefaultPriority }
if ($null -ne $FeedbackSubjectBug)      { $expected.feedbackSubjectBug      = $FeedbackSubjectBug }
if ($null -ne $FeedbackSubjectIdea)     { $expected.feedbackSubjectIdea     = $FeedbackSubjectIdea }

foreach ($key in $keys) {
  foreach ($name in $expected.Keys) {
    $value = (Get-ItemProperty -Path $key -Name $name -ErrorAction SilentlyContinue).$name
    if ($null -eq $value -or "$value" -ne "$($expected[$name])") {
      Write-Output "Not set: $key $name"
      exit 1
    }
  }
  if ($null -ne $FeedbackPriorities) {
    $list = Get-ItemProperty -Path (Join-Path $key 'feedbackPriorities') -ErrorAction SilentlyContinue
    $i = 1
    foreach ($priority in @($FeedbackPriorities) + @($null)) {
      $value = if ($list) { $list.([string]$i) } else { $null }
      if ("$value" -ne "$priority") {
        Write-Output "Not set: $key feedbackPriorities"
        exit 1
      }
      $i++
    }
  }
}

Write-Output 'BC Buddy policy is set.'
exit 0
