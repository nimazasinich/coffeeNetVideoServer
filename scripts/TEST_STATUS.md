# SmartCopy Pro — Test Suite Status

## Current Status: INCOMPATIBLE

The test suite in `scripts/test_smartcopy.py` was written for a **different version** of SmartCopy that used SQLAlchemy ORM with async sessions.

The current production codebase uses **plain sqlite3** with synchronous context managers.

## Incompatibilities

### 1. Database Layer Mismatch
- **Tests expect:** SQLAlchemy `AsyncSession`, `Base` model, `get_db()` dependency
- **Reality:** sqlite3 `db_cursor()` context manager, no ORM

### 2. Module Import Errors
- **Tests import:** `from backend.app import app` (file doesn't exist)
- **Reality:** `from backend.main import app`

- **Tests import:** `from backend import crud` (module doesn't exist)
- **Reality:** No CRUD layer, direct SQL in each module

- **Tests import:** `from backend.models import Base, Job, MediaItem, DownloadToken`
- **Reality:** `backend.models` contains Pydantic models only, no SQLAlchemy models

### 3. Queue Engine API Mismatch
- **Tests call:** `get_queue_engine()` function
- **Reality:** `queue_engine` singleton object

- **Tests call:** `engine.enqueue(job_id)`, `engine.bump_priority()`
- **Reality:** `queue_engine.enqueue_job(job_id)`, no `bump_priority()` method

### 4. Configuration Mismatch
- **Tests expect:** `from backend.config import settings` (Pydantic Settings object)
- **Reality:** `from backend.config import *` (module-level constants)

## Recommendation

The test suite needs a **complete rewrite** to match the current architecture:

1. Replace SQLAlchemy fixtures with sqlite3 in-memory database
2. Update all imports to match current module structure
3. Rewrite CRUD operations as direct SQL
4. Update queue engine API calls
5. Remove async/await from database operations

## Estimated Effort

- Full rewrite: 8-12 hours
- Partial adaptation: Not recommended (too many incompatibilities)

## Alternative

Use `scripts/acceptance_test.sh` for integration testing. It tests the actual HTTP API and doesn't depend on internal implementation details.
