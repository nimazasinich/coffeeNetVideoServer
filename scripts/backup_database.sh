#!/bin/bash
# SmartCopy Pro — Database Backup Script
# Run daily via cron: 0 2 * * * /path/to/backup_database.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="$PROJECT_ROOT/data/smartcopy.db"
BACKUP_DIR="$PROJECT_ROOT/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/smartcopy_backup_$DATE.db"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "ERROR: Database not found at $DB_PATH"
    exit 1
fi

# Perform backup using SQLite .backup command
echo "Starting backup: $BACKUP_FILE"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup complete: $BACKUP_FILE ($SIZE)"
else
    echo "ERROR: Backup failed"
    exit 1
fi

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "smartcopy_backup_*.db" -mtime +30 -delete
echo "Cleaned up backups older than 30 days"

# Optional: Compress old backups (older than 7 days)
find "$BACKUP_DIR" -name "smartcopy_backup_*.db" -mtime +7 ! -name "*.gz" -exec gzip {} \;
echo "Compressed backups older than 7 days"

echo "Backup process complete"
