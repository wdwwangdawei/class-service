$ErrorActionPreference = "Stop"

$workDir = "C:\Users\Admin\AppData\Local\Temp\class-service-work\installer-build"
$shell = Join-Path $workDir "Setup_Shell.exe"
$uninstall = Join-Path $workDir "Uninstall.exe"
$zip = Join-Path $workDir "app.zip"
$marker = "APPINSTALL_END_V1"

$cnChars = @(0x73ED, 0x7EA7, 0x670D, 0x52A1, 0x7BA1, 0x7406, 0x7CFB, 0x7EDF)
$cnName = ""
foreach ($c in $cnChars) { $cnName += [char]$c }
$targetFileName = $cnName + "-Setup.exe"
$output = Join-Path $workDir $targetFileName
$outputTemp = Join-Path $workDir "Setup_building.exe"

foreach ($p in @($shell, $uninstall, $zip)) { if (-not (Test-Path $p)) { throw "Missing: $p" } }

$shellBytes = [IO.File]::ReadAllBytes($shell)
$uninstallBytes = [IO.File]::ReadAllBytes($uninstall)
$zipBytes = [IO.File]::ReadAllBytes($zip)

Write-Host ("Shell: {0} bytes" -f $shellBytes.Length)
Write-Host ("Uninstall: {0} bytes" -f $uninstallBytes.Length)
Write-Host ("Zip: {0} bytes ({1:N2} MB)" -f $zipBytes.Length, ($zipBytes.Length/1MB))

$uninstallLenBytes = [BitConverter]::GetBytes([uint32]$uninstallBytes.Length)
$zipLenBytes = [BitConverter]::GetBytes([uint32]$zipBytes.Length)
$markerBytes = [Text.Encoding]::ASCII.GetBytes($marker)

if (Test-Path $outputTemp) { Remove-Item $outputTemp -Force }
$fs = [IO.File]::Open($outputTemp, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
$bw = New-Object IO.BinaryWriter($fs, [Text.Encoding]::ASCII)
try {
    $bw.Write($shellBytes)
    $bw.Write($uninstallBytes)
    $bw.Write($uninstallLenBytes)
    $bw.Write($zipBytes)
    $bw.Write($zipLenBytes)
    $bw.Write($markerBytes)
    $bw.Flush()
} finally {
    if ($bw -ne $null) { $bw.Close() }
    if ($fs -ne $null) { $fs.Dispose() }
}

if (Test-Path $output) { Remove-Item $output -Force }
Rename-Item -Path $outputTemp -NewName $targetFileName -Force

$verifyBytes = [IO.File]::ReadAllBytes($output)
$found = $false
$markerPos = -1
for ($i = $verifyBytes.Length - $markerBytes.Length; $i -ge 0; $i--) {
    $match = $true
    for ($j = 0; $j -lt $markerBytes.Length; $j++) {
        if ($verifyBytes[$i + $j] -ne $markerBytes[$j]) { $match = $false; break }
    }
    if ($match) { $found = $true; $markerPos = $i; break }
}
if (-not $found) { throw "Marker not found in output - merge failed" }

$zipLen = [BitConverter]::ToInt32($verifyBytes, $markerPos - 4)
$uninstLen = [BitConverter]::ToInt32($verifyBytes, $markerPos - 4 - 4 - $zipLen)
Write-Host ("Verification: zipLen={0}, uninstLen={1}" -f $zipLen, $uninstLen)
Write-Host ("SUCCESS: {0}  ({1:N2} MB)" -f $output, ((Get-Item $output).Length/1MB))
