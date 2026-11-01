<#
.SYNOPSIS
  CI smoke test: installs a throw-away signed COPY of the MSIX, checks its identity, then removes it.
.DESCRIPTION
  Author: Diamond Rubinny.
  The uploaded Store package stays unsigned. The temporary certificate is created on the CI runner,
  used once, and deleted at the end; it is never exported out of the run.
#>
[CmdletBinding()]
param([Parameter(Mandatory)] [string] $Package)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$name = $env:MSIX_IDENTITY_NAME
$publisher = $env:MSIX_PUBLISHER
$msix = Get-Item -Path $Package | Select-Object -First 1
if (-not $msix) { throw "Package not found: $Package" }
$expectedVersion = [regex]::Match($msix.Name, '_(\d+\.\d+\.\d+\.\d+)_').Groups[1].Value

$kitsBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$signtool = Get-ChildItem -LiteralPath $kitsBin -Directory |
    Where-Object { $_.Name -match '^10\.\d+\.\d+\.\d+$' -and (Test-Path (Join-Path $_.FullName 'x64\signtool.exe')) } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 |
    ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' }
if (-not $signtool) { throw 'signtool.exe not found.' }

$work = Join-Path ([IO.Path]::GetTempPath()) ("keyflip-msix-test-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
$copy = Join-Path $work $msix.Name
Copy-Item -LiteralPath $msix.FullName -Destination $copy

$cert = $null
$trusted = $null
try {
    $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher -KeyUsage DigitalSignature `
        -FriendlyName 'KeyFlip CI smoke test (temporary)' -CertStoreLocation 'Cert:\CurrentUser\My' `
        -NotAfter (Get-Date).AddDays(1) `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')

    & $signtool sign /fd SHA256 /sha1 $cert.Thumbprint $copy | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "signtool failed ($LASTEXITCODE)." }

    $cer = Join-Path $work 'ci.cer'
    Export-Certificate -Cert $cert -FilePath $cer | Out-Null
    $trusted = Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople'

    Add-AppxPackage -Path $copy
    $installed = Get-AppxPackage -Name $name
    if (-not $installed) { throw "Package $name is not installed after Add-AppxPackage." }
    if ($installed.Publisher -ne $publisher) { throw "Publisher mismatch: '$($installed.Publisher)'." }
    if ($installed.Version -ne $expectedVersion) { throw "Version mismatch: '$($installed.Version)' vs '$expectedVersion'." }
    if (-not (Test-Path (Join-Path $installed.InstallLocation 'KeyFlip.exe'))) { throw 'KeyFlip.exe missing in the installed package.' }
    Write-Host "Install OK: $($installed.PackageFullName)"

    Remove-AppxPackage -Package $installed.PackageFullName
    if (Get-AppxPackage -Name $name) { throw 'Package still present after Remove-AppxPackage.' }
    Write-Host 'Uninstall OK.'
}
finally {
    if ($trusted) { Remove-Item -LiteralPath "Cert:\LocalMachine\TrustedPeople\$($trusted.Thumbprint)" -ErrorAction SilentlyContinue }
    if ($cert) { Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
