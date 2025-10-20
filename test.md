# Test Cases for Realtime Voice Chatbot

This document outlines the test cases for the realtime voice chatbot application, covering backend, frontend, and end-to-end integration testing.

## Backend Tests

### WebSocket Server (`ws-server.py`)

#### Connection Tests
- [ ] **Test 1.1**: Server starts and listens on configured host and port
  - **Setup**: Start server with default configuration
  - **Expected**: Server binds to `0.0.0.0:8765` and accepts connections
  - **Validation**: Connect with WebSocket client and verify successful connection

- [ ] **Test 1.2**: Server accepts multiple concurrent client connections
  - **Setup**: Connect multiple WebSocket clients simultaneously
  - **Expected**: All clients connect successfully and maintain independent sessions
  - **Validation**: Each client receives responses only for their own audio input

- [ ] **Test 1.3**: Server handles client disconnection gracefully
  - **Setup**: Connect client, send audio, then disconnect
  - **Expected**: Server cleans up resources and continues serving other clients
  - **Validation**: No memory leaks or connection errors in server logs

#### Audio Forwarding Tests
- [ ] **Test 2.1**: Server forwards audio from client to Azure OpenAI
  - **Setup**: Send Base64-encoded PCM16 audio through WebSocket
  - **Expected**: Audio is decoded and forwarded to Azure OpenAI Realtime API
  - **Validation**: Monitor backend logs for successful audio transmission

- [ ] **Test 2.2**: Server forwards audio responses from Azure OpenAI to client
  - **Setup**: Trigger AI response by speaking to the system
  - **Expected**: Server receives audio from OpenAI and sends it to client as Base64
  - **Validation**: Client receives `audio_output` messages with valid Base64 data

- [ ] **Test 2.3**: Server handles invalid audio format gracefully
  - **Setup**: Send malformed or invalid Base64 audio data
  - **Expected**: Server logs warning and continues processing
  - **Validation**: Server doesn't crash; error is logged appropriately

#### VAD Event Tests
- [ ] **Test 3.1**: Server forwards `speech_started` event to client
  - **Setup**: Speak into microphone to trigger VAD
  - **Expected**: Client receives `speech_started` message
  - **Validation**: Check WebSocket message log for event arrival

- [ ] **Test 3.2**: Server forwards `speech_stopped` event to client
  - **Setup**: Speak and then stop speaking
  - **Expected**: Client receives `speech_stopped` message after silence
  - **Validation**: Verify event timing matches actual speech cessation

- [ ] **Test 3.3**: VAD events are sent only for active speech
  - **Setup**: Play background noise without clear speech
  - **Expected**: No `speech_started` events for noise
  - **Validation**: Monitor events to ensure only real speech triggers VAD

#### Transcript Tests
- [ ] **Test 4.1**: Server forwards user transcripts to client
  - **Setup**: Speak a clear phrase
  - **Expected**: Client receives transcript message with type "user" and correct text
  - **Validation**: Compare transcript text to spoken phrase

- [ ] **Test 4.2**: Server forwards AI transcripts to client
  - **Setup**: Receive AI response
  - **Expected**: Client receives transcript message with type "ai" and response text
  - **Validation**: Verify transcript matches AI audio response

- [ ] **Test 4.3**: TranscriptBuilder accumulates and flushes correctly
  - **Setup**: Process multiple text deltas from OpenAI
  - **Expected**: Text is accumulated and flushed as complete transcript
  - **Validation**: Unit test for TranscriptBuilder class

#### Error Handling Tests
- [ ] **Test 5.1**: Server handles Azure OpenAI connection failures
  - **Setup**: Configure invalid Azure endpoint or API key
  - **Expected**: Server logs error and notifies client of connection failure
  - **Validation**: Client receives error message; server remains stable

- [ ] **Test 5.2**: Server handles JSON parsing errors
  - **Setup**: Send non-JSON message over WebSocket
  - **Expected**: Server logs warning and continues processing
  - **Validation**: Check logs for appropriate warning message

- [ ] **Test 5.3**: Server handles missing environment variables
  - **Setup**: Start server without required environment variables
  - **Expected**: Server logs error or uses defaults appropriately
  - **Validation**: Check for clear error messages or default behavior

## Frontend Tests

### Audio Capture (`lib/audio-capture.ts`)

#### Microphone Access Tests
- [ ] **Test 6.1**: Successfully request microphone permission
  - **Setup**: Initialize audio capture
  - **Expected**: Browser prompts for microphone permission
  - **Validation**: Permission granted; microphone stream is active

- [ ] **Test 6.2**: Handle microphone permission denial
  - **Setup**: Deny microphone permission when prompted
  - **Expected**: Error is caught and reported to user
  - **Validation**: User sees appropriate error message

- [ ] **Test 6.3**: Handle microphone already in use
  - **Setup**: Use microphone in another tab/app, then try to access
  - **Expected**: Appropriate error handling
  - **Validation**: User informed of the issue

#### Audio Processing Tests
- [ ] **Test 7.1**: Audio is resampled from 48kHz to 24kHz correctly
  - **Setup**: Capture audio at browser's native sample rate
  - **Expected**: AudioWorklet resamples to 24kHz
  - **Validation**: Check output sample rate and audio quality

- [ ] **Test 7.2**: Audio is converted from Float32 to PCM16 correctly
  - **Setup**: Process captured Float32 audio
  - **Expected**: Audio is converted to 16-bit signed integers
  - **Validation**: Verify data format and value ranges

- [ ] **Test 7.3**: Audio is Base64-encoded correctly
  - **Setup**: Convert PCM16 audio to Base64
  - **Expected**: Valid Base64 string is generated
  - **Validation**: Decode and verify original audio data

- [ ] **Test 7.4**: Audio chunks are sent continuously without gaps
  - **Setup**: Speak continuously for several seconds
  - **Expected**: Audio chunks are sent at regular intervals
  - **Validation**: Monitor WebSocket traffic for consistent chunk timing

### Audio Playback (`lib/audio-playback.ts`)

#### Playback Queue Tests
- [ ] **Test 8.1**: Audio chunks are queued correctly
  - **Setup**: Receive multiple audio chunks rapidly
  - **Expected**: Chunks are queued in memory in order
  - **Validation**: Check queue contents and order

- [ ] **Test 8.2**: Audio chunks play sequentially without gaps
  - **Setup**: Queue multiple audio chunks
  - **Expected**: Chunks play smoothly back-to-back
  - **Validation**: Listen for audio gaps or stuttering

- [ ] **Test 8.3**: Audio decoding works correctly (Base64 → PCM16 → Float32)
  - **Setup**: Receive Base64 audio from backend
  - **Expected**: Audio is decoded through all format conversions
  - **Validation**: Verify audio quality and format at each step

#### Playback Control Tests
- [ ] **Test 9.1**: Playback starts when first chunk arrives
  - **Setup**: Queue and play first audio chunk
  - **Expected**: Audio plays immediately without delay
  - **Validation**: Measure time from chunk arrival to audio start

- [ ] **Test 9.2**: Playback stops when queue is empty
  - **Setup**: Play all queued audio chunks
  - **Expected**: Playback stops cleanly when no more chunks
  - **Validation**: Check that isAISpeaking flag updates correctly

- [ ] **Test 9.3**: Playback can be stopped mid-stream
  - **Setup**: Start playback and stop manually
  - **Expected**: Audio stops immediately; queue is cleared
  - **Validation**: Verify no audio continues playing

### WebSocket Client (`lib/websocket-client.ts`)

#### Connection Management Tests
- [ ] **Test 10.1**: Client connects to backend successfully
  - **Setup**: Initialize WebSocket client with correct URL
  - **Expected**: Connection established; ready state is OPEN
  - **Validation**: Check connection state and logs

- [ ] **Test 10.2**: Client reconnects after connection loss
  - **Setup**: Stop backend server while client is connected
  - **Expected**: Client attempts reconnection after 3 seconds
  - **Validation**: Monitor reconnection attempts and success

- [ ] **Test 10.3**: Client handles connection errors gracefully
  - **Setup**: Connect to invalid WebSocket URL
  - **Expected**: Error is caught and reported
  - **Validation**: No uncaught exceptions; user informed

#### Message Handling Tests
- [ ] **Test 11.1**: Client sends messages correctly
  - **Setup**: Send audio_input message through WebSocket
  - **Expected**: Message is serialized and sent to backend
  - **Validation**: Monitor WebSocket traffic in browser DevTools

- [ ] **Test 11.2**: Client receives messages correctly
  - **Setup**: Trigger backend to send messages (audio_output, transcripts)
  - **Expected**: Messages are received and parsed correctly
  - **Validation**: Check that onMessage handlers are called with correct data

- [ ] **Test 11.3**: Client handles malformed messages
  - **Setup**: Backend sends invalid JSON
  - **Expected**: Error is caught; client continues operating
  - **Validation**: Check error logs; no crashes

### Main Voice Chat Hook (`hooks/use-voice-chat.ts`)

#### Initialization Tests
- [ ] **Test 12.1**: Hook initializes all components correctly
  - **Setup**: Mount component that uses the hook
  - **Expected**: WebSocket, audio capture, and playback are initialized
  - **Validation**: Check that all components are ready

- [ ] **Test 12.2**: Hook manages lifecycle correctly
  - **Setup**: Mount and unmount component
  - **Expected**: Resources are cleaned up on unmount
  - **Validation**: No memory leaks; WebSocket disconnected

#### State Management Tests
- [ ] **Test 13.1**: `isUserSpeaking` updates on VAD events
  - **Setup**: Speak to trigger `speech_started` and `speech_stopped` events
  - **Expected**: `isUserSpeaking` is true during speech, false otherwise
  - **Validation**: Monitor state changes in React DevTools

- [ ] **Test 13.2**: `isAISpeaking` updates during AI response
  - **Setup**: Receive AI audio response
  - **Expected**: `isAISpeaking` is true while audio plays, false when done
  - **Validation**: Check state transitions and timing

- [ ] **Test 13.3**: Transcripts are accumulated correctly
  - **Setup**: Conduct multi-turn conversation
  - **Expected**: Both user and AI transcripts are stored in order
  - **Validation**: Verify transcript array contents and order

#### Session Control Tests
- [ ] **Test 14.1**: `start()` method initiates voice chat session
  - **Setup**: Call start() method
  - **Expected**: Audio capture begins; WebSocket connects
  - **Validation**: Check that all components are active

- [ ] **Test 14.2**: `stop()` method ends voice chat session
  - **Setup**: Start session, then call stop()
  - **Expected**: Audio capture stops; resources are released
  - **Validation**: Verify all components are inactive

- [ ] **Test 14.3**: Session handles multiple start/stop cycles
  - **Setup**: Start and stop session multiple times
  - **Expected**: Each cycle works correctly without issues
  - **Validation**: No memory leaks or connection errors

### UI Components (`app/page.tsx`)

#### Visualization Tests
- [ ] **Test 15.1**: Gray waveform appears when user speaks
  - **Setup**: Start session and speak
  - **Expected**: Gray waveform animation displays
  - **Validation**: Visual inspection or screenshot comparison

- [ ] **Test 15.2**: Green waveform appears when AI speaks
  - **Setup**: Receive AI audio response
  - **Expected**: Green waveform animation displays
  - **Validation**: Visual inspection or screenshot comparison

- [ ] **Test 15.3**: Timeline scrolls continuously
  - **Setup**: Observe timeline during conversation
  - **Expected**: Timeline pans left as time passes
  - **Validation**: Visual inspection; verify requestAnimationFrame updates

- [ ] **Test 15.4**: Time labels update correctly
  - **Setup**: Watch timeline for 60+ seconds
  - **Expected**: Time labels (60s, 45s, 30s, 15s, now) update smoothly
  - **Validation**: Visual inspection of time markers

#### Transcript Display Tests
- [ ] **Test 16.1**: User transcripts display correctly
  - **Setup**: Speak and wait for transcript
  - **Expected**: Transcript appears with "User" label and correct text
  - **Validation**: Compare displayed text to spoken phrase

- [ ] **Test 16.2**: AI transcripts display correctly
  - **Setup**: Receive AI response
  - **Expected**: Transcript appears with "AI" label and correct text
  - **Validation**: Verify transcript content matches audio

- [ ] **Test 16.3**: Transcript panel auto-scrolls to latest message
  - **Setup**: Have multi-turn conversation
  - **Expected**: Panel automatically scrolls to show latest transcript
  - **Validation**: Latest message is always visible

#### Control Tests
- [ ] **Test 17.1**: Start button initiates voice chat
  - **Setup**: Click start button
  - **Expected**: Session starts; button changes to "Stop"
  - **Validation**: Audio capture begins; UI updates

- [ ] **Test 17.2**: Stop button ends voice chat
  - **Setup**: Start session, then click stop
  - **Expected**: Session ends; button changes to "Start"
  - **Validation**: Audio capture stops; UI updates

- [ ] **Test 17.3**: Connection status displays correctly
  - **Setup**: Start session; disconnect backend; reconnect backend
  - **Expected**: Status shows connected/disconnected appropriately
  - **Validation**: Check status indicator in UI

## Integration Tests

### End-to-End Flow Tests
- [ ] **Test 18.1**: Complete conversation flow works end-to-end
  - **Setup**: Start session, speak, receive response, continue conversation
  - **Expected**: All components work together seamlessly
  - **Validation**: Multi-turn conversation completes successfully

- [ ] **Test 18.2**: Audio quality is maintained throughout pipeline
  - **Setup**: Speak clearly and listen to responses
  - **Expected**: Audio is clear without distortion or artifacts
  - **Validation**: Subjective audio quality assessment

- [ ] **Test 18.3**: Latency is acceptable for natural conversation
  - **Setup**: Measure time from speech end to AI response start
  - **Expected**: Latency under 2 seconds for good user experience
  - **Validation**: Time measurements using browser performance API

#### Multi-User Tests
- [ ] **Test 19.1**: Multiple users can connect simultaneously
  - **Setup**: Open application in multiple browser windows/tabs
  - **Expected**: Each session is independent and functional
  - **Validation**: All sessions work without interference

- [ ] **Test 19.2**: Users don't interfere with each other
  - **Setup**: Two users speak at the same time
  - **Expected**: Each gets their own AI response
  - **Validation**: Transcripts are user-specific; no cross-talk

#### Reconnection Tests
- [ ] **Test 20.1**: Frontend reconnects after backend restart
  - **Setup**: Stop and restart backend server
  - **Expected**: Frontend automatically reconnects and resumes
  - **Validation**: Session continues without user intervention

- [ ] **Test 20.2**: Session state is preserved across reconnection
  - **Setup**: Reconnect after temporary disconnection
  - **Expected**: Transcript history is maintained
  - **Validation**: Previous transcripts still visible

- [ ] **Test 20.3**: Long network interruption is handled gracefully
  - **Setup**: Simulate network outage for 30+ seconds
  - **Expected**: App shows disconnected state; reconnects when available
  - **Validation**: Clear user feedback during outage

## Performance Tests

### Resource Usage Tests
- [ ] **Test 21.1**: Memory usage stays stable during long sessions
  - **Setup**: Run session for 30+ minutes
  - **Expected**: Memory usage doesn't continuously increase
  - **Validation**: Monitor browser and server memory usage

- [ ] **Test 21.2**: CPU usage is reasonable during active conversation
  - **Setup**: Have active conversation with continuous speech
  - **Expected**: CPU usage under 50% on modern hardware
  - **Validation**: Monitor CPU usage in task manager

- [ ] **Test 21.3**: Network bandwidth is efficiently utilized
  - **Setup**: Monitor network traffic during conversation
  - **Expected**: Bandwidth usage is proportional to audio quality
  - **Validation**: Check network tab in browser DevTools

### Stress Tests
- [ ] **Test 22.1**: System handles rapid speech changes
  - **Setup**: Speak quickly with frequent pauses
  - **Expected**: VAD events and transcripts keep up
  - **Validation**: No delayed or missed events

- [ ] **Test 22.2**: System handles long continuous speech
  - **Setup**: Speak continuously for 5+ minutes
  - **Expected**: Audio is transmitted without buffer overflow
  - **Validation**: No audio loss or connection drops

- [ ] **Test 22.3**: System recovers from temporary overload
  - **Setup**: Simulate high system load
  - **Expected**: Performance degrades gracefully; recovers when load decreases
  - **Validation**: System remains functional throughout

## Security Tests

### Authentication & Authorization
- [ ] **Test 23.1**: Backend requires valid Azure credentials
  - **Setup**: Start backend with invalid credentials
  - **Expected**: Connection to Azure OpenAI fails with clear error
  - **Validation**: Error is logged; client is notified

- [ ] **Test 23.2**: Sensitive data is not exposed in logs
  - **Setup**: Review all log output
  - **Expected**: No API keys, tokens, or sensitive data in logs
  - **Validation**: Manual log review

### Input Validation
- [ ] **Test 24.1**: Backend validates message types
  - **Setup**: Send message with invalid type
  - **Expected**: Backend rejects or ignores invalid messages
  - **Validation**: Check backend logs for validation errors

- [ ] **Test 24.2**: Backend validates audio data format
  - **Setup**: Send non-Base64 data in audio_input message
  - **Expected**: Backend handles gracefully without crash
  - **Validation**: Backend logs error; continues processing

## Browser Compatibility Tests

- [ ] **Test 25.1**: Application works in Chrome (latest)
- [ ] **Test 25.2**: Application works in Firefox (latest)
- [ ] **Test 25.3**: Application works in Safari (latest)
- [ ] **Test 25.4**: Application works in Edge (latest)
- [ ] **Test 25.5**: Microphone access works in all supported browsers
- [ ] **Test 25.6**: Audio playback works in all supported browsers

## Environment Tests

- [ ] **Test 26.1**: Application works with default environment variables
- [ ] **Test 26.2**: Custom `VOICE_SERVER_HOST` and `VOICE_SERVER_PORT` work correctly
- [ ] **Test 26.3**: Custom `AZURE_OPENAI_REALTIME_MODEL` is respected
- [ ] **Test 26.4**: Custom `AZURE_OPENAI_VOICE` is used for responses
- [ ] **Test 26.5**: Frontend respects `NEXT_PUBLIC_VOICE_SERVER_URL` configuration

## Deployment Tests

- [ ] **Test 27.1**: Backend can be deployed to production environment
- [ ] **Test 27.2**: Frontend can be built and deployed successfully
- [ ] **Test 27.3**: CORS is configured correctly for cross-origin requests
- [ ] **Test 27.4**: HTTPS/WSS works for production deployment
- [ ] **Test 27.5**: Application works across different network configurations

## Regression Tests

- [ ] **Test 28.1**: Previous conversation features still work after updates
- [ ] **Test 28.2**: No new console errors or warnings introduced
- [ ] **Test 28.3**: Performance hasn't degraded from previous version
- [ ] **Test 28.4**: All existing UI elements render correctly

## Notes

- All tests should be run in both development and production builds
- Visual tests should include screenshots for regression testing
- Performance benchmarks should be documented for comparison
- Security tests should be part of regular review process
- Browser compatibility tests should be run on actual devices when possible
