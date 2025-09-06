#!/bin/bash

# Production startup script for IP Geolocation Service
# Assumes Node.js and dependencies are already installed

echo "Starting IP Geolocation Service (Production Mode)..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    exit 1
fi

# Check if dependencies exist
if [ ! -d "node_modules" ]; then
    echo "Error: Dependencies not found! Run 'npm install' first."
    exit 1
fi

# Set production environment
export NODE_ENV=production

# Start the server (database will be downloaded automatically if needed)
echo "Server starting on port ${PORT:-7755}..."
exec node server.js