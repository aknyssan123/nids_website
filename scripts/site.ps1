# site.ps1 - installs, starts, stops and checks the local website (backend + frontend).
# Called by the Makefile: make install | up | down | restart | status.
#
# "up" starts both parts hidden in the background. Their process IDs are kept in .run\pids.txt,
# so "down" stops exactly what "up" started. Their output goes to .run\*.log.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'up', 'down', 'status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$Root     = Split-Path -Parent $PSScriptRoot
$Backend  = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$RunDir   = Join-Path $Root '.run'
$PidFile  = Join-Path $RunDir 'pids.txt'
$Python   = Join-Path $Backend '.venv\Scripts\python.exe'
$Ports    = [ordered]@{ backend = 8000; frontend = 5173 }

# The process listening on a port, or $null.
function Get-Listener([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue }
}

# /T also stops the children: uvicorn's reload worker and node under npm. Through cmd, because
# PowerShell 5.1 turns a native program's redirected error output into an exception.
function Stop-Tree([int]$Id) {
    cmd.exe /c "taskkill /PID $Id /T /F >nul 2>&1"
}

# Stops the processes listed in .run\pids.txt. Each line is "PID,start time", and a process is
# stopped only if both match, so a PID that Windows reused for another program is never touched.
function Stop-Started {
    $stopped = 0
    if (Test-Path $PidFile) {
        foreach ($line in Get-Content $PidFile) {
            $id, $ticks = $line -split ','
            $p = Get-Process -Id $id -ErrorAction SilentlyContinue
            if ($p -and $p.StartTime.Ticks -eq [long]$ticks) { Stop-Tree $p.Id; $stopped++ }
        }
        Remove-Item $PidFile
    }
    return $stopped
}

function Install {
    if (-not (Test-Path $Python)) {
        Write-Host 'Creating the Python 3.13 environment in backend\.venv ...'
        & py -3.13 -m venv (Join-Path $Backend '.venv')
        if ($LASTEXITCODE) { throw 'Could not create the environment. Is Python 3.13 installed? Check with: py --list' }
    }
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r (Join-Path $Backend 'requirements.txt')
    if ($LASTEXITCODE) { throw 'pip install failed (see the messages above).' }
    Push-Location $Frontend
    try {
        & npm.cmd ci
        if ($LASTEXITCODE) { throw 'npm ci failed (see the messages above).' }
    } finally { Pop-Location }
    Write-Host 'Installed. Start the website with: make up'
}

function Up {
    if (-not (Test-Path $Python)) { throw "backend\.venv is missing. Run 'make install' first." }
    if (-not (Test-Path (Join-Path $Frontend 'node_modules'))) { throw "frontend\node_modules is missing. Run 'make install' first." }
    foreach ($name in $Ports.Keys) {
        $p = Get-Listener $Ports[$name]
        if ($p) { throw "Port $($Ports[$name]) is already used by $($p.ProcessName) (PID $($p.Id)). Run 'make down' first." }
    }
    New-Item -ItemType Directory -Force $RunDir | Out-Null

    $b = Start-Process -FilePath $Python -ArgumentList '-m uvicorn main:app --reload --port 8000' `
        -WorkingDirectory $Backend -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $RunDir 'backend.out.log') -RedirectStandardError (Join-Path $RunDir 'backend.log')
    $f = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev' `
        -WorkingDirectory $Frontend -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $RunDir 'frontend.log') -RedirectStandardError (Join-Path $RunDir 'frontend.err.log')
    Set-Content -Path $PidFile -Encoding ascii -Value @(
        "$($b.Id),$($b.StartTime.Ticks)", "$($f.Id),$($f.StartTime.Ticks)")

    Write-Host 'Starting the backend and the frontend ...'
    $deadline = (Get-Date).AddSeconds(90)
    while (-not ((Get-Listener $Ports.backend) -and (Get-Listener $Ports.frontend))) {
        if ($b.HasExited) { Stop-Started | Out-Null; throw 'The backend stopped while starting. See .run\backend.log' }
        if ($f.HasExited) { Stop-Started | Out-Null; throw 'The frontend stopped while starting. See .run\frontend.log' }
        if ((Get-Date) -gt $deadline) { Stop-Started | Out-Null; throw 'Not ready after 90 seconds. See the logs in .run\' }
        Start-Sleep -Milliseconds 500
    }
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 15
    Write-Host "Backend   http://127.0.0.1:8000  (status: $($health.status), detectors: $($health.detectors))"
    Write-Host 'Website   http://localhost:5173'
    Write-Host 'Stop everything with: make down'
    if (-not $env:NO_BROWSER) { Start-Process 'http://localhost:5173' }
}

function Down {
    $stopped = Stop-Started
    # Also stop a backend or frontend that was started by hand in a terminal,
    # but only Python or Node on our two ports, never another program.
    foreach ($port in $Ports.Values) {
        $p = Get-Listener $port
        if ($p -and $p.ProcessName -in 'python', 'node') { Stop-Tree $p.Id; $stopped++ }
    }
    if ($stopped) { Write-Host 'Stopped.' } else { Write-Host 'Nothing was running.' }
}

function Status {
    foreach ($name in $Ports.Keys) {
        $p = Get-Listener $Ports[$name]
        if ($p) { Write-Host ("{0,-9} running on port {1} ({2}, PID {3})" -f $name, $Ports[$name], $p.ProcessName, $p.Id) }
        else    { Write-Host ("{0,-9} stopped" -f $name) }
    }
}

try {
    switch ($Action) {
        'install' { Install }
        'up'      { Up }
        'down'    { Down }
        'status'  { Status }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
