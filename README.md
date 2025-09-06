# IP Geolocation Service

A Node.js application that provides IP geolocation data with support for Cloudflare headers and local MaxMind GeoLite2 database lookups. Runs completely offline with no external API dependencies.

## Features

- **Cloudflare Integration**: Prioritizes Cloudflare geolocation headers when available
- **Local Database**: Uses MaxMind GeoLite2 database for offline IP lookups
- **Docker Support**: Ready for containerized deployment
- **No External APIs**: All geolocation happens locally for better performance and privacy

## API Endpoints

### GET /ip

Returns geolocation data for the client's IP address.

- Uses Cloudflare headers if available
- Falls back to local MaxMind database lookup

### GET /ip/{IP_ADDRESS}

Returns geolocation data for the specified IP address using local database.

### GET /health

Health check endpoint.

## Response Format

```json
{
  "country_code": "RS",
  "country_name": "Serbia",
  "city": "Belgrade",
  "latitude": 44.8046,
  "longitude": 20.4637,
  "IPv4": "95.180.46.109",
  "eu": "0",
  "region": "00",
  "timezone": "Europe/Belgrade"
}
```

## Installation & Setup

### Quick Start

```bash
# Clone or download the project
git clone <repository-url>
cd ip-resolve

# Install dependencies
npm install

# Start the server (database downloads automatically on first run)
npm start
```

### Production Setup (No npm required after initial setup)

For production servers where you prefer not to have npm available:

```bash
# One-time setup with npm
npm install

# Use production startup script
./start-prod.sh
```

### Manual Database Download (Optional)

The database downloads automatically when needed, but you can pre-download it:

```bash
# Download MaxMind GeoLite2 database manually
npm run download-db
```

The server will start on port 7755 by default.

## Docker Deployment

### Docker Compose (Recommended for Production)

For production deployments, use the provided `docker-compose.yml`:

```bash
# Start the service (database downloads automatically if needed)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

The docker-compose configuration includes:

- **Health checks**: Monitors service availability
- **Auto-restart**: Restarts on failure
- **Volume mounting**: Persists database across container restarts
- **Production settings**: Optimized for production use

### Manual Docker Build and Run

```bash
# Build the Docker image
docker build -t ip-resolve .

# Run the container
docker run -d \
  --name ip-resolve \
  -p 7755:7755 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ip-resolve
```

### Docker Compose Configuration

The `docker-compose.yml` file includes production-ready settings:

```yaml
version: "3.8"

services:
  ip-resolve:
    build: .
    ports:
      - "7755:7755"
    environment:
      - NODE_ENV=production
      - PORT=7755
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://localhost:7755/health",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Database Updates

The GeoLite2 database is updated weekly by MaxMind. To get the latest version:

```bash
# Update the database (requires Node.js)
npm run download-db

# Restart the server to load new database
npm start
```

### Automated Updates

#### Option 1: Docker Compose with Built-in Cron (Recommended)

The Docker Compose setup includes an automatic database updater service:

```bash
# Start both the service and auto-updater
docker-compose up -d

# Check if both services are running
docker-compose ps

# View updater logs
docker-compose logs -f db-updater

# View cron update logs
docker-compose exec db-updater cat /app/data/cron-update.log
```

The `db-updater` service features:
- **Automatic weekly updates** every Tuesday at 2 AM UTC
- **Service restart** after database updates
- **Comprehensive logging** to `data/cron-update.log`
- **Error handling** and file corruption protection
- **No manual intervention required**

#### Option 2: Standalone Script (No Node.js Required)

For non-Docker environments or manual control:

```bash
# Make the script executable (one time)
chmod +x update-db.sh

# Run the update manually
./update-db.sh

# Set up automated updates via crontab
crontab -e

# Add this line to update weekly on Tuesdays at 2 AM
0 2 * * 2 cd /path/to/ip-resolve && ./update-db.sh
```

The standalone script (`update-db.sh`) features:
- No Node.js dependency (uses curl/wget)
- Automatic service restart detection (PM2, Docker Compose, systemd)
- Error handling and logging to `update-db.log`
- File corruption protection
- Redirect following for download URLs

#### Option 3: Node.js Script (Legacy)

If you have Node.js available:

```bash
# Edit crontab
crontab -e

# Add this line to update weekly on Tuesdays at 2 AM
0 2 * * 2 cd /path/to/ip-resolve && npm run download-db && pm2 restart ip-resolve
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 7755)

### Cloudflare Headers

When running behind Cloudflare with IP Geolocation enabled, the following headers are automatically detected:

- `cf-connecting-ip`: Real client IP
- `cf-ipcountry`: Country code
- `cf-ipcity`: City name
- `cf-region`: Region code
- `cf-timezone`: Timezone
- `cf-iplatitude`: Latitude
- `cf-iplongitude`: Longitude

## Development

### Available Scripts

- `npm start`: Start the production server (auto-downloads database if needed)
- `npm run dev`: Start the development server (auto-downloads database if needed)
- `npm run download-db`: Download/update the MaxMind database manually
- `npm run setup`: Full setup (install + download database)
- `./start.sh`: Startup script with dependency check
- `./start-prod.sh`: Production startup script (assumes dependencies installed)
- `./update-db.sh`: Standalone database update script (no Node.js required)

### File Structure

```
ip-resolve/
├── server.js          # Main application server (with auto-download)
├── download-db.js     # Database download script
├── update-db.sh       # Standalone database update script (no Node.js required)
├── start.sh           # Startup script with dependency check
├── start-prod.sh      # Production startup script
├── package.json       # Node.js dependencies and scripts
├── docker-compose.yml # Docker Compose configuration (includes cron service)
├── Dockerfile         # Docker configuration for main service
├── Dockerfile.cron    # Docker configuration for cron updater service
├── .dockerignore      # Docker ignore file
├── .gitignore         # Git ignore file
├── data/              # MaxMind database storage (auto-created)
└── README.md          # This file
```

## Dependencies

- **express**: Web framework
- **maxmind**: MaxMind database reader

## Database Information

This project uses MaxMind's GeoLite2 database, which is free and updated weekly. The database provides:

- Country-level accuracy: Very high
- City-level accuracy: Good for developed countries, variable for others
- Database size: ~58MB
- License: Creative Commons Attribution-ShareAlike 4.0

## Troubleshooting

### Database Issues

The database now downloads automatically on first run. If you experience issues:

```bash
# Manual download
npm run download-db

# Or restart the server (it will auto-download if missing)
npm start
```

### Permission Errors

Ensure the application has write permissions to create the `data/` directory:

```bash
chmod 755 .
```

### Docker Issues

The database downloads automatically when the container starts. If issues occur:

```bash
# Rebuild the image
docker build -t ip-resolve .

# Check container logs
docker logs <container-name>
```

## License

This project uses the MaxMind GeoLite2 database, which is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License.

## Support

For issues or questions, please check the troubleshooting section above or create an issue in the project repository.
