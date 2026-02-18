# SmartCopy - LAN File Distribution System

A professional file distribution system designed for physical retail environments, allowing customers to browse and copy movies/series to their USB drives via a mobile-first web interface.

## Overview

SmartCopy is a LAN-first, deterministic, corruption-safe file distribution system built for commercial use. Customers can browse media, select content, and receive copies to their USB drives with zero technical knowledge required.

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Real-time Updates**: Supabase Realtime (WebSocket-based)
- **Icons**: Lucide React

### Key Features
- Mobile-first responsive design
- Real-time job queue monitoring via WebSocket
- FIFO job queue management
- USB drive detection and management
- Copy progress tracking with throughput metrics
- Pricing engine with configurable tiers
- Admin dashboard with statistics
- Comprehensive error handling and recovery

## Database Schema

### Core Tables
- **media**: Stores media files (movies, series) with metadata
- **drives**: Tracks connected USB drives and their status
- **jobs**: Manages copy job queue with FIFO ordering
- **sales**: Logs transactions for commercial tracking
- **admin_users**: Admin authentication and role management
- **pricing_tiers**: Configurable pricing for different media categories

## User Flow

1. Customer opens browser and navigates to shop's LAN IP
2. Browses media library with category filters and search
3. Selects a movie or series to copy
4. System prompts to insert USB drive
5. Customer selects their USB drive
6. Copy job is created and added to queue
7. Real-time progress updates via WebSocket
8. Notification on completion with safe eject prompt
9. Error handling with retry options on failure

## Security Features

- LAN-only operation (no internet exposure)
- Row Level Security (RLS) policies on all tables
- Input sanitization and validation
- Path traversal protection
- Parameterized database queries
- Rate limiting (ready for backend implementation)
- Secure admin authentication

## Copy Execution Design

### Safety Mechanisms
- Temporary file (.tmp) convention during copy
- SHA-256 checksum verification
- Atomic file rename on successful verification
- Automatic cleanup on failure
- Drive lock management for concurrent operations

### Queue Management
- Strict FIFO ordering
- One active job per physical drive
- Job state machine: pending → active → completed/failed/cancelled
- Persistent queue survives application restart
- Real-time status updates to all connected clients

## Commercial Features

### Pricing Engine
- Configurable price tiers (SD, HD, 4K, Series)
- Per-copy pricing model
- Multi-currency support
- Payment confirmation workflow

### Admin Dashboard
- System statistics and KPIs
- Total media library count
- Job success rates
- Revenue tracking
- Connected drives monitoring
- Failed jobs alerts

## Development

### Prerequisites
- Node.js 18+
- Supabase account with configured project

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables in `.env`
4. Run development server: `npm run dev`
5. Build for production: `npm run build`

### Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Backend Integration Notes

The current implementation provides the complete frontend infrastructure. For full functionality, a backend service is needed to:

1. **USB Drive Detection**: Monitor USB insertion/removal events (Windows WMI or cross-platform alternatives)
2. **File Copy Execution**: Handle actual file streaming with progress tracking
3. **Checksum Verification**: Calculate and verify SHA-256 hashes
4. **Drive Locking**: Manage exclusive locks for concurrent operations
5. **Queue Worker Pool**: Process jobs from the Supabase queue

### Recommended Backend Stack
- **Node.js + Express** or **Python + FastAPI**
- USB detection via OS-level APIs
- Supabase client for database operations
- WebSocket for real-time updates (already configured in frontend)

## Production Deployment

1. Configure LAN-only network binding
2. Set up Windows Firewall rules
3. Install on shop's local server (Windows recommended)
4. Configure USB drive access permissions
5. Set up automatic startup on system boot
6. Configure backup and logging

## Future Enhancements

- [ ] Multi-shop license management
- [ ] Cloud reporting portal
- [ ] Payment terminal integration
- [ ] Media transcoding
- [ ] Automated media library scanning
- [ ] Customer usage analytics
- [ ] Franchise management system

## License

Commercial use license. All rights reserved.

## Support

For technical support or commercial inquiries, please contact the development team.
