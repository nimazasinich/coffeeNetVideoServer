# SmartCopy Pro - Project Structure

This document describes the organized file structure of the SmartCopy Pro project.

## Root Directory

```
smartcopy_pro/
├── START.bat              # Main launcher for Windows
├── START.sh               # Main launcher for Linux/Mac
├── README.md              # Project overview and quick start
├── requirements.txt       # Python dependencies
├── .gitignore            # Git ignore rules
│
├── backend/              # FastAPI backend application
├── frontend_react/       # React TypeScript frontend
├── agent/                # Windows USB delivery agent
│
├── bin/                  # Startup and execution scripts
├── config/               # Configuration files
├── data/                 # Runtime data and database
├── docs/                 # Documentation and reports
├── logs/                 # Application logs
├── reports/              # Generated reports
├── scripts/              # Database and testing scripts
├── tests/                # Test files and artifacts
└── tools/                # Installation and setup utilities
```

## Directory Details

### `/backend/`
FastAPI backend application with all API routes, business logic, and services.

Key files:
- `main.py` - FastAPI app entry point
- `config.py` - Configuration management
- `database.py` - SQLite database schema
- `models.py` - Pydantic validation models
- `security.py` - Authentication and authorization
- `copy_engine.py` - USB copy operations
- `queue_engine.py` - Job queue management
- `websocket_hub.py` - Real-time WebSocket communication

### `/frontend_react/`
React TypeScript frontend built with Vite.

Structure:
- `src/` - Source code
  - `components/` - React components (organized by feature)
    - `admin/` - Admin panel components
    - `auth/` - Authentication components
    - `customer/` - Customer-facing components
    - `dashboard/` - Dashboard views
    - `media/` - Media display components
    - `queue/` - Job queue & monitoring
    - `ui/` - Common UI components
  - `contexts/` - React contexts
  - `lib/` - Utilities and API client
  - `styles/` - Global styles
- `dist/` - Production build output
- `public/` - Static assets

See `frontend_react/src/COMPONENT_STRUCTURE.md` for detailed component organization.

### `/agent/`
Windows USB delivery agent for remote copy operations.

### `/bin/`
Executable scripts for starting and managing the application.

Scripts:
- `START_HERE.bat` - Main Windows startup (builds frontend + starts server)
- `RUN_APP.bat` - Interactive startup with mode selection
- `start.bat` / `start.sh` - Basic server startup
- `start_dev.bat` / `start_dev_all.bat` - Development mode
- `OPEN_ADMIN.bat` - Opens admin panel in browser
- `OPEN_CUSTOMER.bat` - Opens customer UI in browser

### `/config/`
Configuration files and API specifications.

Files:
- `openapi.json` - OpenAPI/Swagger specification

### `/data/`
Runtime data, database, and state files.

Files:
- `smartcopy.db` - SQLite database
- `runtime_state.json` - IP change detection state
- `install_id.txt` - Installation identifier

### `/docs/`
Project documentation, design documents, and reports.

Files:
- `PROJECT_STRUCTURE.md` - This file
- `PROJECT_ANALYSIS.md` - Technical analysis
- `AUDIT_SUMMARY.md` - Security audit summary
- `ENTERPRISE_AUDIT_REPORT.md` - Enterprise audit
- `BUGS_AND_FIXES.md` - Bug tracking
- `architecture_diagram.html` - System architecture visualization
- `project_visualization.html` - Project structure visualization
- `ui-design-reference.html` - UI design reference
- `tactile-lowpoly-design-reference.md` - Design guidelines

### `/logs/`
Application log files.

Files:
- `smartcopy.log` - Main application log (rotating)

### `/reports/`
Generated reports and analysis outputs.

Files:
- `admin-mismatch-report.json` - Admin UI integration report
- `ADMIN_INTEGRATION_CHECKLIST.md` - Integration checklist

### `/scripts/`
Database migrations, seeding, and testing scripts.

Files:
- `migrate.sql` - Database migration script
- `seed.sql` - Sample data seeding
- `acceptance_test.sh` - End-to-end tests
- `perf_test.py` - Performance testing
- `test_v4.py` - Test suite

### `/tests/`
Test files and test artifacts.

Files:
- `qr_test.png` - QR code test image

### `/tools/`
Installation and setup utilities.

Files:
- `install_agent.ps1` - Windows agent service installer (NSSM)
- `setup_gateway.sh` - Linux gateway setup script

## Quick Start Paths

### Starting the Application

**Windows:**
```cmd
START.bat
```
or
```cmd
bin\START_HERE.bat
```

**Linux/Mac:**
```bash
./START.sh
```
or
```bash
bash bin/start_smartcopy.sh
```

### Development Mode

**Windows:**
```cmd
bin\RUN_APP.bat
```
Then select option 2 for development mode.

### Installing Windows Agent

```powershell
powershell -ExecutionPolicy Bypass -File tools\install_agent.ps1
```

### Setting Up Linux Gateway

```bash
sudo bash tools/setup_gateway.sh <SERVER_IP> <WIFI_INTERFACE>
```

## Path References

All scripts in `/bin/` have been updated to reference files relative to the project root. When running scripts from the bin directory, they automatically navigate to the correct paths.

### Important Path Updates

1. **Backend QR Module**: `backend/qr.py` now references `data/runtime_state.json`
2. **Git Ignore**: `.gitignore` updated to ignore `data/runtime_state.json`
3. **All Batch Files**: Updated to use `..\\` for parent directory navigation
4. **All Shell Scripts**: Updated to use `../` for parent directory navigation
5. **README**: Updated with new directory structure and startup instructions

## Configuration Files

### OpenAPI Specification
Location: `config/openapi.json`

### Database
Location: `data/smartcopy.db`

### Logs
Location: `logs/smartcopy.log`

## Notes

- The `.venv` directory (Python virtual environment) remains in the project root
- The `node_modules` directory remains in `frontend_react/`
- All startup scripts create the virtual environment if it doesn't exist
- Frontend build output goes to `frontend_react/dist/`
- The backend serves the frontend from the dist directory in production mode
