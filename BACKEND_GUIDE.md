# SmartCopy Backend Implementation Guide

This guide provides detailed instructions for implementing the backend service that handles USB detection, file copying, and queue management.

## Overview

The backend service is responsible for:
1. Detecting USB drive insertion/removal
2. Processing copy jobs from the queue
3. Streaming files to USB drives with progress tracking
4. Verifying file integrity with SHA-256 checksums
5. Managing drive locks for concurrent operations
6. Updating job status in real-time

## Architecture Options

### Option 1: Node.js + Express (Recommended for cross-platform)

```javascript
// Example structure
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const chokidar = require('chokidar');
const fs = require('fs').promises;
const crypto = require('crypto');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Drive detection service
class DriveDetectionService {
  constructor() {
    this.connectedDrives = new Map();
  }

  async startMonitoring() {
    // Monitor for new drives (platform-specific)
    // On Windows: use 'drivelist' or WMI
    // On Linux/Mac: monitor /dev or /Volumes
  }

  async onDriveConnected(drive) {
    await supabase.from('drives').upsert({
      path: drive.path,
      label: drive.label,
      capacity_bytes: drive.capacity,
      available_bytes: drive.available,
      is_connected: true,
    });
  }

  async onDriveRemoved(drivePath) {
    // Mark drive as disconnected
    await supabase
      .from('drives')
      .update({ is_connected: false })
      .eq('path', drivePath);

    // Fail any active jobs for this drive
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error_message: 'USB drive was removed during copy'
      })
      .eq('drive_id', driveId)
      .eq('status', 'active');
  }
}

// Copy job worker
class CopyWorker {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.activeCopies = new Map();
    this.driveLocks = new Map();
  }

  async processQueue() {
    // Get next pending job where drive is not locked
    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, drives(*), media(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    for (const job of jobs) {
      if (this.activeCopies.size >= this.maxConcurrent) break;
      if (this.driveLocks.has(job.drive_id)) continue;

      this.startCopy(job);
    }
  }

  async startCopy(job) {
    const { id, media, drives } = job;

    try {
      // Acquire lock
      this.driveLocks.set(drives.id, id);

      // Update job status
      await supabase
        .from('jobs')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', id);

      // Lock drive in database
      await supabase
        .from('drives')
        .update({ locked_by_job_id: id })
        .eq('id', drives.id);

      // Start copy with progress tracking
      await this.copyFile(media.path, drives.path, job);

      // Mark as completed
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_bytes: job.total_bytes
        })
        .eq('id', id);

    } catch (error) {
      // Mark as failed
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', id);
    } finally {
      // Release lock
      this.driveLocks.delete(drives.id);
      this.activeCopies.delete(id);

      await supabase
        .from('drives')
        .update({ locked_by_job_id: null })
        .eq('id', drives.id);
    }
  }

  async copyFile(sourcePath, targetDrivePath, job) {
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDrivePath, fileName);
    const tempPath = targetPath + '.tmp';

    const sourceStream = fs.createReadStream(sourcePath);
    const targetStream = fs.createWriteStream(tempPath);

    const hash = crypto.createHash('sha256');
    let copiedBytes = 0;
    const startTime = Date.now();

    sourceStream.on('data', async (chunk) => {
      hash.update(chunk);
      copiedBytes += chunk.length;

      // Calculate throughput
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const throughputMbps = (copiedBytes / elapsedSeconds) / (1024 * 1024);

      // Update progress in database
      await supabase
        .from('jobs')
        .update({
          progress_bytes: copiedBytes,
          throughput_mbps: throughputMbps
        })
        .eq('id', job.id);
    });

    await new Promise((resolve, reject) => {
      sourceStream.pipe(targetStream);
      targetStream.on('finish', resolve);
      targetStream.on('error', reject);
    });

    // Verify checksum
    const computedHash = hash.digest('hex');
    // Compare with source file hash (should be pre-computed)

    // Atomic rename
    await fs.rename(tempPath, targetPath);
  }
}

// Start services
const driveService = new DriveDetectionService();
const copyWorker = new CopyWorker();

driveService.startMonitoring();
setInterval(() => copyWorker.processQueue(), 5000);
```

### Option 2: Python + FastAPI (Recommended for Windows)

```python
from fastapi import FastAPI
from supabase import create_client
import hashlib
import asyncio
import psutil
import win32api
import win32con
import win32file

class DriveDetectionService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.known_drives = set()

    async def monitor_drives(self):
        while True:
            current_drives = self.get_connected_drives()

            # Detect new drives
            new_drives = current_drives - self.known_drives
            for drive in new_drives:
                await self.on_drive_connected(drive)

            # Detect removed drives
            removed_drives = self.known_drives - current_drives
            for drive in removed_drives:
                await self.on_drive_removed(drive)

            self.known_drives = current_drives
            await asyncio.sleep(2)

    def get_connected_drives(self):
        drives = set()
        for partition in psutil.disk_partitions():
            if 'removable' in partition.opts:
                drives.add(partition.device)
        return drives

    async def on_drive_connected(self, drive_path):
        try:
            usage = psutil.disk_usage(drive_path)
            volume_name = win32api.GetVolumeInformation(drive_path)[0]

            await self.supabase.table('drives').upsert({
                'path': drive_path,
                'label': volume_name or 'USB Drive',
                'capacity_bytes': usage.total,
                'available_bytes': usage.free,
                'is_connected': True
            }).execute()
        except Exception as e:
            print(f"Error detecting drive: {e}")

class CopyWorker:
    def __init__(self, supabase_client, max_concurrent=4):
        self.supabase = supabase_client
        self.max_concurrent = max_concurrent
        self.drive_locks = {}

    async def process_queue(self):
        while True:
            try:
                # Get pending jobs
                response = await self.supabase.table('jobs') \\
                    .select('*, drives(*), media(*)') \\
                    .eq('status', 'pending') \\
                    .order('created_at', desc=False) \\
                    .limit(10) \\
                    .execute()

                for job in response.data:
                    if len(self.drive_locks) >= self.max_concurrent:
                        break
                    if job['drive_id'] in self.drive_locks:
                        continue

                    asyncio.create_task(self.copy_file(job))

            except Exception as e:
                print(f"Queue processing error: {e}")

            await asyncio.sleep(5)

    async def copy_file(self, job):
        job_id = job['id']
        drive_id = job['drive_id']

        try:
            # Acquire lock
            self.drive_locks[drive_id] = job_id

            # Update job to active
            await self.supabase.table('jobs').update({
                'status': 'active',
                'started_at': datetime.now().isoformat()
            }).eq('id', job_id).execute()

            # Copy with progress
            source_path = job['media']['path']
            target_path = os.path.join(job['drives']['path'],
                                      os.path.basename(source_path))
            temp_path = target_path + '.tmp'

            await self._stream_copy(source_path, temp_path, job)

            # Verify checksum
            if await self._verify_checksum(source_path, temp_path):
                os.rename(temp_path, target_path)
                await self.supabase.table('jobs').update({
                    'status': 'completed',
                    'completed_at': datetime.now().isoformat()
                }).eq('id', job_id).execute()
            else:
                os.remove(temp_path)
                raise Exception("Checksum mismatch")

        except Exception as e:
            await self.supabase.table('jobs').update({
                'status': 'failed',
                'error_message': str(e)
            }).eq('id', job_id).execute()
        finally:
            del self.drive_locks[drive_id]

    async def _stream_copy(self, source, target, job):
        chunk_size = 524288  # 512KB
        copied = 0
        start_time = time.time()

        with open(source, 'rb') as src, open(target, 'wb') as dst:
            while True:
                chunk = src.read(chunk_size)
                if not chunk:
                    break

                dst.write(chunk)
                copied += len(chunk)

                # Update progress
                elapsed = time.time() - start_time
                throughput = (copied / elapsed) / (1024 * 1024)

                await self.supabase.table('jobs').update({
                    'progress_bytes': copied,
                    'throughput_mbps': throughput
                }).eq('id', job['id']).execute()

                await asyncio.sleep(0)
```

## Deployment

### Windows Service Setup

1. Install Python/Node.js on Windows server
2. Create Windows service using `nssm` (Non-Sucking Service Manager)
3. Configure service to start automatically
4. Set up logging to Windows Event Log

```bash
# Using NSSM
nssm install SmartCopyBackend "C:\\Python\\python.exe" "C:\\SmartCopy\\backend\\main.py"
nssm set SmartCopyBackend AppDirectory "C:\\SmartCopy\\backend"
nssm set SmartCopyBackend Start SERVICE_AUTO_START
```

### Environment Configuration

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MAX_CONCURRENT_COPIES=4
CHUNK_SIZE_BYTES=524288
LOG_LEVEL=INFO
```

## Error Handling

### Drive Removal During Copy
- Detect drive removal event
- Mark job as failed with appropriate message
- Clean up partial files if possible
- Release drive lock
- Log event for admin review

### Disk Full
- Check available space before starting copy
- Monitor during copy for space issues
- Fail gracefully with clear error message
- Clean up partial .tmp file

### Checksum Mismatch
- Delete .tmp file immediately
- Mark job as failed
- Flag source media for admin review
- Log detailed error information

## Performance Optimization

1. **Chunked Reading**: Use optimal chunk size (512KB recommended)
2. **Buffered I/O**: Enable OS-level buffering
3. **Parallel Copies**: Up to 4 concurrent operations
4. **Progress Batching**: Update database every 500ms, not per chunk
5. **Connection Pooling**: Reuse Supabase connections

## Monitoring and Logging

- Log all copy operations with timestamps
- Track success/failure rates
- Monitor drive connection events
- Alert on repeated failures
- Export logs for analysis

## Security Considerations

- Run backend with minimal privileges
- Validate all file paths against whitelist
- Never expose file system structure to clients
- Use service role key securely
- Encrypt logs containing sensitive data

## Testing

1. Test USB insertion/removal handling
2. Verify checksum validation
3. Test concurrent copy operations
4. Simulate drive removal during copy
5. Test disk full scenarios
6. Verify queue ordering (FIFO)
7. Load test with multiple simultaneous clients

## Support

For implementation questions or issues, refer to the main README or contact the development team.
