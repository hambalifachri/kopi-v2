$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $here "KopkenSyncApp.cs"
$output = Join-Path $here "Kopken Menu Sync.exe"

if (Test-Path $output) { Remove-Item -LiteralPath $output -Force }

Add-Type -Path $source `
  -ReferencedAssemblies "System.dll", "System.Drawing.dll", "System.Windows.Forms.dll" `
  -OutputAssembly $output `
  -OutputType WindowsApplication

Write-Host "BERHASIL: $output"
