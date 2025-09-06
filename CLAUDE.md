# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js IP geolocation service that provides offline IP lookups using MaxMind's GeoLite2 database. The service prioritizes Cloudflare geolocation headers when available and falls back to local database queries.

## Commands

### Development
- `npm run dev` - Start development server with ts-node (port 7755)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Build and start production server (port 7755)
- `npm run typecheck` - Run TypeScript type checking without compilation
- `npm run download-db` - Download/update MaxMind GeoLite2 database
- `npm run setup` - Full setup (install dependencies + download database)
- `npm run clean` - Remove compiled JavaScript files

### Production
- `./start.sh` - Startup script with dependency checking
- `./start-prod.sh` - Production startup (assumes dependencies installed)

### Docker
- `docker-compose up -d` - Start containerized service
- `docker-compose logs -f` - View container logs
- `docker-compose down` - Stop service

## Architecture

### Core Components

1. **src/server.ts** - Main TypeScript application with three key subsystems:
   - **Database initialization**: Auto-downloads GeoLite2 database on first run
   - **IP detection**: Multi-source client IP extraction (Cloudflare, X-Forwarded-For, etc.)
   - **Geolocation resolution**: Cloudflare headers take priority over local MaxMind lookups

2. **src/download-db.ts** - Standalone database downloader with redirect handling

3. **TypeScript Configuration**:
   - **tsconfig.json**: Strict TypeScript configuration with ES2020 target
   - **dist/**: Compiled JavaScript output directory (excluded from git)
   - **Type safety**: Full type coverage for MaxMind API and Express routes
   - **Node.js**: Requires Node.js 22+ (latest LTS)

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