#!/bin/bash

# Simple script to start the voice chatbot WebSocket server

echo "============================================================"
echo "🚀 Starting Voice Chatbot WebSocket Server"
echo "============================================================"
echo ""

# Check if environment variables are set
if [ -z "$AZURE_OPENAI_ENDPOINT" ]; then
    echo "❌ Error: AZURE_OPENAI_ENDPOINT not set"
    echo "Please set: export AZURE_OPENAI_ENDPOINT='your-endpoint'"
    exit 1
fi

if [ -z "$AZURE_OPENAI_API_KEY" ]; then
    echo "❌ Error: AZURE_OPENAI_API_KEY not set"
    echo "Please set: export AZURE_OPENAI_API_KEY='your-key'"
    exit 1
fi

echo "✅ Environment variables are set"
echo "✅ Starting server on http://localhost:8000"
echo ""
echo "📝 Open frontend/voice-chat.html in your browser to start chatting!"
echo ""

# Start the server
python3 websocket-server.py
