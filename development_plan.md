# Voice Chat App - Development Plan

## Architecture Decision: VAD Events

**Why backend sends VAD events:** The frontend cannot detect when the user is actually speaking (vs background noise). Only OpenAI's VAD knows this. Backend forwards these infrequent events (speech_started/speech_stopped) so the visualization matches what the AI is processing. This keeps the UI in sync with reality and avoids the complexity of running a separate VAD in the browser.

---

## Phase 1: Backend WebSocket Server

**What:** Build a Python WebSocket server that acts as a bridge between browser and OpenAI.

**How:** 
- Use `websockets` library to accept connections from frontend
- For each connected client, create an Azure OpenAI realtime connection
- Run two async tasks in parallel:
  1. Forward audio from WebSocket → OpenAI
  2. Forward events/audio from OpenAI → WebSocket

**Why:** The browser can't talk directly to OpenAI realtime API. We need a server to manage the connection and forward data bidirectionally.

**Key file:** `backend/ws-server.py`

**Testing:** Start server, connect with `wscat`, verify you can send/receive messages.

---

## Phase 2: Frontend Audio Capture

**What:** Capture microphone audio in the browser and convert it to the format OpenAI expects.

**How:**
- Use `getUserMedia()` to access microphone
- Create AudioWorklet to resample from 48kHz (browser native) → 24kHz (OpenAI requirement)
- Convert Float32 audio → PCM16 → Base64
- Send chunks over WebSocket

**Why:** OpenAI requires 24kHz PCM16 audio. Browsers capture at 48kHz in Float32 format. We need to resample and convert the format before sending.

**Key files:** 
- `lib/audio-capture.ts` - main capture class
- `public/audio-processor.js` - AudioWorklet for resampling
- `lib/audio-utils.ts` - format conversion utilities

**Testing:** Console log the Base64 chunks being generated.

---

## Phase 3: Frontend Audio Playback

**What:** Receive AI audio from backend and play it through speakers without gaps.

**How:**
- Receive Base64 audio chunks from WebSocket
- Decode Base64 → PCM16 → Float32
- Queue chunks in memory
- Use AudioContext to play chunks sequentially
- Schedule next chunk when previous ends

**Why:** Audio comes in chunks. If we play each chunk immediately, there will be gaps. We need to queue and schedule them to play smoothly back-to-back.

**Key file:** `lib/audio-playback.ts`

**Testing:** Hardcode some test audio and verify it plays without stuttering.

---

## Phase 4: WebSocket Client

**What:** Manage WebSocket connection to backend with auto-reconnect.

**How:**
- Connect to `ws://localhost:8765`
- Provide simple interface: `send(message)` and `onMessage(handler)`
- Auto-reconnect after 3 seconds if connection drops
- Handle connection state changes

**Why:** WebSocket connections can drop. We need reconnection logic and a clean interface for the rest of the app to use.

**Key file:** `lib/websocket-client.ts`

**Testing:** Start/stop backend server, verify reconnection works.

---

## Phase 5: Main Voice Chat Hook

**What:** Orchestrate all the pieces - tie audio capture, WebSocket, and playback together.

**How:**
- Initialize WebSocket client on component mount
- Provide `start()` method that:
  1. Initializes audio capture
  2. Initializes audio playback
  3. Wires capture output → WebSocket → playback input
- Handle incoming WebSocket messages:
  - `speech_started` → set isUserSpeaking = true
  - `speech_stopped` → set isUserSpeaking = false
  - `audio_output` → send to playback + set isAISpeaking = true
  - Playback ends → set isAISpeaking = false
- Track transcripts for display

**Why:** This is the central brain that coordinates everything. React components will use this hook to access the voice chat functionality.

**Key file:** `hooks/use-voice-chat.ts`

**Testing:** Call `start()`, speak, verify transcripts appear and state updates.

---

## Phase 6: Update UI

**What:** Replace mock data with real voice chat hook.

**How:**
- Import `useVoiceChat` instead of existing mock hook
- Add start/stop button
- Show connection status
- Display transcripts
- Pass `isUserSpeaking` and `isAISpeaking` to existing visualization

**Why:** The visualization is already built, we just need to feed it real data instead of mock data.

**Key file:** `app/page.tsx`

**Testing:** Full end-to-end test - start talking, see waveforms, hear AI response.

---

## Testing Checklist

After all phases complete, verify:
- [ ] Backend starts and accepts connections
- [ ] Frontend connects to backend  
- [ ] Microphone permission works
- [ ] Speaking shows gray waveform at the right time
- [ ] AI response shows green waveform
- [ ] Audio plays clearly through speakers
- [ ] Transcripts display correctly
- [ ] Reconnection works after backend restart
- [ ] Can have multi-turn conversation