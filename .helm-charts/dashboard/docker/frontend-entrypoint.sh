#!/bin/sh
# Frontend Runtime Configuration - Google Analytics Injection
# Managed by: .helm-charts/dashboard (demo deployment only)
# 
# This script injects Google Analytics tracking code into index.html at container startup
# For customer deployments, REACT_APP_GA_TRACKING_ID is not set, so GA is not injected

set -e

INDEX_HTML="/usr/share/nginx/html/index.html"

echo "🔧 Configuring frontend for deployment..."

# Check if Google Analytics tracking ID is provided
if [ -n "$REACT_APP_GA_TRACKING_ID" ]; then
  echo "✅ Google Analytics enabled - Tracking ID: $REACT_APP_GA_TRACKING_ID"
  
  # Create GA scripts
  GA_SCRIPTS="<script async src=\"https://www.googletagmanager.com/gtag/js?id=${REACT_APP_GA_TRACKING_ID}\"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${REACT_APP_GA_TRACKING_ID}');</script>"
  
  # Simple replacement - use @ delimiter to avoid conflicts with || in JavaScript
  sed -i "s@<meta name=\"ga-placeholder\" content=\"REPLACE_ME_AT_RUNTIME\" />@${GA_SCRIPTS}@g" "$INDEX_HTML"
  
  echo "✅ Google Analytics tracking code injected into index.html"
else
  echo "ℹ️  Google Analytics disabled (no tracking ID provided)"
  echo "ℹ️  This is expected for customer deployments"
  
  # Remove placeholder for clean HTML
  sed -i "s@<meta name=\"ga-placeholder\" content=\"REPLACE_ME_AT_RUNTIME\" />@@g" "$INDEX_HTML"
fi

echo "🚀 Starting nginx..."
exec nginx -g 'daemon off;'
