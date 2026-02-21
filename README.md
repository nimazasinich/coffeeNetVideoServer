# SmartCopy Pro v5

A USB + Mobile media delivery system with queue management, agent support, and Stripe payments.

## Project Structure

```
SmartCopy_Pro_v5/
├── backend/           # FastAPI Python backend
│   ├── main.py        # Main app, all routes
│   ├── config.py      # Configuration (env vars)
│   ├── database.py    # SQLite setup & migrations
│   ├── queue_engine.py# Copy job queue
│   ├── media_library.py# Media scanning
│   ├── security.py    # JWT auth, rate limiting
│   ├── agent_hub.py   # Windows agent management
│   ├── routers/       # QR and Featured sub-routers
│   └── services/      # Business logic services
├── frontend_react/    # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx            # Main app shell & login
│   │   ├── components/        # UI components
│   │   ├── context/           # Global state (SmartCopyContext)
│   │   └── lib/               # API client, types, utils
│   ├── index.html
│   └── package.json
├── data/              # SQLite DB and runtime state
├── scripts/           # DB seed, migration, tests
└── requirements.txt   # Python dependencies
```

## Quick Start

### Backend
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

### Frontend (development)
```bash
cd frontend_react
npm install
npm run dev
```

### Frontend (production build)
```bash
cd frontend_react
npm install
npm run build
# dist/ folder is served by the FastAPI backend automatically
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SMARTCOPY_MEDIA_ROOT` | `C:\SmartCopyMedia` | Path to media files |
| `SMARTCOPY_HOST` | `0.0.0.0` | Server bind host |
| `SMARTCOPY_PORT` | `8080` | Server port |
| `SMARTCOPY_SECRET` | (change this!) | JWT secret key |
| `STRIPE_API_KEY` | — | Stripe API key (optional) |

## Default Admin Login

- **Username:** `admin`
- **Password:** `admin123`

> ⚠️ Change the password after first login via Admin > Settings.

## API Documentation

Once running, visit: `http://localhost:8080/api/docs`
