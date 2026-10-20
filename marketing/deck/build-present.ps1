<#
    Builds present.html: the deck as one page you can open from the repo and
    present full screen, without Claude.

    Usage:  powershell -ExecutionPolicy Bypass -File marketing\deck\build-present.ps1

    The slides in project/slides/ stay the single source; present.html is
    generated from them and project/deck.json (title and slide order). Run
    this again after every change to a slide and commit both.

    What the script changes on the way:
    - /_blob/<id> image addresses (assets in the Claude artifact) become the
      matching files in marketing/screenshots/ and marketing/brand/.
    - <x-icon> becomes an inline SVG, drawn here.
    - <aside> speaker notes stay in the page but are hidden.
#>

$ErrorActionPreference = 'Stop'
$deckDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Asset id in the artifact -> file, relative to present.html. Keep in step with
# the table in marketing/README.md.
$assets = @{
    'd5d4269ac0d2f7c4d225856646e6921a' = '../brand/bc-buddy-logo-512.png'
    '45e5c32bbe176b133035d872f1bcfe57' = '../screenshots/crop-without-copy-values.png'
    'b83c3c20645de7777c200dbe28242b83' = '../screenshots/crop-with-copy-values.png'
    '49d1904a43219c8f1547216b7ca1b486' = '../screenshots/without-maximize.jpg'
    '8d8d3b1bbe3de89ba735fd3251917441' = '../screenshots/with-maximize.jpg'
    'b69a95fb6519404ca99ee53e655df60a' = '../screenshots/crop-without-pin-action-bar.png'
    '03a7ccee0d99abe13b8242dedf5773fc' = '../screenshots/crop-with-pin-action-bar.png'
    '378c3400f229e0005bc1d59350b01a08' = '../screenshots/crop-without-dropdown.png'
    '2396056c0c385b8347eeed1cf5fffc09' = '../screenshots/crop-with-dropdown.png'
    'c707810d8fba7cee35ef4e9fae39c52a' = '../screenshots/crop-without-week-numbers.png'
    '994a6c3781cb1d5a15bc719c069b2eae' = '../screenshots/crop-with-week-numbers.png'
    'd70a63132784cd3481ea19db750c0746' = '../screenshots/crop-without-current-line.png'
    '15dcc4b67044a519f2901594d453e1e9' = '../screenshots/crop-with-current-line.png'
    '713db8844a4ea6c0053779dccff5edf8' = '../screenshots/crop-with-keyboard-shortcuts.png'
    '10bf7cb2b2055cc5fc817e54da4517b1' = '../screenshots/crop-without-striped-rows.png'
    'f3cc093f6f6c883fc0262f3678ec9d81' = '../screenshots/crop-with-striped-rows.png'
    'bdef8623d9456cae2883fedd94f0fec5' = '../screenshots/crop-without-hide-factbox.png'
    'a6b12f951802a3baa0926db313607a65' = '../screenshots/crop-with-hide-factbox.png'
    'f45f098d2f97fa1261c3c5c82610bc54' = '../screenshots/without-env-colours.jpg'
    '34b09d6a87dde8d87ecdfd226505e1fc' = '../screenshots/with-env-colours.jpg'
}

# Simple line icons on a 24x24 grid for the <x-icon> names the slides use.
$icons = @{
    'CheckCircle' = '<circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'
    'Lock'        = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
    'Users'       = '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/><circle cx="17" cy="9" r="3"/><path d="M16 14.2a5 5 0 0 1 6 4.8v2"/>'
    'Lightning'   = '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>'
}

$deck = [System.IO.File]::ReadAllText((Join-Path $deckDir 'project\deck.json'), $utf8) | ConvertFrom-Json

$slides = foreach ($id in $deck.order) {
    $html = [System.IO.File]::ReadAllText((Join-Path $deckDir "project\slides\$id.html"), $utf8)

    $html = [regex]::Replace($html, '/_blob/([0-9a-f]{32})', {
        param($m)
        $file = $assets[$m.Groups[1].Value]
        if (-not $file) { throw "Slide '$id' uses asset $($m.Groups[1].Value), which has no file in the map." }
        $file
    })

    $html = [regex]::Replace($html, '<x-icon name="(\w+)" style="([^"]*)"></x-icon>', {
        param($m)
        $shape = $icons[$m.Groups[1].Value]
        if (-not $shape) { throw "Slide '$id' uses icon '$($m.Groups[1].Value)', which is not drawn here." }
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;' + $m.Groups[2].Value + '">' + $shape + '</svg>'
    })

    if ($html -match '<x-') { throw "Slide '$id' uses an element present.html cannot draw: $($Matches[0])" }
    $html.Trim()
}

$fonts = ($deck.faces.PSObject.Properties | ForEach-Object { '<link rel="stylesheet" href="' + $_.Value.href + '">' }) -join "`n"

$template = [System.IO.File]::ReadAllText((Join-Path $deckDir 'present.template.html'), $utf8)
$page = $template.Replace('{{TITLE}}', $deck.title).Replace('{{FONTS}}', $fonts).Replace('{{SLIDES}}', ($slides -join "`n"))
[System.IO.File]::WriteAllText((Join-Path $deckDir 'present.html'), $page, $utf8)
Write-Host "present.html: $($deck.order.Count) slides"
