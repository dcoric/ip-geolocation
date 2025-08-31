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

# Install dependencies and download database
npm run setup

# Start the server
npm start
```

### Manual Setup

```bash
# Install dependencies
npm install

# Download MaxMind GeoLite2 database
npm run download-db

# Start the server
npm start
```

The server will start on port 3000 by default.

## Docker Deployment

### Docker Compose (Recommended for Production)

For production deployments, use the provided `docker-compose.yml`:

```bash
# Download the database first
npm run download-db

# Start the service
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
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ip-resolve
```

### Docker Compose Configuration

The `docker-compose.yml` file includes production-ready settings:

```yaml
version: '3.8'

services:
  ip-resolve:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Database Updates

The GeoLite2 database is updated weekly by MaxMind. To get the latest version:

```bash
# Update the database
npm run download-db

# Restart the server to load new database
npm start
```

### Automated Updates

You can set up a cron job to automatically update the database:

```bash
# Edit crontab
crontab -e

# Add this line to update weekly on Tuesdays at 2 AM
0 2 * * 2 cd /path/to/ip-resolve && npm run download-db && pm2 restart ip-resolve
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)

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

- `npm start`: Start the production server
- `npm run dev`: Start the development server
- `npm run download-db`: Download/update the MaxMind database
- `npm run setup`: Full setup (install + download database)

### File Structure

```
ip-resolve/
├── server.js          # Main application server
├── download-db.js     # Database download script
├── package.json       # Node.js dependencies and scripts
├── docker-compose.yml # Docker Compose configuration
├── Dockerfile         # Docker configuration
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

### Database Not Found Error

If you get "GeoLite2 database not found" error:

```bash
npm run download-db
```

### Permission Errors

Ensure the application has write permissions to create the `data/` directory:

```bash
chmod 755 .
```

### Docker Issues

If the Docker build fails, ensure the database is downloaded first:

```bash
npm run download-db
docker build -t ip-resolve .
```

## License

This project uses the MaxMind GeoLite2 database, which is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License.

## Support

For issues or questions, please check the troubleshooting section above or create an issue in the project repository.