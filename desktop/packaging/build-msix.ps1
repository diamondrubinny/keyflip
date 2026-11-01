<#
.SYNOPSIS
  Builds an unsigned MSIX of KeyFlip for Microsoft Store submission (the Store signs it).
.DESCRIPTION
  Author: Diamond Rubinny.
  Identity values come from environment variables (GitHub repository variables, see docs/MSIX_STORE.md):
    MSIX_IDENTITY_NAME, MSIX_PUBLISHER, MSIX_PUBLISHER_DISPLAY
.EXAMPLE
  ./build-msix.ps1 -ExePath in/KeyFlip.exe -Version 0.1.0 -OutDir out
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ExePath,
    [Parameter(Mandatory)] [string] $Version,   # MAJOR.MINOR.PATCH (".0" revision is appended)
    [Parameter(Mandatory)] [string] $OutDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string] $message) { Write-Error $message; exit 1 }

# ---------- validate inputs ----------
$name = $env:MSIX_IDENTITY_NAME
$publisher = $env:MSIX_PUBLISHER
$publisherDisplay = $env:MSIX_PUBLISHER_DISPLAY

if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($publisher) -or [string]::IsNullOrWhiteSpace($publisherDisplay)) {
    Fail 'MSIX_IDENTITY_NAME, MSIX_PUBLISHER and MSIX_PUBLISHER_DISPLAY must be set (Partner Center → Product identity).'
}
if ($name -notmatch '^[A-Za-z0-9.\-]{3,50}$') { Fail "MSIX_IDENTITY_NAME has an invalid format: '$name'." }
if ($publisher -notmatch '^CN=[^<>&"]{1,8000}$') { Fail 'MSIX_PUBLISHER must start with "CN=" exactly as shown in Partner Center.' }
if ($publisherDisplay.Length -gt 256 -or $publisherDisplay -match '[<>]') { Fail 'MSIX_PUBLISHER_DISPLAY has an invalid value.' }
if ($Version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}$') { Fail "Version must be MAJOR.MINOR.PATCH, got '$Version'." }
$msixVersion = "$Version.0"   # The Store requires the 4th part to be 0.

if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) { Fail "EXE not found: $ExePath" }

# ---------- locate Windows SDK tools ----------
$kitsBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$sdkDir = Get-ChildItem -LiteralPath $kitsBin -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^10\.\d+\.\d+\.\d+$' -and (Test-Path (Join-Path $_.FullName 'x64\makeappx.exe')) } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
if (-not $sdkDir) { Fail "Windows SDK (makeappx.exe) not found under $kitsBin." }
$makeappx = Join-Path $sdkDir.FullName 'x64\makeappx.exe'
$makepri = Join-Path $sdkDir.FullName 'x64\makepri.exe'
Write-Host "Windows SDK: $($sdkDir.Name)"

# ---------- layout ----------
$here = $PSScriptRoot
$work = Join-Path ([IO.Path]::GetTempPath()) ("keyflip-msix-" + [guid]::NewGuid().ToString('N'))
$layout = Join-Path $work 'layout'
New-Item -ItemType Directory -Path (Join-Path $layout 'Assets') -Force | Out-Null

try {
    Copy-Item -LiteralPath $ExePath -Destination (Join-Path $layout 'KeyFlip.exe')
    Copy-Item -Path (Join-Path $here 'Assets\*.png') -Destination (Join-Path $layout 'Assets')
    foreach ($legal in 'LICENSE', 'NOTICE.md') {
        $src = Join-Path $here "..\..\$legal"
        if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $layout }
    }

    $esc = { param($v) [System.Security.SecurityElement]::Escape($v) }
    $manifest = Get-Content -LiteralPath (Join-Path $here 'AppxManifest.template.xml') -Raw -Encoding UTF8
    # __PUBLISHER_DISPLAY__ must be replaced before __PUBLISHER__ (prefix overlap).
    $manifest = $manifest.Replace('__NAME__', (& $esc $name))
    $manifest = $manifest.Replace('__PUBLISHER_DISPLAY__', (& $esc $publisherDisplay))
    $manifest = $manifest.Replace('__PUBLISHER__', (& $esc $publisher))
    $manifest = $manifest.Replace('__VERSION__', $msixVersion)
    if ($manifest -match '__[A-Z_]+__') { Fail "Unreplaced token in manifest: $($Matches[0])" }
    $null = [xml]$manifest   # well-formed check
    $manifestPath = Join-Path $layout 'AppxManifest.xml'
    [IO.File]::WriteAllText($manifestPath, $manifest, [Text.UTF8Encoding]::new($false))

    # ---------- resources.pri (resolves scale-/targetsize- qualified logos) ----------
    $priConfig = Join-Path $work 'priconfig.xml'
    & $makepri createconfig /cf $priConfig /dq he-IL /pv 10.0.0 /o | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail "makepri createconfig failed ($LASTEXITCODE)." }
    & $makepri new /pr $layout /cf $priConfig /mn $manifestPath /of (Join-Path $layout 'resources.pri') /o | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail "makepri new failed ($LASTEXITCODE)." }

    # ---------- pack ----------
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $msix = Join-Path (Resolve-Path -LiteralPath $OutDir).Path "KeyFlip_${msixVersion}_x64.msix"
    & $makeappx pack /d $layout /p $msix /o | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail "makeappx pack failed ($LASTEXITCODE)." }

    $hash = (Get-FileHash -LiteralPath $msix -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $(Split-Path $msix -Leaf)" | Set-Content -LiteralPath (Join-Path $OutDir 'SHA256SUMS.txt') -Encoding ascii
    Write-Host "Built $msix ($([math]::Round((Get-Item $msix).Length / 1MB, 1)) MB) sha256:$hash"
}
finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
