#!/bin/bash
echo "Starting Dixa-Voyado Webhook Service..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la
echo "Installing dependencies..."
npm install
echo "Starting server..."
node server.js
