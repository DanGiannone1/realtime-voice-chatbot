# Azure OpenAI Realtime Voice Assistant 🎤

A production-ready voice assistant using Azure OpenAI's GPT-4o Realtime API with direct WebRTC connections for ultra-low latency voice interactions.

## 🌟 Features

- **Direct WebRTC Connection**: Browser connects directly to Azure OpenAI for minimal latency
- **Ephemeral Token Security**: Secure authentication without exposing API keys in the browser
- **Real-time Transcription**: See what you and the AI are saying in real-time
- **Voice Activity Detection (VAD)**: Automatic turn-taking - no button pressing needed
- **Beautiful UI**: Modern, responsive interface with conversation history
- **Production Ready**: Proper error handling, logging, and best practices

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Browser   │────1───▶│  Backend Server  │         │  Azure OpenAI   │
│  (WebRTC)   │         │  (Token Gen)     │         │   Realtime API  │
│             │◀───2────│                  │         │                 │
│             │         └──────────────────┘         │                 │
│             │                                       │                 │
│             │════════════3 (WebRTC Direct)═════════▶│                 │
│             │◀═══════════════════════════════════════│                 │
└─────────────┘                                       └─────────────────┘

1. Browser requests ephemeral token from backend
2. Backend mints token using API key and returns to browser (with regional WebRTC URL)
3. Browser establishes direct WebRTC connection to Azure OpenAI using ephemeral token
```

### Key Implementation Details

**Dual Endpoint Architecture:**
- **Sessions API**: `https://yourresource.openai.azure.com/openai/realtimeapi/sessions` - Used by backend to generate ephemeral tokens
- **WebRTC API**: `https://{region}.realtimeapi-preview.ai.azure.com/v1/realtimertc` - Used by browser for direct audio connection

**Regional Requirements:**
- Your Azure OpenAI resource **must** be in `eastus2` or `swedencentral`
- The WebRTC endpoint URL is region-specific and automatically constructed by the backend
- The backend auto-detects your region from the endpoint hostname or uses the `AZURE_OPENAI_REGION` environment variable

## 📋 Prerequisites

### Quick Start Checklist

✅ Azure OpenAI resource in **East US 2** or **Sweden Central**  
✅ Realtime model deployed (e.g., `gpt-realtime`)  
✅ Endpoint URL and API Key from Azure Portal  
✅ Python 3.9+ installed  
✅ Node.js 18+ installed  
✅ Microphone-enabled browser  

### Azure Setup

1. **Azure Subscription**: Create one at [portal.azure.com](https://portal.azure.com)

2. **Azure OpenAI Resource**: 
   - Must be in **East US 2** or **Sweden Central** region
   - Create at: Azure Portal → Create Resource → Azure OpenAI

3. **Deploy Realtime Model**:
   - Go to Azure AI Foundry portal
   - Deploy one of these models:
     - `gpt-realtime` (recommended)
     - `gpt-realtime-mini` (faster, cheaper)
     - `gpt-4o-realtime-preview`
     - `gpt-4o-mini-realtime-preview`

4. **Get Credentials**:
   - Endpoint: Found in Azure Portal → Your Resource → Keys and Endpoint
   - API Key: Same location as endpoint
   - Deployment Name: The name you gave your deployment

### System Requirements

- **Python**: 3.9 or higher
- **Node.js**: 18.0 or higher
- **npm** or **yarn**: Latest version
- **Browser**: Chrome, Edge, Firefox, or Safari (with microphone support)

## 🚀 Installation

### 1. Clone or Download the Files

Create a project directory with this structure:

```
realtime-voice-chatbot/
├── backend/
│   ├── web_rtc_backend.py
│   ├── .env.example
│   ├── .env (create from .env.example)
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.tsx
    │   ├── layout.tsx
    │   └── globals.css
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── tsconfig.json
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows CMD:
venv\Scripts\activate.bat

# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn httpx python-dotenv

# Or create requirements.txt with these contents:
```

Create `requirements.txt`:

```text
fastapi==0.109.0
uvicorn[standard]==0.27.0
httpx==0.26.0
```

Then install:

```bash
pip install -r requirements.txt
```

Next, create your environment configuration:

```bash
# Copy the example file to create your .env
# Windows PowerShell:
Copy-Item .env.example .env

# Windows CMD:
copy .env.example .env

# macOS/Linux:
cp .env.example .env

# Edit .env with your favorite text editor
notepad .env
# Or: code .env (if using VS Code)
```

Add your Azure credentials to `.env`:

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-actual-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-realtime
AZURE_OPENAI_REGION=eastus2
```

**Important**: 
- `AZURE_OPENAI_REGION` must be set to either `eastus2` or `swedencentral` (matching your Azure resource location)
- The backend will attempt to auto-detect the region from your endpoint URL, but explicitly setting it is recommended
- If your endpoint is the full URL (with `/openai/realtime?api-version=...`), the backend will extract the base URL automatically

**Endpoint URL Formats (both work):**
```env
# Base URL (recommended):
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com

# Full URL (backend extracts base URL automatically):
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-realtime
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# If using an existing Next.js project, just copy page.tsx to your app directory
# If starting fresh:

# Create Next.js app with TypeScript and Tailwind
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# Copy the page.tsx file to app/page.tsx
# Make sure it replaces the default page.tsx
```

Your `package.json` should include:

```json
{
  "name": "realtime-voice-assistant",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.3"
  }
}
```

## ▶️ Running the Application

### 1. Start the Backend Server

```bash
# In the backend directory with venv activated
python web_rtc_backend.py
```

You should see:

```
======================================================================
🚀 Azure OpenAI Realtime WebRTC Token Server Starting
   Full Endpoint: https://your-resource.openai.azure.com/openai/realtime?...
   Base URL: https://your-resource.openai.azure.com
   Deployment: gpt-realtime
   Region: eastus2
   WebRTC URL: https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc
   Server: http://localhost:8080
======================================================================
INFO:     Started server process
INFO:     Uvicorn running on http://localhost:8080
```

### 2. Start the Frontend Development Server

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Start Next.js development server
npm run dev
```

You should see:

```
  ▲ Next.js 14.1.0
  - Local:        http://localhost:3000
  - Ready in 2.5s
```

### 3. Open the Application

1. Navigate to **http://localhost:3000** in your browser
2. Click **"Start Conversation"**
3. Allow microphone access when prompted
4. Start speaking!

## 🧪 Testing Your Setup

### Test Backend Health

Before starting a conversation, verify your backend is configured correctly:

```bash
# Test health endpoint
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy"}
```

### Test Session Creation

```bash
# Test token generation (requires .env to be configured)
curl -X POST http://localhost:8080/session

# Expected response includes:
# - Session ID
# - Ephemeral token (client_secret)
# - WebRTC URL for your region
# - Model and voice configuration
```

### Verify Environment Variables

The backend will log your configuration on startup:

```
🚀 Azure OpenAI Realtime WebRTC Token Server Starting
   Full Endpoint: https://xxx.openai.azure.com/...
   Base URL: https://xxx.openai.azure.com
   Deployment: gpt-realtime
   Region: eastus2
   WebRTC URL: https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc
```

Verify that:
- ✅ Region matches your Azure resource location
- ✅ Deployment name matches what's in Azure Portal
- ✅ WebRTC URL shows the correct region

## 🎯 Usage

1. **Click "Start Conversation"**: Initializes the WebRTC connection
2. **Allow Microphone**: Browser will request microphone permission
3. **Wait for "Connected"**: Status will show when ready
4. **Start Speaking**: Just talk naturally - no need to press anything
5. **AI Responds**: The AI will respond with voice automatically
6. **View Transcript**: See the conversation transcript below
7. **Stop When Done**: Click "Stop Conversation" to end

## 🔧 Configuration

### Backend Configuration

Edit `web_rtc_backend.py` to customize:

```python
# Session configuration in create_session() function
"model": deployment_name,
"voice": "alloy",  # Options: alloy, echo, fable, onyx, nova, shimmer
"instructions": "You are a helpful AI assistant. Keep responses concise and natural.",
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,           # Sensitivity (0.0-1.0)
    "prefix_padding_ms": 300,   # Audio captured before speech
    "silence_duration_ms": 500, # Silence duration to end turn
},
"input_audio_transcription": {
    "model": "whisper-1"        # Enables real-time transcription
},
```

**Regional WebRTC Endpoints:**
- Your backend automatically constructs the correct WebRTC URL based on your region
- East US 2: `https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc`
- Sweden Central: `https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc`

### Frontend Configuration

Edit `page.tsx` to customize:

```typescript
// Microphone settings (in startConversation function)
audio: {
  sampleRate: 24000,        // Audio quality (24kHz required)
  channelCount: 1,          // Mono audio
  echoCancellation: true,   // Echo cancellation
  noiseSuppression: true,   // Noise reduction
  autoGainControl: true,    // Auto volume
}

// Backend URL (update for production)
const tokenResponse = await fetch("http://localhost:8080/session", {
  method: "POST",
});
```

**Important Frontend Details:**
- The frontend expects the backend to return a `webrtc_url` field in the session response
- Audio element plays AI responses automatically using WebRTC remote track
- Data channel ("oai-events") handles all event communication with Azure
- Transcripts are updated in real-time as `response.audio_transcript.delta` events arrive

## 🐛 Troubleshooting

### Backend Issues

**Error: "Missing required environment variables"**
- Solution: Ensure `.env` file exists and contains all required variables
- Check: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_REGION` are set
- Verify: Region is either `eastus2` or `swedencentral`

**Error: "Failed to create session"**
- Check: Your Azure OpenAI resource is in East US 2 or Sweden Central
- Check: Your deployment name matches what's in Azure Portal
- Check: Your API key is correct and not expired
- Check: The endpoint URL is correct (backend will extract base URL automatically)

**Warning: "Could not auto-detect region"**
- Solution: Explicitly set `AZURE_OPENAI_REGION` environment variable
- This ensures the correct regional WebRTC endpoint is used

**Error: "Network error connecting to Azure OpenAI"**
- Check: Internet connection is working
- Check: Firewall/proxy isn't blocking Azure endpoints
- Check: Endpoint URL is correctly formatted (https://...)

### Frontend Issues

**Microphone not working**
- Ensure browser has microphone permissions
- Check: Settings → Privacy → Microphone
- Try a different browser (Chrome recommended)

**No audio from AI**
- Check: Computer volume is turned up
- Check: Browser console for audio playback errors
- Try: Clicking the page before starting (required by some browsers)

**Connection fails immediately**
- Check: Backend server is running on port 8080
- Check: CORS settings in backend allow your frontend origin
- Check: Browser console for specific error messages

**"Failed to exchange SDP" error**
- This means the WebRTC connection couldn't be established
- Check: Backend generated a valid ephemeral token
- Check: Network allows WebRTC connections
- Try: Different network (corporate networks may block WebRTC)

### Browser Console

Always check the browser console (F12 → Console) for detailed error messages:

```javascript
// Common console messages:
✅ Session created         // Token obtained successfully
📡 Data channel opened     // Events channel ready
🔊 Received audio track    // AI audio incoming
🔗 Connection state: connected  // WebRTC established
❌ Error messages          // Check these for issues
```

## 📊 Monitoring

### Backend Logs

The backend logs important events:

```
INFO: Requesting ephemeral token from: https://xxx.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview
INFO: Deployment: gpt-realtime, Region: eastus2
INFO: ✅ Ephemeral token generated successfully
INFO: Session ID: sess_xxx
INFO: Model: gpt-realtime
INFO: WebRTC URL: https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc
```

### Browser DevTools

Use Chrome DevTools to monitor WebRTC:

1. Open `chrome://webrtc-internals`
2. Find your connection
3. Monitor audio levels, packet loss, bitrate, etc.

## 🔒 Security Best Practices

1. **Never expose API keys**: Always use the backend token generation pattern
2. **Use HTTPS in production**: WebRTC requires secure contexts
3. **Validate tokens**: Ephemeral tokens expire in 60 seconds
4. **Rate limiting**: Implement rate limiting on the `/session` endpoint
5. **CORS configuration**: Only allow trusted frontend origins

## 🚢 Production Deployment

### Backend (Python)

Deploy to:
- **Azure App Service**: Managed Python hosting
- **AWS Lambda + API Gateway**: Serverless option
- **Google Cloud Run**: Container-based deployment
- **Docker**: Use gunicorn for production

Example Dockerfile:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY web_rtc_backend.py .
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "web_rtc_backend:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Environment Variables for Production:**
- Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_REGION`
- Update CORS origins in `web_rtc_backend.py` to include your production frontend URL

### Frontend (Next.js)

Deploy to:
- **Vercel**: Best for Next.js (automatic)
- **Netlify**: JAMstack deployment
- **Azure Static Web Apps**: Integrated with Azure
- **AWS Amplify**: Full-stack deployment

Update backend URL in production:

```typescript
const tokenResponse = await fetch("https://your-backend.com/session", {
  method: "POST",
});
```

## 📝 API Documentation

### Backend Endpoints

#### POST `/session`

Creates an ephemeral token for WebRTC authentication.

**Response:**
```json
{
  "id": "sess_...",
  "model": "gpt-realtime",
  "expires_at": 1234567890,
  "client_secret": {
    "value": "eph_...",
    "expires_at": 1234567890
  },
  "voice": "alloy",
  "instructions": "You are a helpful AI assistant...",
  "turn_detection": { "type": "server_vad", ... },
  "input_audio_transcription": { "model": "whisper-1" },
  "webrtc_url": "https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc"
}
```

**Note**: The `webrtc_url` field is added by the backend and is critical for the frontend to connect to the correct regional endpoint.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is provided as-is for educational and commercial use.

## 🔗 Resources

- [Azure OpenAI Realtime API Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-webrtc)
- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## 💡 Tips & Tricks

### Improve Audio Quality

- Use a good quality microphone
- Reduce background noise
- Speak clearly and at a normal pace
- Adjust VAD threshold if too sensitive/insensitive

### Reduce Latency

- Use wired internet connection if possible
- Deploy backend close to Azure OpenAI region
- Use `gpt-realtime-mini` for faster responses
- Optimize network path (avoid VPNs when testing)

### Cost Optimization

- Use `gpt-realtime-mini` instead of full model (cheaper)
- Implement session timeouts to prevent long connections
- Add usage monitoring and alerts
- Cache ephemeral tokens when appropriate (within 60s window)

## 🎉 Success!

You now have a working voice assistant with ultra-low latency thanks to WebRTC! The AI can understand your tone, emotion, and speech patterns, providing a much more natural conversation experience than traditional text-based chatbots.

Enjoy building amazing voice applications! 🚀