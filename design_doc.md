# Voice Chat App - Design Document

## Architecture Decision: VAD Events

The backend sends `speech_started` and `speech_stopped` events from OpenAI's VAD to the frontend for visualization. We chose this over running VAD in the browser because:

1. **Single source of truth** - visualization matches what the AI is actually processing
2. **Simpler frontend** - no need to add VAD library or manage two VAD systems
3. **No confusion** - avoids cases where browser thinks user is speaking but AI doesn't respond
4. **Minimal overhead** - these are infrequent events (once per speech segment), not per audio packet

The ~50-100ms network latency for visual feedback is negligible compared to overall conversation latency.

## Overview

Web app where user talks to AI. Browser captures mic, sends to Python backend via WebSocket, backend forwards to Azure OpenAI, AI responds with audio, backend sends back to browser, browser plays through speakers. Visualization shows who's speaking in real-time.

## Architecture

```
Browser                          Python Backend                 Azure OpenAI
--------                         --------------                 ------------
Microphone                            |                              |
    ↓                                 |                              |
Capture (Web Audio API)               |                              |
    ↓                                 |                              |
Resample to 24kHz PCM16               |                              |
    ↓                                 |                              |
Encode to Base64                      |                              |
    ↓                                 |                              |
WebSocket Send -----------------> Receive                           |
                                      ↓                              |
                                  Decode Base64                     |
                                      ↓                              |
                                  Forward Audio -----------------> Receive
                                      |                              ↓
                                      |                          Process (VAD)
                                      |                              ↓
                                      |                       Generate Response
                                      |                              ↓
                                  Receive <--------------------- Send Audio
                                      ↓                              
                                  Encode to Base64                  
                                      ↓                              
WebSocket Receive <-------------- Send                              
    ↓                                                                
Decode Base64                                                        
    ↓                                                                
Play Audio (Web Audio API)                                           
    ↓                                                                
Speakers                                                             

Visualization:
- Listen for state change events from backend
- Show gray waveform when user speaks
- Show green waveform when AI speaks
```

## Components

### Backend (Python)

**WebSocket Server** (`ws-server.py`)
- Accept client connections on `ws://localhost:8765`
- For each client, create an Azure OpenAI realtime connection
- Forward audio from client to OpenAI continuously
- Forward audio responses from OpenAI to client
- Forward OpenAI VAD events to client for visualization

**Why Backend Sends VAD Events:**
The frontend cannot detect when the user is *actually* speaking (vs background noise). Only OpenAI's VAD knows this. Backend forwards these events so the visualization matches what the AI is processing:
- `speech_started` event → frontend shows gray waveform
- `speech_stopped` event → frontend hides gray waveform

These are infrequent events (once per speech segment), not per audio packet.

### Frontend (React/Next.js)

**Audio Capture** (`lib/audio-capture.ts`)
- Get microphone access via `getUserMedia()`
- Use AudioWorklet to resample from 48kHz → 24kHz
- Convert Float32 → PCM16 → Base64
- Send chunks to backend via WebSocket

**Audio Playback** (`lib/audio-playback.ts`)
- Receive Base64 audio from WebSocket
- Decode Base64 → PCM16 → Float32
- Queue audio chunks
- Play through speakers using AudioContext

**WebSocket Client** (`lib/websocket-client.ts`)
- Connect to `ws://localhost:8765`
- Send audio_input messages
- Receive audio_output messages
- Receive state_change messages
- Auto-reconnect on disconnect

**Main Hook** (`hooks/use-voice-chat.ts`)
- Initialize all components
- Wire audio capture → WebSocket → audio playback
- Track state for visualization:
  - `speech_started` event → set `isUserSpeaking = true`
  - `speech_stopped` event → set `isUserSpeaking = false`
  - `audio_output` received → set `isAISpeaking = true`
  - Audio playback ends → set `isAISpeaking = false`
- Provide start/stop methods

**UI** (`app/page.tsx`)
- Keep existing visualization code
- Replace mock data with real hook
- Add start/stop button
- Display transcripts

## WebSocket Messages

### Client → Server
```json
{
  "type": "audio_input",
  "data": "base64_pcm16_audio"
}
```

### Server → Client

**Speech detection (from OpenAI VAD):**
```json
{
  "type": "speech_started"
}
```
```json
{
  "type": "speech_stopped"
}
```

**Audio output:**
```json
{
  "type": "audio_output",
  "data": "base64_pcm16_audio"
}
```

**Transcript:**
```json
{
  "type": "transcript",
  "data": {
    "speaker": "user" | "ai",
    "text": "transcribed text"
  }
}
```

**Note:** No separate "ai_speaking" or "silence" events needed. Frontend infers:
- AI speaking = receiving audio_output messages
- Silence = no speech_started event and no audio_output

## Audio Format

- **Sample Rate:** 24kHz (required by OpenAI)
- **Format:** PCM16 (16-bit signed integer)
- **Channels:** Mono (1 channel)
- **Transport:** Base64 over WebSocket

## How It Works

1. User clicks "Start" → browser requests mic permission
2. Audio capture starts → sends chunks to backend continuously
3. Backend forwards to OpenAI continuously
4. OpenAI VAD detects speech → backend sends `speech_started`
5. Frontend shows gray waveform (user speaking)
6. User stops talking → OpenAI detects → backend sends `speech_stopped`
7. Frontend hides gray waveform
8. OpenAI processes and responds with audio chunks
9. Backend forwards `audio_output` messages to frontend
10. Frontend starts playing audio → shows green waveform (AI speaking)
11. Audio finishes playing → frontend hides green waveform
12. Conversation continues with natural turn-taking

**Key Points:**
- Audio flows continuously in both directions
- VAD events are infrequent (once per speech segment)
- Visualization stays in sync with what OpenAI is processing

## Visualization & Timeline System

### How the Timeline Works

The visualizer shows a scrolling timeline that displays the last 1-5 minutes of conversation activity (user-selectable). The timeline continuously updates to show time passing, even during silence.

**Timeline Behavior:**
- **Fixed time window**: Shows the most recent N minutes (1m, 3m, or 5m)
- **Continuous scrolling**: Timeline "pans to the left" as time passes - older events scroll off the left edge, new time appears on the right
- **Always animating**: Updates ~60 times per second (60fps) via requestAnimationFrame, so timeline movement is smooth even during silence
- **Visual time indicator**: A blue dashed "now" line on the right edge shows the current moment in time

### Rendering Process

The visualizer redraws every ~16ms (capped at 60fps):

1. **Calculate time window**: 
   - `now = Date.now()` (recalculated each frame)
   - `startTime = now - rangeMs` (e.g., now - 60000ms for 1-minute view)
   
2. **Build timeline segments**:
   - Filter activities to current time window
   - Add silence marker at window start
   - Add current speaker state at window end (`now`)
   - Generate segments showing who was speaking when
   
3. **Render waveforms**:
   - Silence: thin gray line
   - User speaking: gray waveform (amplitude ~34px)
   - AI speaking: green waveform (amplitude ~44px)
   
4. **Draw time markers**:
   - Time labels show seconds remaining (e.g., "60s", "45s", "30s", "15s", "now")
   - Blue "now" indicator line at right edge

### Silence Handling

To ensure time passing is always visible during silence:

1. **Continuous redrawing**: requestAnimationFrame redraws ~60fps with updated `now` timestamp
2. **Periodic markers**: Every 500ms during silence, a new silence activity event is added to the timeline
3. **Current speaker state**: The timeline always includes the current speaker state at the `now` timestamp
4. **Visual indicators**: Time labels and "now" line update continuously to show movement

This means even if no one is speaking and no audio is flowing, the user still sees:
- Time labels updating
- The "now" line position (though fixed at right edge, the content scrolls left beneath it)
- Periodic silence markers appearing on the timeline
- The timeline appearing to scroll left as older events move out of view

### Transcript Auto-Scroll

The conversation transcript panel auto-scrolls to show the latest message:

- **First transcript**: Instantly scrolls to bottom (no animation)
- **Subsequent transcripts**: Smoothly scrolls to bottom using smooth scroll behavior
- **Empty state**: No scrolling occurs (prevents unwanted page scrolling on initial load)
- **Timing**: Uses requestAnimationFrame to ensure DOM has updated before scrolling