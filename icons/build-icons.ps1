<#
    Renders the PNG icons from logo.svg with headless Chrome (or Edge).

    Usage:  powershell -ExecutionPolicy Bypass -File icons\build-icons.ps1

    Every size comes from logo.svg, the full monogram: the toolbar, the
    extensions menu and the options page should show the same brand. The source
    is rendered at 512 px first and then scaled down; headless Chrome does not
    always produce a reliable screenshot at very small window sizes.

    The letters are rasterised with it, so the result does not depend on Segoe
    UI on the user's machine — only on this machine during the build.
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'No Chrome or Edge found.' }

$iconDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$work = Join-Path $env:TEMP 'bcbuddy-icons'
if (-not (Test-Path $work)) { New-Item -ItemType Directory -Path $work | Out-Null }

$render = 512

function Render-Svg([string]$svgName) {
    $svg = Get-Content (Join-Path $iconDir $svgName) -Raw
    $html = @"
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  svg{display:block;width:${render}px;height:${render}px}
</style>
$svg
"@
    $htmlFile = Join-Path $work ($svgName + '.html')
    $pngFile = Join-Path $work ($svgName + '.png')
    Set-Content -Path $htmlFile -Value $html -Encoding utf8
    if (Test-Path $pngFile) { Remove-Item $pngFile }

    $url = 'file:///' + ($htmlFile -replace '\\', '/')
    & $browser --headless=new --disable-gpu --no-sandbox --hide-scrollbars `
        --force-device-scale-factor=1 --default-background-color=00000000 `
        --user-data-dir="$work\profile" --virtual-time-budget=4000 `
        --window-size="$render,$render" --screenshot="$pngFile" $url | Out-Null

    if (-not (Test-Path $pngFile)) { throw "Rendering $svgName failed." }
    return $pngFile
}

function Save-Resized([string]$sourcePng, [int]$size, [string]$target) {
    $src = [System.Drawing.Image]::FromFile($sourcePng)
    try {
        $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
        $g.Dispose()
        $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
    } finally {
        $src.Dispose()
    }
}

$bigPng = Render-Svg 'logo.svg'

$targets = @(
    @{ Size = 128; Png = $bigPng },
    @{ Size = 48;  Png = $bigPng },
    @{ Size = 32;  Png = $bigPng },
    @{ Size = 16;  Png = $bigPng }
)

foreach ($t in $targets) {
    $out = Join-Path $iconDir ("icon{0}.png" -f $t.Size)
    Save-Resized $t.Png $t.Size $out
    Write-Host ("icon{0}.png  ({1} bytes)" -f $t.Size, (Get-Item $out).Length) -ForegroundColor Green
}


<#
    The store icon follows different rules from the toolbar icon. The Web Store
    wants a 128x128 PNG where the brand itself is no larger than 96x96: the
    16 px around it must stay transparent, because the store puts its own frame
    and shadow around it. If the artwork fills the full 128 px, it collides
    with that frame.

    In the toolbar the opposite applies — there the brand may fill the space —
    so this is a separate file and not a replacement for icon128.png.
    It also does not go in the package; you upload it in the dashboard.
#>

function Get-AlphaBounds([System.Drawing.Bitmap]$bmp) {
    $rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $stride = $data.Stride
    try {
        $bytes = New-Object byte[] ($stride * $bmp.Height)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    } finally {
        $bmp.UnlockBits($data)
    }

    $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $row = $y * $stride
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            # Only alpha counts; we include semi-transparent edge pixels from
            # 8 up, so antialiasing does not artificially inflate the bound.
            if ($bytes[$row + $x * 4 + 3] -gt 8) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    if ($maxX -lt 0) { throw 'The render is fully transparent.' }
    return @{ X = $minX; Y = $minY; W = $maxX - $minX + 1; H = $maxY - $minY + 1 }
}

function Save-StoreIcon([string]$sourcePng, [int]$canvas, [int]$content, [string]$target) {
    $src = [System.Drawing.Bitmap]::FromFile($sourcePng)
    try {
        $bounds = Get-AlphaBounds $src
        # The brand is wider than tall; fitting within 96x96 means scaling on
        # width and centering vertically.
        $scale = [Math]::Min($content / $bounds.W, $content / $bounds.H)
        $w = [int][Math]::Round($bounds.W * $scale)
        $h = [int][Math]::Round($bounds.H * $scale)

        $bmp = New-Object System.Drawing.Bitmap($canvas, $canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        $dest = New-Object System.Drawing.Rectangle(
            [int][Math]::Round(($canvas - $w) / 2), [int][Math]::Round(($canvas - $h) / 2), $w, $h)
        $from = New-Object System.Drawing.Rectangle($bounds.X, $bounds.Y, $bounds.W, $bounds.H)
        $g.DrawImage($src, $dest, $from, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()

        $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        return @{ W = $w; H = $h; Pad = $dest.X }
    } finally {
        $src.Dispose()
    }
}

$storeIcon = Join-Path $iconDir 'store-icon128.png'
$result = Save-StoreIcon $bigPng 128 96 $storeIcon
Write-Host ("store-icon128.png  brand {0}x{1}, {2} px margin ({3} bytes)" -f `
    $result.W, $result.H, $result.Pad, (Get-Item $storeIcon).Length) -ForegroundColor Green

Write-Host "`nDone." -ForegroundColor Green
