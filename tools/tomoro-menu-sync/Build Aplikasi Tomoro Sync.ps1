$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $here "TomoroSyncApp.cs"
$output = Join-Path $here "Tomoro Menu Sync.exe"

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { $csc = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (-not (Test-Path $csc)) { throw "C# compiler Windows tidak ditemukan." }

& $csc /nologo /target:winexe /out:$output /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll $source
if ($LASTEXITCODE -ne 0) { throw "Build aplikasi gagal." }
Write-Host "EXE siap: $output"
