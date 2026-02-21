# SmartCopy Pro v5 — Neo Tactile Edition

A media copy & delivery service with a stunning Neo Tactile dark UI.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Design**: Neo Tactile (deep dark, electric blue/cyan, pure white text, SVG icons)
- **Backend**: Python FastAPI (preserved from v4)

## Quick Start

### Frontend
```bash
cd SmartCopy_Pro_v5
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend
```bash
pip install fastapi uvicorn pydantic
uvicorn backend.main:app --port 8080 --reload
```

## UI Features

### Customer View (default)
- Featured media carousel with auto-rotation
- Searchable, filterable media grid (movie/series)
- Copy modal: USB drive or mobile delivery
- Manual or online payment modes
- Drive selector with space checks

### Admin Dashboard (click "ورود ادمین")
- **Overview tab**: KPI strip, live throughput chart, job donut, system health gauges, agent status
- **Jobs tab**: Active job queue with cancel/approve/priority controls
- **Agents tab**: Connected copy agents, drive counts, online/offline status
- **Settings tab**: Server configuration editor

## Design System

All colors are CSS variables in `src/index.css`:
| Variable     | Color                        | Use                      |
|-------------|------------------------------|--------------------------|
| `--green`   | `#00f5a0` (neon green)       | LIVE / ACTIVE badges     |
| `--blue`    | `#4d9fff` (electric blue)    | Primary accent           |
| `--cyan`    | `#00e5ff` (neon cyan)        | Throughput chart, accents|
| `--violet`  | `#c084fc`                    | Agents/secondary         |
| `--text1`   | `#ffffff`                    | Primary text             |
| `--text2`   | `rgba(255,255,255,0.70)`     | Secondary text           |
| `--bg0`     | `#010406` (near black)       | Root background          |

## Default Admin Credentials
Username: `admin`  Password: `admin123`
(Demo mode accepts any credentials when backend is unavailable)
