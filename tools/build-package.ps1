<#
  Builds the ZIP file for the Chrome Web Store / Edge Add-ons.

  Only what the extension needs for the user goes in: manifest, src, _locales
  and the PNG icons. Tests, samples, the SVG sources and the icon build script
  stay out — they only make the package larger and give the reviewer files to
  read that do nothing.
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
if (-not $version) { throw 'No version in manifest.json.' }

# What goes into the package.
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
    if (-not (Test-Path $source)) { throw "Missing: $item" }
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
  Write-Host "Package ready: $zip ($size KB)"

  # Small check: the manifest must sit at the top of the ZIP, not in a
  # subfolder — otherwise the Web Store rejects the package.
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $names = $archive.Entries | ForEach-Object { $_.FullName }
    if ($names -notcontains 'manifest.json') { throw 'manifest.json is not at the root of the ZIP.' }
    Write-Host "$($names.Count) files."
  } finally {
    $archive.Dispose()
  }
} finally {
  Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
