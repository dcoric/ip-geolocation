#!/bin/bash

# GeoLite2 Database Update Script
# Standalone script for updating MaxMind GeoLite2 database without Node.js
# Suitable for crontab automation

set -e

# Configuration
DB_URL="https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
DB_FILE="${DATA_DIR}/GeoLite2-City.mmdb"
TEMP_FILE="${DB_FILE}.tmp"
LOG_FILE="${SCRIPT_DIR}/update-db.log"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to download file with redirect following
download_file() {
    local url="$1"
    local dest="$2"
    local max_redirects=5
    local redirect_count=0
    
    while [ $redirect_count -lt $max_redirects ]; do
        log "Downloading from: $url"
        
        # Use curl if available, fallback to wget
        if command -v curl >/dev/null 2>&1; then
            # Get response with headers
            response=$(curl -sL -D /tmp/headers -o "$dest" -w "%{http_code}" "$url")
            
            if [ "$response" = "200" ]; then
                log "Download successful"
                return 0
            elif [ "$response" = "301" ] || [ "$response" = "302" ]; then
                # Follow redirect
                url=$(grep -i "location:" /tmp/headers | tail -1 | cut -d' ' -f2 | tr -d '\r')
                redirect_count=$((redirect_count + 1))
                log "Redirect $redirect_count: Following to $url"
                continue
            else
                log "Error: HTTP $response"
                return 1
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget --quiet --show-progress -O "$dest" "$url"; then
                log "Download successful"
                return 0
            else
                log "Error: wget failed"
                return 1
            fi
        else
            log "Error: Neither curl nor wget is available"
            return 1
        fi
    done
    
    log "Error: Too many redirects ($max_redirects)"
    return 1
}

# Function to restart service if running
restart_service() {
    # Check for common process managers and restart if the service is running
    
    # PM2
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 list | grep -q "ip-resolve\|server.js" 2>/dev/null; then
            log "Restarting service via PM2..."
            pm2 restart ip-resolve 2>/dev/null || pm2 restart server.js 2>/dev/null || true
            return 0
        fi
    fi
    
    # Docker Compose
    if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
        if docker-compose -f "${SCRIPT_DIR}/docker-compose.yml" ps | grep -q "Up" 2>/dev/null; then
            log "Restarting Docker Compose service..."
            cd "$SCRIPT_DIR"
            docker-compose restart 2>/dev/null || true
            return 0
        fi
    fi
    
    # Systemd service (if exists)
    if systemctl is-active --quiet ip-geolocation 2>/dev/null; then
        log "Restarting systemd service..."
        sudo systemctl restart ip-geolocation 2>/dev/null || true
        return 0
    fi
    
    # Find and kill existing Node.js process
    local pid=$(pgrep -f "server.js" 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        log "Found running server.js process (PID: $pid). Manual restart may be needed."
        # Don't kill automatically in case it's not our service
    fi
    
    log "No running service detected or automatic restart not possible"
}

# Main execution
main() {
    log "Starting GeoLite2 database update"
    
    # Create data directory if it doesn't exist
    if [ ! -d "$DATA_DIR" ]; then
        mkdir -p "$DATA_DIR"
        log "Created data directory: $DATA_DIR"
    fi
    
    # Check if database exists and get current size
    if [ -f "$DB_FILE" ]; then
        current_size=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        log "Current database size: $(( current_size / 1024 / 1024 )) MB"
    else
        log "No existing database found"
        current_size=0
    fi
    
    # Download new database to temporary file
    if download_file "$DB_URL" "$TEMP_FILE"; then
        # Verify download
        if [ ! -f "$TEMP_FILE" ] || [ ! -s "$TEMP_FILE" ]; then
            log "Error: Downloaded file is empty or missing"
            rm -f "$TEMP_FILE"
            exit 1
        fi
        
        new_size=$(stat -f%z "$TEMP_FILE" 2>/dev/null || stat -c%s "$TEMP_FILE" 2>/dev/null || echo "0")
        log "Downloaded database size: $(( new_size / 1024 / 1024 )) MB"
        
        # Check if the new file is significantly different (avoid updating with corrupted downloads)
        if [ "$new_size" -lt 10485760 ]; then  # Less than 10MB is suspicious
            log "Error: Downloaded file too small ($(( new_size / 1024 / 1024 )) MB), possibly corrupted"
            rm -f "$TEMP_FILE"
            exit 1
        fi
        
        # Replace old database with new one
        if mv "$TEMP_FILE" "$DB_FILE"; then
            log "Database updated successfully"
            
            # Set appropriate permissions
            chmod 644 "$DB_FILE"
            
            # Restart service if it's running
            restart_service
            
            log "Update completed successfully"
        else
            log "Error: Failed to replace database file"
            rm -f "$TEMP_FILE"
            exit 1
        fi
    else
        log "Error: Failed to download database"
        rm -f "$TEMP_FILE"
        exit 1
    fi
}

# Run main function
main "$@"