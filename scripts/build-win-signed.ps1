param(
  [string]$CertPath = $env:WIN_CSC_LINK,
  [string]$CertPassword = $env:WIN_CSC_KEY_PASSWORD,
  [string]$PublisherName = $env:WIN_CSC_PUBLISHER_NAME
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$certOutputDir = Join-Path $workspaceRoot "build\\certs"
$useDevCert = $false

if (-not $CertPath) {
  $CertPath = $env:CSC_LINK
}

if (-not $CertPassword) {
  $CertPassword = $env:CSC_KEY_PASSWORD
}

if ($CertPath -and -not (Test-Path -LiteralPath $CertPath)) {
  throw "Certificate file not found: $CertPath"
}

if (-not $CertPath) {
  New-Item -ItemType Directory -Path $certOutputDir -Force | Out-Null
  $defaultDevCertPath = Join-Path $certOutputDir "clawhome-dev-code-signing.pfx"

  if (-not $CertPassword) {
    $CertPassword = "clawhome-dev-cert"
  }

  if (Test-Path -LiteralPath $defaultDevCertPath) {
    $CertPath = $defaultDevCertPath
    $useDevCert = $true
  } else {
    $securePassword = ConvertTo-SecureString -String $CertPassword -Force -AsPlainText
    $devCert = New-SelfSignedCertificate `
      -Type CodeSigningCert `
      -Subject "CN=ClawHome Dev Code Signing" `
      -KeyAlgorithm RSA `
      -KeyLength 2048 `
      -CertStoreLocation "Cert:\\CurrentUser\\My" `
      -NotAfter (Get-Date).AddYears(2)

    Export-PfxCertificate -Cert $devCert -FilePath $defaultDevCertPath -Password $securePassword | Out-Null
    $CertPath = $defaultDevCertPath
    $useDevCert = $true
  }
}

$resolvedCertPath = (Resolve-Path -LiteralPath $CertPath).Path
$env:CSC_LINK = $resolvedCertPath

if ($CertPassword) {
  $env:CSC_KEY_PASSWORD = $CertPassword
}

if ($PublisherName) {
  $env:WIN_CSC_PUBLISHER_NAME = $PublisherName
}

Write-Host "Using certificate: $resolvedCertPath"
if ($useDevCert) {
  Write-Host "Generated a local self-signed development certificate."
}

pnpm build:win
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Windows package build completed. Artifacts are in dist\\."
