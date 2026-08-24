<#
    Runs the test pages in headless Chrome (or Edge) and prints the result.

    Usage:  powershell -ExecutionPolicy Bypass -File tests\run-tests.ps1
#>

$ErrorActionPreference = 'Stop'

function Find-Browser {
    # Explicit choice wins: on a build agent the browser is rarely where we
    # expect it here, and then you want to point at it without editing this
    # script.
    if ($env:CHROME_PATH) {
        if (Test-Path $env:CHROME_PATH) { return $env:CHROME_PATH }
        throw "CHROME_PATH points to nothing: $env:CHROME_PATH"
    }

    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )
    $found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($found) { return $found }

    # If the fixed list fails, what is on PATH counts. That covers both a
    # different install folder and a non-Windows agent.
    foreach ($name in @('chrome', 'google-chrome', 'chromium', 'msedge')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }

    throw 'No Chrome or Edge found. Set CHROME_PATH to the executable.'
}

$browser = Find-Browser

$testDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $testDir
$work = Join-Path $env:TEMP 'bcbuddy-tests'
if (-not (Test-Path $work)) { New-Item -ItemType Directory -Path $work | Out-Null }

# Which languages exist. A page cannot list a directory, so the folder names go
# along in the URL: that way a folder with a name the Web Store rejects reaches
# the checks instead of being quietly skipped.
$locales = (Get-ChildItem (Join-Path $root '_locales') -Directory |
    Select-Object -ExpandProperty Name | Sort-Object) -join ','
if (-not $locales) { throw 'No language folders under _locales.' }

$suites = @('test-core.html', 'test-options.html', 'test-popup.html')
$totalFailed = 0

foreach ($suite in $suites) {
    $url = 'file:///' + ((Join-Path $testDir $suite) -replace '\\', '/') + '?locales=' + $locales
    $dumpFile = Join-Path $work ($suite + '.txt')

    & $browser --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files `
        --user-data-dir="$work\profile" --virtual-time-budget=20000 --dump-dom $url |
        Out-File -FilePath $dumpFile -Encoding utf8

    $dom = Get-Content $dumpFile -Raw
    $start = $dom.IndexOf('id="results"')
    if ($start -lt 0) { Write-Host "$suite : NO RESULTS" -ForegroundColor Red; $totalFailed++; continue }

    $end = $dom.IndexOf('</div>', $start)
    $body = $dom.Substring($start + 13, $end - $start - 13)
    $lines = $body -split "`n"

    $failed = $lines | Where-Object { $_ -match '^FAIL' }
    $notes = $lines | Where-Object { $_ -match '^NOTE' }
    $total = ($lines | Where-Object { $_ -match 'TOTAL' }) -join ''

    # No TOTAL means the suite never finished — a script error part-way leaves
    # the results element on "running...". Without this the suite reports OK
    # simply because it produced no FAIL lines.
    if (-not $total) {
        Write-Host "$suite : DID NOT COMPLETE (no TOTAL; check for a script error)" -ForegroundColor Red
        $totalFailed++
        continue
    }

    if ($failed) {
        Write-Host "$suite" -ForegroundColor Red
        $body -split "`n" | Where-Object { $_ -match '^FAIL|expected:|got:|^\s{8}' } | ForEach-Object { Write-Host "  $_" }
        $totalFailed += $failed.Count
    } else {
        Write-Host "$suite  OK" -ForegroundColor Green
    }
    # Notes fail nothing, so they only help if they are printed either way.
    if ($notes) { $notes | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
    Write-Host "  $total"
}

if ($totalFailed -gt 0) {
    Write-Host "`n$totalFailed check(s) failed." -ForegroundColor Red
    exit 1
}
Write-Host "`nAll passed." -ForegroundColor Green
