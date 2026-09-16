<#
.SYNOPSIS
    NetFloor Architect - Launcher Windows (PowerShell)
.DESCRIPTION
    Delegue au point d'entree unifie ./run.sh via Git Bash / WSL ou execute pnpm en direct.
#>

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ScriptArgs
)

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

# Recherche de bash (Git for Windows, WSL, ou PATH)
$BashExe = $null
$Candidates = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)

foreach ($c in $Candidates) {
    if (Test-Path $c) {
        $BashExe = $c
        break
    }
}

if (-not $BashExe) {
    $cmd = Get-Command bash -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $BashExe = $cmd.Source
    }
}

if ($BashExe) {
    # Execution via Bash (support complet de run.sh)
    $runSh = "$ProjectRoot/run.sh".Replace("\", "/")
    & $BashExe $runSh @ScriptArgs
    exit $LASTEXITCODE
} else {
    # Repli natif si aucun Bash n'est trouve
    Write-Host "NetFloor Architect (Repli PowerShell direct - Bash non detecte)" -ForegroundColor Cyan
    $action = if ($ScriptArgs.Count -gt 0) { $ScriptArgs[0] } else { "dev" }
    
    switch ($action) {
        "dev" { pnpm dev }
        "start" { pnpm start }
        "build" { pnpm build }
        "test" { pnpm test }
        "lint" { pnpm lint }
        "format" { pnpm format }
        "type-check" { pnpm type-check }
        "clean" { Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .next, coverage, dist, *.tsbuildinfo }
        default { pnpm $action }
    }
    exit $LASTEXITCODE
}
