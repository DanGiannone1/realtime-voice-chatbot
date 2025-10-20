import asyncio
import base64
import json
import logging
import os
from typing import Any, Dict, Optional

import websockets
from websockets.server import WebSocketServerProtocol

from openai import AsyncAzureOpenAI

LOGGER = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
MODEL = os.environ.get("AZURE_OPENAI_REALTIME_MODEL", "gpt-realtime")
VOICE = os.environ.get("AZURE_OPENAI_VOICE", "alloy")
HOST = os.environ.get("VOICE_SERVER_HOST", "0.0.0.0")
PORT = int(os.environ.get("VOICE_SERVER_PORT", "8765"))


class TranscriptBuilder:
    """Accumulates transcript text for a single AI response."""

    def __init__(self) -> None:
        self._buffer: list[str] = []

    def append(self, text: str) -> None:
        if text:
            self._buffer.append(text)

    def flush(self) -> Optional[str]:
        if not self._buffer:
            return None
        text = "".join(self._buffer)
        self._buffer.clear()
        return text


async def forward_client_audio(
    websocket: WebSocketServerProtocol, connection: Any
) -> None:
    """Forward audio chunks from the browser to Azure OpenAI."""
    async for raw in websocket:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            LOGGER.warning("Received non-JSON message from client: %s", raw)
            continue

        msg_type = payload.get("type")
        if msg_type == "audio_input":
            audio_data = payload.get("data")
            if not isinstance(audio_data, str):
                LOGGER.warning("audio_input message missing base64 data")
                continue
            await connection.input_audio_buffer.append(audio=audio_data)
        elif msg_type == "stop":
            LOGGER.info("Client requested stop streaming")
            break
        else:
            LOGGER.debug("Ignoring unsupported client message: %s", payload)


async def forward_openai_events(
    websocket: WebSocketServerProtocol, connection: Any
) -> None:
    """Forward events from Azure OpenAI to the browser."""
    transcript_builder = TranscriptBuilder()

    async for event in connection:
        event_type = getattr(event, "type", "")
        LOGGER.debug("Received event: %s", event_type)

        if event_type == "input_audio_buffer.speech_started":
            await websocket.send(json.dumps({"type": "speech_started"}))
        elif event_type == "input_audio_buffer.speech_stopped":
            await websocket.send(json.dumps({"type": "speech_stopped"}))
        elif event_type == "conversation.item.input_audio_transcription.completed":
            transcript = getattr(event, "transcript", None)
            if transcript:
                await websocket.send(
                    json.dumps(
                        {
                            "type": "transcript",
                            "data": {
                                "speaker": "user",
                                "text": transcript,
                            },
                        }
                    )
                )
        elif event_type == "response.audio_transcript.delta":
            delta = getattr(event, "delta", None)
            if delta:
                transcript_builder.append(delta)
        elif event_type == "response.audio_transcript.done":
            text = transcript_builder.flush()
            if text:
                await websocket.send(
                    json.dumps(
                        {
                            "type": "transcript",
                            "data": {
                                "speaker": "ai",
                                "text": text,
                            },
                        }
                    )
                )
        elif event_type == "response.audio.delta":
            delta = getattr(event, "delta", None)
            if not delta:
                continue
            # Ensure the payload is base64 encoded before sending.
            if isinstance(delta, (bytes, bytearray)):
                audio_payload = base64.b64encode(delta).decode("utf-8")
            else:
                audio_payload = delta
            await websocket.send(
                json.dumps(
                    {
                        "type": "audio_output",
                        "data": audio_payload,
                    }
                )
            )
        elif event_type == "response.completed":
            text = transcript_builder.flush()
            if text:
                await websocket.send(
                    json.dumps(
                        {
                            "type": "transcript",
                            "data": {
                                "speaker": "ai",
                                "text": text,
                            },
                        }
                    )
                )
        elif event_type == "response.error":
            error_message = getattr(event, "error", None)
            LOGGER.error("OpenAI error: %s", error_message)
            await websocket.send(
                json.dumps(
                    {
                        "type": "error",
                        "error": "openai",
                        "message": str(error_message) if error_message else "Unknown error",
                    }
                )
            )
        elif event_type == "error":
            error_message = getattr(event, "error", None)
            LOGGER.error("OpenAI error event: %s", error_message)
            await websocket.send(
                json.dumps(
                    {
                        "type": "error",
                        "error": "openai",
                        "message": str(error_message) if error_message else "Unknown error",
                    }
                )
            )


async def handle_client(websocket: WebSocketServerProtocol) -> None:
    if not AZURE_ENDPOINT or not AZURE_KEY:
        await websocket.send(
            json.dumps(
                {
                    "type": "error",
                    "error": "config",
                    "message": "Azure OpenAI credentials are not configured on the server.",
                }
            )
        )
        await websocket.close()
        return

    client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version="2025-04-01-preview",
    )

    LOGGER.info("Client connected: %s", websocket.remote_address)

    try:
        async with client.beta.realtime.connect(model=MODEL) as connection:
            await connection.session.update(
                session={
                    "modalities": ["text", "audio"],
                    "voice": VOICE,
                    "instructions": "You are a helpful assistant. Keep responses concise and natural.",
                    "input_audio_transcription": {"model": "whisper-1"},
                    "turn_detection": {"type": "server_vad"},
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                }
            )

            forward_tasks = [
                asyncio.create_task(forward_client_audio(websocket, connection)),
                asyncio.create_task(forward_openai_events(websocket, connection)),
            ]

            done, pending = await asyncio.wait(
                forward_tasks, return_when=asyncio.FIRST_EXCEPTION
            )

            for task in pending:
                task.cancel()

            for task in done:
                if task.exception():
                    raise task.exception()
    except websockets.exceptions.ConnectionClosedError:
        LOGGER.info("WebSocket closed by client")
    except Exception as exc:  # pragma: no cover - defensive logging
        LOGGER.exception("Unexpected error handling client: %s", exc)
        try:
            await websocket.send(
                json.dumps(
                    {
                        "type": "error",
                        "error": "server",
                        "message": str(exc),
                    }
                )
            )
        except Exception:
            pass
    finally:
        LOGGER.info("Client disconnected: %s", websocket.remote_address)


async def main() -> None:
    LOGGER.info("Starting WebSocket server on %s:%s", HOST, PORT)
    async with websockets.serve(handle_client, HOST, PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        LOGGER.info("Server stopped by user")
