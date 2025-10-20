# Voice Chatbot - Simple Frontend Setup

A simple voice chatbot with a WebSocket-based frontend for real-time voice conversations with Azure OpenAI's Realtime API.

## What's Included

- **Backend WebSocket Server** (`backend/websocket-server.py`): Bridges the browser and Azure OpenAI Realtime API
- **Simple HTML Frontend** (`frontend/voice-chat.html`): Clean UI with just an on/off button

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Environment Variables

Make sure you have your Azure OpenAI credentials set:

```bash
export AZURE_OPENAI_ENDPOINT="your-endpoint-here"
export AZURE_OPENAI_API_KEY="your-api-key-here"
```

### 3. Start the WebSocket Server

```bash
cd backend
python websocket-server.py
```

The server will start on `http://localhost:8000`

### 4. Open the Frontend

Simply open `frontend/voice-chat.html` in your web browser (Chrome/Edge recommended for best audio support).

### 5. Start Chatting!

1. Click the power button (it will turn purple/red when active)
2. Allow microphone access when prompted
3. Start speaking naturally
4. The AI will respond with voice

## Features

- ✅ **One-button interface** - Just click to connect/disconnect
- ✅ **Real-time voice** - Speak naturally, get instant responses
- ✅ **Visual status** - See when AI is listening, processing, or speaking
- ✅ **Transcripts** - View conversation text in real-time
- ✅ **Semantic VAD** - Smart voice detection that handles natural pauses

## Configuration

You can customize the voice and VAD settings in `backend/websocket-server.py`:

```python
# Change the AI voice (line 15)
VOICE = "alloy"  # Options: alloy, ash, ballad, coral, echo, sage, shimmer, verse

# Change VAD mode (lines 16-18)
VAD_CONFIG = {
    "type": "semantic_vad",  # or "server_vad" for faster responses
}
```

## Troubleshooting

**Can't connect to WebSocket:**
- Make sure the backend server is running on port 8000
- Check that your Azure OpenAI credentials are set correctly

**No audio input/output:**
- Make sure you've granted microphone permissions
- Use Chrome or Edge browser (best audio support)
- Check your system's audio devices are working

**AI not responding:**
- Check the backend console for error messages
- Verify your Azure OpenAI deployment has the Realtime API enabled
- Ensure you have the correct model name ("gpt-realtime")

## Architecture

```
Browser (voice-chat.html)
    ↕ WebSocket
Backend (websocket-server.py)
    ↕ WebSocket
Azure OpenAI Realtime API
```

The frontend captures audio from your microphone, sends it to the backend via WebSocket, which forwards it to Azure OpenAI. The AI's voice response flows back through the same path.

## What's Next?

This is intentionally kept simple! If you want to add features:
- Multiple conversation history
- Voice selection dropdown
- Recording/playback
- Custom instructions

Just modify the HTML file and WebSocket server as needed!
