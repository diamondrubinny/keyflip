<#
.SYNOPSIS
  Builds the Microsoft Store MSIX for KeyFlip (x64, self-contained .NET 10).
.DESCRIPTION
  1. dotnet publish with -p:KeyFlipPackaged=true (StartupTask instead of the Run key)
  2. copies AppxManifest.xml (version injected) and Assets into the layout
  3. makepri (resources.pri for the unplated taskbar icons) + makeappx pack
  The output is UNSIGNED: the Microsoft Store signs packages on submission.
  Use -TestSign to also produce a self-signed copy (+ .cer) for local install tests.
.EXAMPLE
  pwsh desktop/KeyFlip.Package/build-msix.ps1 -OutDir out/msix -TestSign
#>
[CmdletBinding()]
param(
  [string]$OutDir = "out/msix",
  [switch]$TestSign
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pkgDir = $PSScriptRoot
$OutDir = [IO.Path]::GetFullPath((Join-Path $repo $OutDir))
$layout = Join-Path $OutDir 'layout'

# Version: MAJOR.MINOR.PATCH from Directory.Build.props -> MAJOR.MINOR.PATCH.0
$props = Get-Content (Join-Path $repo 'desktop\Directory.Build.props') -Raw
if ($props -notmatch '<Version>(\d+\.\d+\.\d+)</Version>') { throw 'Version not found in Directory.Build.props' }
$version = $Matches[1]
$msixVersion = "$version.0"
Write-Host "KeyFlip $msixVersion"

# Windows SDK tools (newest installed SDK)
$sdkBin = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.*" -Directory |
  Sort-Object { [version]$_.Name } -Descending |
  Where-Object { Test-Path (Join-Path $_.FullName 'x64\makeappx.exe') } | Select-Object -First 1
if (-not $sdkBin) { throw 'Windows 10/11 SDK (makeappx.exe) not found' }
$tools = Join-Path $sdkBin.FullName 'x64'
$makeappx = Join-Path $tools 'makeappx.exe'
$makepri = Join-Path $tools 'makepri.exe'
$signtool = Join-Path $tools 'signtool.exe'

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $layout | Out-Null

# 1. Publish
dotnet publish (Join-Path $repo 'desktop\KeyFlip.App') -c Release -r win-x64 --self-contained true `
  -p:KeyFlipPackaged=true -p:PublishSingleFile=false -p:DebugType=none -o $layout
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }

# 2. Manifest + assets + license files
(Get-Content (Join-Path $pkgDir 'AppxManifest.xml') -Raw).Replace('__VERSION__', $msixVersion) |
  Set-Content (Join-Path $layout 'AppxManifest.xml') -Encoding utf8
Copy-Item (Join-Path $pkgDir 'Assets') (Join-Path $layout 'Assets') -Recurse
Copy-Item (Join-Path $repo 'LICENSE'), (Join-Path $repo 'NOTICE.md') $layout

# 3. resources.pri, then pack
$priConfig = Join-Path $OutDir 'priconfig.xml'
& $makepri createconfig /cf $priConfig /dq en-US /pv 10.0.0 /o
if ($LASTEXITCODE -ne 0) { throw 'makepri createconfig failed' }
& $makepri new /pr $layout /cf $priConfig /mn (Join-Path $layout 'AppxManifest.xml') /of (Join-Path $layout 'resources.pri') /o
if ($LASTEXITCODE -ne 0) { throw 'makepri new failed' }

$msix = Join-Path $OutDir "KeyFlip-$version-x64.msix"
& $makeappx pack /d $layout /p $msix /o
if ($LASTEXITCODE -ne 0) { throw 'makeappx pack failed' }
Write-Host "Store package (unsigned): $msix"

# 4. Optional self-signed copy for local install tests (never upload this one)
if ($TestSign) {
  $publisher = ([xml](Get-Content (Join-Path $layout 'AppxManifest.xml'))).Package.Identity.Publisher
  $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher -KeyUsage DigitalSignature `
    -FriendlyName 'KeyFlip local test' -CertStoreLocation 'Cert:\CurrentUser\My' `
    -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
  $pfxPassword = ConvertTo-SecureString ([guid]::NewGuid().ToString('N')) -AsPlainText -Force
  $pfx = Join-Path $OutDir 'test-signing.pfx'
  Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pfxPassword | Out-Null
  Export-Certificate -Cert $cert -FilePath (Join-Path $OutDir 'KeyFlip-test.cer') | Out-Null

  $testMsix = Join-Path $OutDir "KeyFlip-$version-x64-TEST-SIGNED.msix"
  Copy-Item $msix $testMsix
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pfxPassword))
  & $signtool sign /fd SHA256 /f $pfx /p $plain $testMsix
  if ($LASTEXITCODE -ne 0) { throw 'signtool failed' }
  Remove-Item $pfx -Force
  Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force
  Write-Host "Test-signed copy: $testMsix (+ KeyFlip-test.cer)"
}
