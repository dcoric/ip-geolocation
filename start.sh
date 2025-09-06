#!/bin/bash

# IP Geolocation Service Startup Script
# This script can be used on production servers without npm

echo "Starting IP Geolocation Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Installing..."
    if command -v npm &> /dev/null; then
        npm install
    else
        echo "Error: npm is not available!"
        echo "Please install dependencies manually or install npm."
        exit 1
    fi
fi

# Start the server (database will be downloaded automatically if needed)
echo "Starting server on port ${PORT:-7755}..."
exec node server.js