"""
Azure OpenAI Realtime API - WebRTC Backend
Generates ephemeral tokens for secure browser-to-Azure WebRTC connections
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import httpx
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Azure OpenAI Realtime WebRTC Token Server")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/session")
async def create_session():
    """
    Generate an ephemeral token for WebRTC authentication.
    
    IMPORTANT: Azure OpenAI uses different endpoints for WebRTC:
    1. Sessions API: https://yourresource.openai.azure.com/openai/realtimeapi/sessions
    2. WebRTC endpoint: https://region.realtimeapi-preview.ai.azure.com/v1/realtimertc
    
    Returns:
        dict: Session data including ephemeral token and WebRTC endpoint
    """
    try:
        # Get environment variables
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
        api_key = os.environ.get("AZURE_OPENAI_API_KEY")
        deployment_name = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-realtime")
        region = os.environ.get("AZURE_OPENAI_REGION")
        
        if not endpoint or not api_key:
            raise HTTPException(
                status_code=500,
                detail="Missing Azure OpenAI credentials"
            )
        
        # Parse the base URL from the endpoint
        # User might provide full URL like:
        # https://xxx.cognitiveservices.azure.com/openai/realtime?api-version=...&deployment=...
        # We need just: https://xxx.cognitiveservices.azure.com
        from urllib.parse import urlparse
        parsed = urlparse(endpoint)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # Extract region from hostname if not provided
        # hostname format: xxx-mfo2yjpp-eastus2.cognitiveservices.azure.com
        if not region:
            hostname_parts = parsed.netloc.split('.')
            if hostname_parts and '-' in hostname_parts[0]:
                # Try to extract region from hostname (e.g., "xxx-id-eastus2")
                parts = hostname_parts[0].split('-')
                if len(parts) >= 3:
                    potential_region = parts[-1]  # Last part might be region
                    if potential_region in ["eastus2", "swedencentral"]:
                        region = potential_region
                        logger.info(f"Extracted region '{region}' from hostname")
            
            # Default to eastus2 if still not found
            if not region:
                region = "eastus2"
                logger.warning(f"Region not found in hostname, defaulting to '{region}'")
        
        # CRITICAL: Azure uses /realtimeapi/sessions (not /realtime/sessions)
        sessions_url = f"{base_url}/openai/realtimeapi/sessions?api-version=2025-04-01-preview"
        
        logger.info(f"Requesting ephemeral token from: {sessions_url}")
        logger.info(f"Deployment: {deployment_name}, Region: {region}")
        
        # Request ephemeral token
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                sessions_url,
                headers={
                    "api-key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "model": deployment_name,
                    "voice": "alloy",
                    "instructions": "You are a helpful AI assistant. Keep responses concise and natural.",
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 500,
                    },
                    "input_audio_transcription": {
                        "model": "whisper-1"
                    },
                },
            )
            
            if response.status_code != 200:
                logger.error(f"Azure API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create session: {response.text}"
                )
            
            session_data = response.json()
            
            # CRITICAL: Add the WebRTC endpoint to the response
            # Azure WebRTC endpoints are regional and separate from your resource endpoint
            webrtc_url = f"https://{region}.realtimeapi-preview.ai.azure.com/v1/realtimertc"
            
            # Ensure we return the WebRTC URL
            result = {
                **session_data,
                "webrtc_url": webrtc_url
            }
            
            logger.info(f"✅ Ephemeral token generated successfully")
            logger.info(f"Session ID: {result.get('id', 'N/A')}")
            logger.info(f"Model: {result.get('model', 'N/A')}")
            logger.info(f"WebRTC URL: {webrtc_url}")
            
            return result
            
    except httpx.TimeoutException:
        logger.error("Request timeout")
        raise HTTPException(status_code=504, detail="Request timeout")
    except httpx.RequestError as e:
        logger.error(f"Network error: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    # Check for required environment variables
    required_vars = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY"]
    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Required variables:")
        logger.error("  AZURE_OPENAI_ENDPOINT - Your Azure OpenAI endpoint (base URL or full URL)")
        logger.error("  AZURE_OPENAI_API_KEY - Your API key")
        logger.error("Optional variables:")
        logger.error("  AZURE_OPENAI_REGION - 'eastus2' or 'swedencentral' (auto-detected if not set)")
        logger.error("  AZURE_OPENAI_DEPLOYMENT - Deployment name (default: 'gpt-realtime')")
        exit(1)
    
    # Parse endpoint to extract region
    from urllib.parse import urlparse
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    parsed = urlparse(endpoint)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    region = os.environ.get("AZURE_OPENAI_REGION")
    if not region and parsed.netloc:
        # Try to extract from hostname
        hostname_parts = parsed.netloc.split('.')
        if hostname_parts and '-' in hostname_parts[0]:
            parts = hostname_parts[0].split('-')
            if len(parts) >= 3:
                potential_region = parts[-1]
                if potential_region in ["eastus2", "swedencentral"]:
                    region = potential_region
    
    if not region:
        region = "eastus2"
        logger.warning(f"⚠️  Could not auto-detect region, using default: '{region}'")
        logger.warning("   Set AZURE_OPENAI_REGION if your resource is in a different region")
    
    if region not in ["eastus2", "swedencentral"]:
        logger.warning(f"⚠️  Unusual region '{region}'. Supported regions are 'eastus2' or 'swedencentral'")
        logger.warning("   WebRTC may not work in other regions yet.")
    
    logger.info("=" * 70)
    logger.info("🚀 Azure OpenAI Realtime WebRTC Token Server Starting")
    logger.info(f"   Full Endpoint: {endpoint}")
    logger.info(f"   Base URL: {base_url}")
    logger.info(f"   Deployment: {os.environ.get('AZURE_OPENAI_DEPLOYMENT', 'gpt-realtime')}")
    logger.info(f"   Region: {region}")
    logger.info(f"   WebRTC URL: https://{region}.realtimeapi-preview.ai.azure.com/v1/realtimertc")
    logger.info("   Server: http://localhost:8080")
    logger.info("=" * 70)
    
    uvicorn.run(app, host="localhost", port=8080, log_level="info")