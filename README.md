# realtime-voice-chatbot

Real-time, bidirectional voice chat experience that streams microphone audio to an Azure OpenAI Realtime session and plays the AI's responses back in the browser. The frontend visualises live voice activity and transcripts, while the backend bridges between the browser and Azure OpenAI.

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export AZURE_OPENAI_ENDPOINT="https://<your-endpoint>"
export AZURE_OPENAI_API_KEY="<your-key>"
python ws-server.py
```

### Frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser and start a session.

### Environment variables

* `VOICE_SERVER_HOST` / `VOICE_SERVER_PORT` – override the WebSocket server binding (defaults to `0.0.0.0:8765`).
* `AZURE_OPENAI_REALTIME_MODEL` – model name for the Azure OpenAI Realtime session (defaults to `gpt-realtime`).
* `AZURE_OPENAI_VOICE` – voice used for audio responses (defaults to `alloy`).
* `NEXT_PUBLIC_VOICE_SERVER_URL` – WebSocket URL the frontend should use (defaults to `ws://localhost:8765`).
