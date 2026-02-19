# SmartCopy Pro

USB + Mobile media delivery system. Customers browse movies, copy to USB or download to phone.

## Features

- **USB delivery** — direct local copy via copy engine, or agent-based dispatch to remote Windows machines
- **Mobile delivery** — single-use signed download tokens, throttled streaming, daily quota per IP
- **Stripe payments** — Checkout sessions, webhooks, and manual cash confirmation
- **Admin panel** — dashboard, sales reports, pricing tiers, queue management, agent status
- **Security** — JWT auth, bcrypt passwords, rate limiting, security headers
- **Real-time** — WebSocket hub for live progress and drive events

## Quick Start

```bash
pip install -r requirements.txt
cd <project_root>
uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

Open `http://localhost:8080` for the customer UI, `/api/docs` for the API.

Default admin credentials: `admin` / `admin1234` — **change immediately** via `/api/admin/change-password`.

### Admin UI — Backend endpoints used

The admin dashboard uses these APIs (read-only or existing); no backend changes required.

- `GET /api/admin/dashboard` — metric cards
- `GET /api/admin/queue` — job list
- `GET /api/admin/reports/daily?days=N` — consumption chart
- `GET /api/drives`, `GET /api/admin/agents` — drives & agents
- `GET/PUT /api/admin/settings` — load balancer (e.g. `max_copies_per_session`)
- `POST /api/admin/jobs/{id}/cancel`, `POST /api/admin/jobs/{id}/priority` — job actions
- `GET /api/admin/qr`, `GET /api/admin/license` — quick-view modals
- WebSocket `/ws/jobs` — live updates

See `frontend_react/ADMIN_UI_INTEGRATION.md` for integration checklist and rollback.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SMARTCOPY_MEDIA_ROOT` | `C:\SmartCopyMedia` | Path to movie files |
| `SMARTCOPY_SECRET` | (change this!) | JWT/HMAC secret key |
| `SMARTCOPY_HOST` | `0.0.0.0` | Server bind host |
| `SMARTCOPY_PORT` | `8080` | Server bind port |
| `SMARTCOPY_BASE_URL` | `http://localhost:8080` | Public base URL |
| `SMARTCOPY_MAX_COPIES` | `4` | Max concurrent USB copies |
| `SMARTCOPY_MAX_MOBILE` | `5` | Max concurrent mobile downloads |
| `SMARTCOPY_THROTTLE_KBPS` | `0` | Mobile download throttle (0 = unlimited) |
| `STRIPE_API_KEY` | _(optional)_ | Enable Stripe online payments |
| `STRIPE_WEBHOOK_SECRET` | _(optional)_ | Stripe webhook verification |

## Project Structure

```
smartcopy_merged/
├── backend/
│   ├── main.py            # FastAPI app & all routes
│   ├── config.py          # Configuration
│   ├── database.py        # SQLite schema (WAL mode)
│   ├── models.py          # Pydantic validation models
│   ├── security.py        # JWT, bcrypt, rate limiting
│   ├── copy_engine.py     # Local USB copy with SHA-256 verify
│   ├── queue_engine.py    # Job queue (USB + mobile)
│   ├── usb_detector.py    # USB drive detection (Windows/Linux)
│   ├── websocket_hub.py   # WebSocket broadcast hub
│   ├── media_library.py   # File scanner + demo data seeder
│   ├── agent_hub.py       # WebSocket hub for Windows agents
│   ├── mobile_delivery.py # Throttled mobile download service
│   ├── payments.py        # Stripe + manual payment integration
│   └── logging_config.py  # JSON structured rotating logs
├── agent/
│   └── main.py            # Windows USB delivery agent
├── frontend_react/        # TypeScript/React UI (Vite)
├── scripts/
│   ├── migrate.sql        # DB migration script
│   ├── seed.sql           # Sample data
│   └── acceptance_test.sh # End-to-end test suite
├── install_agent.ps1      # Windows agent NSSM installer
├── setup_gateway.sh       # Linux gateway setup
├── start.sh               # Unix startup script
└── start.bat              # Windows startup script
```

## Windows Agent Setup

For shops with multiple USB stations, deploy the agent to each Windows PC:

```powershell
# On each Windows machine:
pip install httpx aiofiles websockets pywin32
python agent/main.py --server http://<server-ip>:8080
```

Or install as a Windows service using `install_agent.ps1`.

## Frontend Build

```bash
cd frontend_react
npm install
npm run build
```

The built files will be served by FastAPI from `frontend_react/dist`.
