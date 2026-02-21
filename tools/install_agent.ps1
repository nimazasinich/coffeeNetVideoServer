# SmartCopy Pro Agent – Windows Installer
# Run as Administrator: powershell -ExecutionPolicy Bypass -File tools/install_agent.ps1

param(
    [string]$ServerUrl = "http://192.168.1.100:8000",
    [string]$InstallDir = "C:\SmartCopyAgent",
    [string]$NSSMPath = "C:\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"
Write-Host "=== SmartCopy Pro Agent Installer ===" -ForegroundColor Cyan

# 1. Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python 3.9+ not found. Please install from https://python.org" -ForegroundColor Red
    exit 1
}
$pyVer = python --version 2>&1
Write-Host "Found: $pyVer" -ForegroundColor Green

# 2. Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    Write-Host "Created $InstallDir" -ForegroundColor Green
}

# 3. Copy agent files
Write-Host "Copying agent files..."
Copy-Item -Path ".\agent\*" -Destination $InstallDir -Recurse -Force

# 4. Write .env config
$envContent = @"
SERVER_URL=$ServerUrl
"@
Set-Content -Path "$InstallDir\.env" -Value $envContent
Write-Host "Config written to $InstallDir\.env" -ForegroundColor Green

# 5. Install Python dependencies
Write-Host "Installing Python dependencies..."
python -m pip install --upgrade pip | Out-Null
python -m pip install websockets httpx aiofiles pywin32 | Out-Null
Write-Host "Dependencies installed." -ForegroundColor Green

# 6. Install NSSM if present
if (Test-Path $NSSMPath) {
    Write-Host "Installing Windows service via NSSM..."
    & $NSSMPath install SmartCopyAgent python "$InstallDir\main.py" "--server" $ServerUrl
    & $NSSMPath set SmartCopyAgent AppDirectory $InstallDir
    & $NSSMPath set SmartCopyAgent DisplayName "SmartCopy Pro Agent"
    & $NSSMPath set SmartCopyAgent Description "SmartCopy Pro USB delivery agent"
    & $NSSMPath set SmartCopyAgent AppStdout "$InstallDir\agent.log"
    & $NSSMPath set SmartCopyAgent AppStderr "$InstallDir\agent.log"
    & $NSSMPath set SmartCopyAgent Start SERVICE_AUTO_START
    & $NSSMPath start SmartCopyAgent
    Write-Host "Service SmartCopyAgent installed and started!" -ForegroundColor Green
} else {
    Write-Host "NSSM not found at $NSSMPath. To run as a service:" -ForegroundColor Yellow
    Write-Host "  1. Download NSSM from https://nssm.cc" -ForegroundColor Yellow
    Write-Host "  2. Run this script again with -NSSMPath C:\path\to\nssm.exe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To run agent manually:" -ForegroundColor Cyan
    Write-Host "  cd $InstallDir && python main.py --server $ServerUrl" -ForegroundColor Cyan
}

# 7. Create desktop shortcut for debug mode
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\SmartCopy Agent Debug.lnk")
$Shortcut.TargetPath = "python"
$Shortcut.Arguments = "$InstallDir\main.py --server $ServerUrl --debug"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Save()

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Cyan
Write-Host "Agent ID stored in: $InstallDir\agent_id.txt" -ForegroundColor White
Write-Host "Logs at: $InstallDir\agent.log" -ForegroundColor White
