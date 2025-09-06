# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js IP geolocation service that provides offline IP lookups using MaxMind's GeoLite2 database. The service prioritizes Cloudflare geolocation headers when available and falls back to local database queries.

## Commands

### Development
- `npm start` or `npm run dev` - Start the server (port 7755)
- `npm run download-db` - Download/update MaxMind GeoLite2 database
- `npm run setup` - Full setup (install dependencies + download database)

### Production
- `./start.sh` - Startup script with dependency checking
- `./start-prod.sh` - Production startup (assumes dependencies installed)

### Docker
- `docker-compose up -d` - Start containerized service
- `docker-compose logs -f` - View container logs
- `docker-compose down` - Stop service

## Architecture

### Core Components

1. **server.js** - Main application with three key subsystems:
   - **Database initialization** (lines 58-70): Auto-downloads GeoLite2 database on first run
   - **IP detection** (lines 72-82): Multi-source client IP extraction (Cloudflare, X-Forwarded-For, etc.)
   - **Geolocation resolution**: Cloudflare headers take priority over local MaxMind lookups

2. **download-db.js** - Standalone database downloader with redirect handling

### Key Design Patterns

- **Fallback hierarchy**: Cloudflare headers → MaxMind database → error
- **Auto-provisioning**: Database downloads automatically if missing
- **EU detection**: Hardcoded EU country list for GDPR compliance flag
- **Error boundaries**: Graceful degradation with meaningful error messages

### API Endpoints

- `GET /ip` - Client IP geolocation (uses request headers for IP detection)
- `GET /ip/:address` - Specific IP lookup with IPv4 validation
- `GET /health` - Health check endpoint

### Environment Configuration

- **PORT**: Server port (default: 7755)
- **NODE_ENV**: Environment mode (affects Docker behavior)

### Database Management

- **Path**: `./data/GeoLite2-City.mmdb`
- **Source**: GitHub mirror (P3TERX/GeoLite.mmdb)
- **Auto-download**: Triggered on server startup if missing
- **Size**: ~58MB

### Docker Architecture

The service is containerized with:
- Health checks via `/health` endpoint
- Volume mounting for database persistence
- Production-optimized Alpine Node.js base image