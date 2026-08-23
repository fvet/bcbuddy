<#
    Draait de testpagina's in headless Chrome (of Edge) en toont het resultaat.

    Gebruik:  powershell -ExecutionPolicy Bypass -File tests\run-tests.ps1
#>

$ErrorActionPreference = 'Stop'

function Find-Browser {
    # Expliciete keuze wint: op een build-agent staat de browser zelden waar we
    # hem hier verwachten, en dan wil je hem kunnen aanwijzen zonder dit script
    # aan te passen.
    if ($env:CHROME_PATH) {
        if (Test-Path $env:CHROME_PATH) { return $env:CHROME_PATH }
        throw "CHROME_PATH verwijst naar niets: $env:CHROME_PATH"
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

    # Valt de vaste lijst tegen, dan telt wat er in PATH staat. Dat vangt zowel
    # een andere installatiemap als een niet-Windows agent op.
    foreach ($name in @('chrome', 'google-chrome', 'chromium', 'msedge')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }

    throw 'Geen Chrome of Edge gevonden. Zet CHROME_PATH naar het uitvoerbaar bestand.'
}

$browser = Find-Browser

$testDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$work = Join-Path $env:TEMP 'bcem-tests'
if (-not (Test-Path $work)) { New-Item -ItemType Directory -Path $work | Out-Null }

$suites = @('test-core.html', 'test-options.html', 'test-popup.html')
$totalFailed = 0

foreach ($suite in $suites) {
    $url = 'file:///' + ((Join-Path $testDir $suite) -replace '\\', '/')
    $dumpFile = Join-Path $work ($suite + '.txt')

    & $browser --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files `
        --user-data-dir="$work\profile" --virtual-time-budget=20000 --dump-dom $url |
        Out-File -FilePath $dumpFile -Encoding utf8

    $dom = Get-Content $dumpFile -Raw
    $start = $dom.IndexOf('id="results"')
    if ($start -lt 0) { Write-Host "$suite : GEEN RESULTATEN" -ForegroundColor Red; $totalFailed++; continue }

    $end = $dom.IndexOf('</div>', $start)
    $body = $dom.Substring($start + 13, $end - $start - 13)
    $lines = $body -split "`n"

    $failed = $lines | Where-Object { $_ -match '^FAIL' }
    $total = ($lines | Where-Object { $_ -match 'TOTAAL' }) -join ''

    if ($failed) {
        Write-Host "$suite" -ForegroundColor Red
        $body -split "`n" | Where-Object { $_ -match '^FAIL|verwacht:|gekregen:|^\s{8}' } | ForEach-Object { Write-Host "  $_" }
        $totalFailed += $failed.Count
    } else {
        Write-Host "$suite  OK" -ForegroundColor Green
    }
    Write-Host "  $total"
}

if ($totalFailed -gt 0) {
    Write-Host "`n$totalFailed check(s) gefaald." -ForegroundColor Red
    exit 1
}
Write-Host "`nAlles geslaagd." -ForegroundColor Green
