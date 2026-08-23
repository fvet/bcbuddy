<#
  Bouwt het ZIP-bestand voor de Chrome Web Store / Edge Add-ons.

  Enkel wat de extensie bij de gebruiker nodig heeft gaat mee: manifest,
  src, _locales en de PNG-iconen. Tests, voorbeelden, de SVG-bronnen en het
  icon-buildscript blijven achter - die maken het pakket enkel groter en
  geven de reviewer bestanden te lezen die niets doen.
#>
[CmdletBinding()]
param(
  [string]$OutDir
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..')
if (-not $OutDir) { $OutDir = Join-Path $root 'dist' }

$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version
if (-not $version) { throw 'Geen version in manifest.json.' }

# Wat mee in het pakket gaat.
$include = @(
  'manifest.json',
  'src',
  '_locales',
  'icons\icon16.png',
  'icons\icon32.png',
  'icons\icon48.png',
  'icons\icon128.png'
)

$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("bcbuddy-pkg-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null

try {
  foreach ($item in $include) {
    $source = Join-Path $root $item
    if (-not (Test-Path $source)) { throw "Ontbreekt: $item" }
    $target = Join-Path $staging $item
    $parent = Split-Path $target -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item $source $target -Recurse
  }

  if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
  $zip = Join-Path (Resolve-Path $OutDir) "bcbuddy-$version.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }

  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -CompressionLevel Optimal

  $size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
  Write-Host "Pakket klaar: $zip ($size KB)"

  # Kleine controle: het manifest moet bovenaan in de ZIP staan, niet in een
  # submap - anders weigert de Web Store het pakket.
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $names = $archive.Entries | ForEach-Object { $_.FullName }
    if ($names -notcontains 'manifest.json') { throw 'manifest.json staat niet in de wortel van de ZIP.' }
    Write-Host "$($names.Count) bestanden."
  } finally {
    $archive.Dispose()
  }
} finally {
  Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
