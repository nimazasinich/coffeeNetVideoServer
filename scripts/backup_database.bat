@echo off
REM SmartCopy Pro - Database Backup Script (Windows)
REM Run daily via Task Scheduler

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set DB_PATH=%PROJECT_ROOT%\data\smartcopy.db
set BACKUP_DIR=%PROJECT_ROOT%\data\backups
set DATE_TIME=%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATE_TIME=%DATE_TIME: =0%
set BACKUP_FILE=%BACKUP_DIR%\smartcopy_backup_%DATE_TIME%.db

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Check if database exists
if not exist "%DB_PATH%" (
    echo ERROR: Database not found at %DB_PATH%
    exit /b 1
)

REM Perform backup
echo Starting backup: %BACKUP_FILE%
sqlite3 "%DB_PATH%" ".backup '%BACKUP_FILE%'"

REM Verify backup
if exist "%BACKUP_FILE%" (
    echo Backup complete: %BACKUP_FILE%
) else (
    echo ERROR: Backup failed
    exit /b 1
)

REM Keep only last 30 days of backups
forfiles /P "%BACKUP_DIR%" /M smartcopy_backup_*.db /D -30 /C "cmd /c del @path" 2>nul
echo Cleaned up backups older than 30 days

echo Backup process complete
