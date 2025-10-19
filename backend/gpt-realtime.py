import os
import base64
import asyncio
import queue
import threading
from openai import AsyncAzureOpenAI

# ============================================================================
# VAD CONFIGURATION - EASY SWITCHING!
# ============================================================================
# Choose your VAD mode by uncommenting one of the options below:

# NOTE: This version uses CONTINUOUS SILENCE to keep the audio device warm.
# The audio stream constantly plays (silence or real audio), eliminating
# any startup latency and audio cutoff. Perfect for always-on voice assistants!

# OPTION 1: SEMANTIC VAD (CURRENTLY ACTIVE) ✅
# - Smarter, context-aware detection
# - Won't interrupt during "umm..." or natural pauses
# - Better for natural conversations
VAD_CONFIG = {
    "type": "semantic_vad",
}

# ============================================================================
# VOICE SELECTION - Try different voices for quality!
# ============================================================================
# Available voices: "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"
# Different voices have different qualities - experiment to find your favorite!
# The newer voices (ash, ballad, coral, sage, verse) are more expressive.
VOICE = "alloy"  # Change this to try different voices!

# ============================================================================

# OPTION 2: SERVER VAD (SILENCE-BASED)
# - Faster, more predictable
# - Triggers after X milliseconds of silence
# - Better for quick Q&A
# Uncomment the block below to use Server VAD instead:
"""
VAD_CONFIG = {
    "type": "server_vad",
    "threshold": 0.5,                # Speech detection sensitivity (0.0-1.0)
    "silence_duration_ms": 700,      # Wait 700ms of silence before triggering
    "prefix_padding_ms": 300,        # Capture 300ms before speech starts
}
"""

# ============================================================================

class AudioPlaybackState:
    """Shared state for audio playback - useful for UI updates."""
    def __init__(self):
        self.is_speaking = False  # True when AI is speaking, False when silent
        self.lock = threading.Lock()
    
    def set_speaking(self, speaking: bool):
        with self.lock:
            self.is_speaking = speaking
    
    def get_speaking(self) -> bool:
        with self.lock:
            return self.is_speaking

def audio_playback_thread(audio_queue, stream, state: AudioPlaybackState):
    """
    Continuously plays audio - silence when idle, real audio when available.
    This keeps the audio device 'warm' and eliminates startup latency.
    """
    import struct
    
    CHUNK_SIZE = 512  # Match the stream's frames_per_buffer
    SILENCE = b'\x00' * (CHUNK_SIZE * 2)  # 16-bit = 2 bytes per sample
    
    while True:
        try:
            # Try to get real audio with a short timeout
            audio_data = audio_queue.get(timeout=0.01)
            
            if audio_data is None:
                break  # Shutdown signal
            
            # Play real audio
            state.set_speaking(True)
            stream.write(audio_data)
            
        except queue.Empty:
            # No audio available - play silence to keep device warm
            state.set_speaking(False)
            stream.write(SILENCE)

async def main() -> None:
    """
    Voice-to-voice conversation with configurable VAD.
    
    Current mode: SEMANTIC VAD (context-aware)
    To switch to Server VAD (silence-based), see VAD_CONFIG above.
    """
    
    client = AsyncAzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version="2025-04-01-preview",
    )
    
    # Initialize PyAudio
    p = pyaudio.PyAudio()
    
    SAMPLE_RATE = 24000
    CHUNK_SIZE = 1024
    
    # Output stream for AI responses
    output_stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        output=True,
        frames_per_buffer=512
    )
    
    # Input stream for microphone
    input_stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE
    )
    
    # Audio playback queue, state, and thread
    audio_queue = queue.Queue(maxsize=10)
    playback_state = AudioPlaybackState()
    
    playback_thread = threading.Thread(
        target=audio_playback_thread,
        args=(audio_queue, output_stream, playback_state),
        daemon=True
    )
    playback_thread.start()
    
    # Optional: Print speaking state for debugging
    # You can use playback_state.get_speaking() in your UI to show status
    async def monitor_speaking_state():
        """Example of how to monitor state for UI updates."""
        last_state = None
        while True:
            current_state = playback_state.get_speaking()
            if current_state != last_state:
                status = "🔊 AI SPEAKING" if current_state else "🔇 SILENCE"
                # Uncomment to see state changes:
                # print(f"\n[Audio State: {status}]", flush=True)
                last_state = current_state
            await asyncio.sleep(0.1)
    
    # Uncomment to enable state monitoring:
    # monitor_task = asyncio.create_task(monitor_speaking_state())
    
    try:
        async with client.beta.realtime.connect(
            model="gpt-realtime",
        ) as connection:
            # Configure session with chosen VAD mode and explicit audio formats
            await connection.session.update(session={
                "modalities": ["text", "audio"],
                "voice": VOICE,  # Use the voice configured at the top
                "instructions": "You are a helpful assistant. Keep responses concise and natural.",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": VAD_CONFIG,  # Using the VAD config from above
                # Explicitly set audio formats for best quality
                "input_audio_format": "pcm16",   # 24kHz, 16-bit PCM, mono
                "output_audio_format": "pcm16",  # 24kHz, 16-bit PCM, mono
            })
            
            # Display current VAD mode
            vad_mode = VAD_CONFIG["type"]
            print("=" * 60)
            print(f"🎤 Voice Conversation Ready!")
            print(f"   Voice: {VOICE.upper()}")
            print(f"   VAD Mode: {vad_mode.upper().replace('_', ' ')}")
            if vad_mode == "server_vad":
                print(f"   Silence Duration: {VAD_CONFIG.get('silence_duration_ms', 'N/A')}ms")
            print("=" * 60)
            print("\nJust start talking naturally...")
            print("Press Ctrl+C to quit.\n")
            
            # Continuously stream audio from microphone
            async def stream_audio():
                """Stream audio from mic to the API."""
                while True:
                    try:
                        audio_chunk = input_stream.read(CHUNK_SIZE, exception_on_overflow=False)
                        audio_base64 = base64.b64encode(audio_chunk).decode('utf-8')
                        await connection.input_audio_buffer.append(audio=audio_base64)
                        await asyncio.sleep(0.01)
                    except Exception as e:
                        print(f"Error streaming audio: {e}")
                        break
            
            # Start streaming in background
            stream_task = asyncio.create_task(stream_audio())
            
            # Handle API events
            try:
                async for event in connection:
                    if event.type == "input_audio_buffer.speech_started":
                        print("\n🎤 [Listening...]", flush=True)
                    
                    elif event.type == "input_audio_buffer.speech_stopped":
                        print("💭 [Processing...]", flush=True)
                    
                    elif event.type == "conversation.item.input_audio_transcription.completed":
                        print(f"\nYou: {event.transcript}")
                    
                    elif event.type == "response.audio_transcript.delta":
                        print(event.delta, end="", flush=True)
                    
                    elif event.type == "response.audio.delta":
                        # Just queue the audio - no buffering needed!
                        audio_chunk = base64.b64decode(event.delta)
                        audio_queue.put(audio_chunk)
                    
                    elif event.type == "response.audio_transcript.done":
                        print("\n")
                    
                    elif event.type == "response.done":
                        print("🎤 [Ready to listen...]")
                    
                    elif event.type == "error":
                        print(f"\n❌ Error: {event.error}")
                        break
                        
            except KeyboardInterrupt:
                print("\n\nGoodbye!")
                stream_task.cancel()
    
    finally:
        # Cleanup
        audio_queue.put(None)
        playback_thread.join(timeout=1)
        
        input_stream.stop_stream()
        input_stream.close()
        output_stream.stop_stream()
        output_stream.close()
        p.terminate()

if __name__ == "__main__":
    """
    QUICK REFERENCE - VAD Comparison:
    
    SEMANTIC VAD (current):
    ✅ Smart, context-aware
    ✅ Handles natural pauses well
    ✅ Won't interrupt during "umm..."
    ⚠️ Slightly slower response
    
    SERVER VAD (alternate):
    ✅ Fast, predictable
    ✅ Configurable silence duration
    ✅ Snappy responses
    ⚠️ May interrupt during pauses
    
    To switch: Uncomment the desired VAD_CONFIG at the top of the file!
    
    ---
    
    CONTINUOUS SILENCE APPROACH:
    
    This version keeps the audio device "warm" by continuously playing
    silence when there's no AI speech. Benefits:
    
    ✅ ZERO audio cutoff - first syllable always plays
    ✅ Device stays active - no startup latency
    ✅ State tracking - perfect for UI indicators
    ✅ Can run 24/7 - ready for conversation anytime
    
    UI INTEGRATION:
    
    The `playback_state` object tracks whether AI is speaking:
    
    ```python
    if playback_state.get_speaking():
        # Show "AI Speaking" indicator in your UI
        update_ui(status="speaking", color="green")
    else:
        # Show "Silence" or "Listening" indicator
        update_ui(status="listening", color="blue")
    ```
    
    The state updates automatically in real-time as audio plays!
    """
    asyncio.run(main())