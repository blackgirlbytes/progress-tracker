#!/bin/bash

# OS DevRel Progress Tracker - Start Script

echo "🎯 OS DevRel Progress Tracker"
echo "=============================="

# Check if ASANA_TOKEN is set
if [ -z "$ASANA_TOKEN" ]; then
    echo ""
    echo "⚠️  ASANA_TOKEN not set!"
    echo ""
    echo "To get your Asana Personal Access Token:"
    echo "1. Go to: https://app.asana.com/0/developer-console"
    echo "2. Click 'Create new token'"
    echo "3. Copy the token"
    echo ""
    echo "Then run:"
    echo "  export ASANA_TOKEN=your_token_here"
    echo "  npm start"
    echo ""
    echo "Or run with token inline:"
    echo "  ASANA_TOKEN=your_token_here npm start"
    echo ""
    exit 1
fi

echo "✅ ASANA_TOKEN is set"
echo "🚀 Starting server..."
echo ""

npm start
