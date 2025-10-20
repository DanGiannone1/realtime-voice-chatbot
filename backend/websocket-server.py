import os
import asyncio
import json
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncAzureOpenAI
import uvicorn

app = FastAPI()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Voice configuration
VOICE = "alloy"
VAD_CONFIG = {
    "type": "semantic_vad",
}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint that bridges browser <-> Azure OpenAI Realtime API"""
    await websocket.accept()
    print("✅ Client connected")
    
    client = AsyncAzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version="2025-04-01-preview",
    )
    
    try:
        async with client.beta.realtime.connect(model="gpt-realtime") as connection:
            # Configure session
            await connection.session.update(session={
                "modalities": ["text", "audio"],
                "voice": VOICE,
                "instructions": "You are a helpful assistant. Keep responses concise and natural.",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": VAD_CONFIG,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
            })
            
            print(f"🎤 Voice chat ready (Voice: {VOICE}, VAD: {VAD_CONFIG['type']})")
            
            # Send ready signal to frontend
            await websocket.send_json({"type": "ready"})
            
            # Task to receive audio from browser and send to OpenAI
            async def browser_to_openai():
                try:
                    while True:
                        data = await websocket.receive_text()
                        message = json.loads(data)
                        
                        if message["type"] == "audio":
                            # Forward audio to OpenAI (already base64 encoded)
                            await connection.input_audio_buffer.append(
                                audio=message["audio"]
                            )
                except WebSocketDisconnect:
                    print("❌ Client disconnected")
                except Exception as e:
                    print(f"Error in browser_to_openai: {e}")
            
            # Task to receive events from OpenAI and send to browser
            async def openai_to_browser():
                try:
                    async for event in connection:
                        event_data = {
                            "type": event.type,
                        }
                        
                        if event.type == "input_audio_buffer.speech_started":
                            event_data["status"] = "listening"
                            print("🎤 [Listening...]")
                        
                        elif event.type == "input_audio_buffer.speech_stopped":
                            event_data["status"] = "processing"
                            print("💭 [Processing...]")
                        
                        elif event.type == "conversation.item.input_audio_transcription.completed":
                            event_data["transcript"] = event.transcript
                            event_data["role"] = "user"
                            print(f"\nYou: {event.transcript}")
                        
                        elif event.type == "response.audio_transcript.delta":
                            event_data["delta"] = event.delta
                            print(event.delta, end="", flush=True)
                        
                        elif event.type == "response.audio.delta":
                            # Send audio chunk to browser
                            event_data["audio"] = event.delta
                        
                        elif event.type == "response.audio_transcript.done":
                            print("\n")
                        
                        elif event.type == "response.done":
                            event_data["status"] = "ready"
                            print("🎤 [Ready to listen...]")
                        
                        elif event.type == "error":
                            event_data["error"] = str(event.error)
                            print(f"\n❌ Error: {event.error}")
                        
                        # Send event to browser
                        await websocket.send_text(json.dumps(event_data))
                        
                except Exception as e:
                    print(f"Error in openai_to_browser: {e}")
            
            # Run both tasks concurrently
            await asyncio.gather(
                browser_to_openai(),
                openai_to_browser(),
            )
    
    except Exception as e:
        print(f"Error in websocket_endpoint: {e}")
        await websocket.close()

@app.get("/")
async def root():
    return {"message": "Voice chatbot WebSocket server running. Connect to /ws"}

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Starting WebSocket server...")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
