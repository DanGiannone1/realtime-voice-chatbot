# Frontend Test Plan

## Overview
This document outlines comprehensive testing strategies for the Realtime Voice Chatbot frontend application built with Next.js, React, TypeScript, and WebRTC.

---

## Test Categories

### 1. Unit Tests
### 2. Integration Tests
### 3. End-to-End (E2E) Tests
### 4. Performance Tests
### 5. Accessibility Tests

---

## 1. Unit Tests

### 1.1 WaveformVisualizer Component (`app/components/WaveformVisualizer.tsx`)

#### Test: Component Rendering
- **Description**: Verify the component renders a canvas element correctly
- **Test Cases**:
  - Should render a canvas element with correct class names
  - Should apply proper styling (display: block, h-full, w-full)
  - Canvas should be properly sized based on container dimensions

#### Test: Canvas Initialization
- **Description**: Verify canvas context and dimensions are set up correctly
- **Test Cases**:
  - Should create a 2D rendering context
  - Should set canvas width and height based on device pixel ratio
  - Should apply correct transformation matrix for high-DPI displays

#### Test: Ref Props Handling
- **Description**: Test that all ref props are properly utilized
- **Test Cases**:
  - Should read from `isUserSpeakingRef` correctly
  - Should read from `isAiSpeakingRef` correctly
  - Should read from `isToolRunningRef` correctly
  - Should handle undefined analysers gracefully

#### Test: Time Window Rendering
- **Description**: Test different time window configurations
- **Test Cases**:
  - Should render 60-second (1m) time window correctly
  - Should render 180-second (3m) time window correctly
  - Should render 300-second (5m) time window correctly
  - Should update axis labels when time window changes

#### Test: State Visualization
- **Description**: Test waveform visualization for different states
- **Test Cases**:
  - Should display gray waveform when user is speaking
  - Should display emerald/green waveform when AI is speaking
  - Should display amber indicator when tool is running
  - Should display subtle slate color during silence
  - Should render wrench icon when tool execution starts

#### Test: Audio Analysis
- **Description**: Test Web Audio API integration
- **Test Cases**:
  - Should calculate RMS values from AnalyserNode correctly
  - Should handle missing analyser gracefully (return 0)
  - Should normalize loudness values to 0-1 range
  - Should map loudness to visual height appropriately

#### Test: Animation Loop
- **Description**: Test requestAnimationFrame rendering
- **Test Cases**:
  - Should start animation loop on mount
  - Should stop animation loop on unmount
  - Should scroll waveform left over time when active
  - Should not scroll when `isActive` is false
  - Should maintain consistent scroll speed based on time window

#### Test: Resize Handling
- **Description**: Test window resize behavior
- **Test Cases**:
  - Should cancel previous animation frame on resize
  - Should reinitialize canvas with new dimensions
  - Should restart animation loop after resize
  - Should clean up resize listener on unmount

#### Test: Axis and Labels
- **Description**: Test axis rendering and time labels
- **Test Cases**:
  - Should draw horizontal axis line at correct position
  - Should render tick marks at correct intervals (60s, 45s, 30s, 15s, now)
  - Should align "now" label to the right
  - Should align time window start label (60s) to the left
  - Should center middle labels
  - Should use monospace font for labels

---

### 1.2 Tools Module (`app/lib/tools.tsx`)

#### Test: Tool Definitions
- **Description**: Verify tool definitions are correctly structured
- **Test Cases**:
  - Should export TOOL_DEFINITIONS array
  - get_weather tool should have correct name, type, description
  - get_weather parameters should specify city as required string

#### Test: Weather Tool Handler
- **Description**: Test `handleGetWeather` function
- **Test Cases**:
  - Should return error if city parameter is missing
  - Should return error if city parameter is empty string
  - Should fetch geocoding data from Open-Meteo API
  - Should handle geocoding API errors gracefully
  - Should return error for non-existent cities
  - Should fetch weather data after successful geocoding
  - Should handle weather API errors gracefully
  - Should return structured weather data on success
  - Should include city name, coordinates, and weather details
  - Should log appropriate console messages during execution

#### Test: Tool Registry
- **Description**: Test TOOL_HANDLERS registry
- **Test Cases**:
  - Should contain get_weather handler
  - Should map tool names to handler functions
  - Handler functions should return Promises

#### Test: executeToolCall Function
- **Description**: Test tool execution dispatcher
- **Test Cases**:
  - Should execute correct handler based on tool name
  - Should return error for unknown tool names
  - Should list available tools in error message
  - Should pass arguments to handler correctly
  - Should catch and handle handler exceptions
  - Should log execution start, success, and errors

#### Test: Utility Functions
- **Description**: Test helper functions
- **Test Cases**:
  - `getAvailableTools()` should return array of tool names
  - `isToolAvailable()` should return true for registered tools
  - `isToolAvailable()` should return false for unregistered tools
  - `getToolCount()` should return correct number of tools
  - `safeParseJSON()` should parse valid JSON
  - `safeParseJSON()` should return empty object for invalid JSON
  - `logToolInfo()` should log registered tools and definitions

#### Test: Type Safety
- **Description**: Test TypeScript types and interfaces
- **Test Cases**:
  - ToolResult interface should be correctly typed
  - WeatherData interface should include all expected fields
  - Handler functions should match expected signature

---

### 1.3 Main Page Component (`app/page.tsx`)

#### Test: Initial State
- **Description**: Test component initialization
- **Test Cases**:
  - Should initialize with isConnected = false
  - Should initialize with appropriate default status message
  - Should initialize with empty transcript array
  - Should initialize with isLoading = false
  - Should initialize with selectedTimeRange = "1m"
  - Should initialize with isUserSpeaking = false
  - Should initialize with isAiSpeaking = false

#### Test: Session Management
- **Description**: Test WebRTC session lifecycle
- **Test Cases**:
  - Should request session from backend on start
  - Should handle successful session creation
  - Should handle session creation failures
  - Should extract ephemeral token from response
  - Should extract WebRTC URL from response
  - Should update status during session setup
  - Should set isLoading during session creation

#### Test: Microphone Access
- **Description**: Test getUserMedia functionality
- **Test Cases**:
  - Should request microphone with correct constraints
  - Should use 24000 Hz sample rate
  - Should request mono audio (channelCount: 1)
  - Should enable echo cancellation
  - Should enable noise suppression
  - Should enable auto gain control
  - Should handle microphone permission denial
  - Should store media stream reference

#### Test: WebRTC Connection
- **Description**: Test RTCPeerConnection setup
- **Test Cases**:
  - Should create RTCPeerConnection instance
  - Should create data channel named "oai-events"
  - Should add media stream tracks to peer connection
  - Should create SDP offer
  - Should send offer to Azure WebRTC endpoint
  - Should set remote description from answer
  - Should handle connection state changes
  - Should set isConnected when connection succeeds
  - Should clean up on connection failure

#### Test: Data Channel Events
- **Description**: Test event handling via data channel
- **Test Cases**:
  - Should send session.update on data channel open
  - Should configure tool definitions on session update
  - Should parse incoming JSON messages
  - Should handle session.created event
  - Should handle session.updated event
  - Should handle input_audio_buffer.speech_started event
  - Should handle input_audio_buffer.speech_stopped event
  - Should handle conversation.item.input_audio_transcription.completed
  - Should handle response.audio.delta event
  - Should handle response.audio_transcript.delta event
  - Should handle response.done event
  - Should handle output_audio_buffer.stopped event
  - Should handle error events

#### Test: Tool Call Handling
- **Description**: Test function calling flow
- **Test Cases**:
  - Should detect response.output_item.added with function_call type
  - Should store pending tool calls with call_id
  - Should accumulate function arguments from delta events
  - Should execute tool when response.function_call_arguments.done received
  - Should send tool result back via data channel
  - Should trigger response.create after sending result
  - Should remove completed tool calls from pending map
  - Should set isToolRunningRef when tool is active
  - Should clear isToolRunningRef when all tools complete

#### Test: Weather Tool Integration
- **Description**: Test get_weather tool execution
- **Test Cases**:
  - Should extract city from function arguments
  - Should call getWeather function with city name
  - Should handle successful weather fetch
  - Should handle weather fetch errors
  - Should send result back to AI

#### Test: Transcript Management
- **Description**: Test conversation transcript state
- **Test Cases**:
  - Should add user message on transcription completion
  - Should add AI message on first audio delta
  - Should append to existing AI message on subsequent deltas
  - Should include timestamp with each message
  - Should use 12-hour time format for timestamps
  - Should differentiate between user and AI roles

#### Test: Audio Playback
- **Description**: Test incoming audio handling
- **Test Cases**:
  - Should create audio element reference
  - Should handle ontrack event from peer connection
  - Should set srcObject to incoming stream
  - Should auto-play incoming audio
  - Should handle audio playback errors
  - Should create Web Audio analysers for visualization

#### Test: Cleanup
- **Description**: Test resource cleanup
- **Test Cases**:
  - Should stop all media stream tracks on cleanup
  - Should close data channel on cleanup
  - Should close peer connection on cleanup
  - Should close audio context on cleanup
  - Should clear audio element srcObject
  - Should reset all refs to null
  - Should call cleanup on component unmount
  - Should call cleanup on stopConversation

#### Test: UI Interactions
- **Description**: Test user interactions
- **Test Cases**:
  - Should toggle between start and stop conversation
  - Should disable button during loading
  - Should change button appearance based on connection state
  - Should allow time range selection (1m, 3m, 5m)
  - Should update selectedTimeRange state on button click
  - Should apply active styles to selected time range

#### Test: Status Updates
- **Description**: Test status message updates
- **Test Cases**:
  - Should show "Click 'Start Session' to begin" initially
  - Should show "Requesting session from backend..." during fetch
  - Should show "Getting microphone access..." during getUserMedia
  - Should show "Creating WebRTC connection..." during setup
  - Should show "Connecting to Azure..." during SDP exchange
  - Should show "Connected! Start speaking..." on success
  - Should show "Listening..." when user speech detected
  - Should show "Processing..." after user stops speaking
  - Should show "AI is responding..." during AI response
  - Should show "Running tool: {name}" during tool execution
  - Should show error messages when failures occur

#### Test: Error Handling
- **Description**: Test error scenarios
- **Test Cases**:
  - Should handle backend session creation errors
  - Should handle missing webrtc_url in session response
  - Should handle getUserMedia failures
  - Should handle SDP exchange failures
  - Should handle malformed server messages
  - Should log errors to console
  - Should display user-friendly error messages

#### Test: Safe JSON Parsing
- **Description**: Test safeParseJSON utility
- **Test Cases**:
  - Should parse valid JSON strings
  - Should return fallback for invalid JSON
  - Should handle null input
  - Should handle undefined input
  - Should use custom fallback value if provided

---

### 1.4 Layout Component (`app/layout.tsx`)

#### Test: Metadata
- **Description**: Test metadata configuration
- **Test Cases**:
  - Should export correct page title: "WebRTC Voice Assistant"
  - Should export correct description: "Realtime voice chatbot using WebRTC"

#### Test: HTML Structure
- **Description**: Test root layout structure
- **Test Cases**:
  - Should render html tag with lang="en"
  - Should render body with correct classes
  - Should apply min-h-screen class to body
  - Should apply bg-black background color
  - Should apply text-white text color
  - Should render children prop

---

## 2. Integration Tests

### 2.1 Page + WaveformVisualizer Integration

#### Test: Waveform Updates
- **Description**: Test waveform responds to conversation state
- **Test Cases**:
  - Waveform should show user activity when isUserSpeaking is true
  - Waveform should show AI activity when isAiSpeaking is true
  - Waveform should show tool indicator when tool is running
  - Waveform should receive analyser nodes from audio context

#### Test: Time Range Selection
- **Description**: Test time range buttons update visualizer
- **Test Cases**:
  - Clicking 1m button should set 60-second window
  - Clicking 3m button should set 180-second window
  - Clicking 5m button should set 300-second window
  - Waveform should update axis labels when time range changes

---

### 2.2 Page + Tools Integration

#### Test: Tool Call Flow
- **Description**: Test complete tool execution flow
- **Test Cases**:
  - AI function call should trigger tool execution
  - Tool result should be sent back to AI
  - Status should update during tool execution
  - Tool running indicator should activate
  - Tool running indicator should deactivate on completion

#### Test: Weather Tool E2E
- **Description**: Test weather tool from request to response
- **Test Cases**:
  - Mock AI requesting weather for a city
  - Verify geocoding API is called
  - Verify weather API is called
  - Verify result is formatted correctly
  - Verify result is sent back via data channel

---

### 2.3 WebRTC + Backend Integration

#### Test: Session Creation Flow
- **Description**: Test backend token generation
- **Test Cases**:
  - Frontend should POST to /session endpoint
  - Backend should return session data
  - Response should include ephemeral token
  - Response should include webrtc_url
  - Frontend should use token for WebRTC auth

#### Test: Connection Establishment
- **Description**: Test full WebRTC handshake
- **Test Cases**:
  - Frontend creates offer with local media
  - Frontend sends offer to Azure with ephemeral token
  - Azure returns answer SDP
  - Frontend sets remote description
  - Connection state becomes "connected"
  - Data channel opens successfully

---

## 3. End-to-End (E2E) Tests

### 3.1 Complete Conversation Flow

#### Test: Start to Stop Conversation
- **Description**: Test full user journey
- **Steps**:
  1. Open application
  2. Click "Start Session" button
  3. Allow microphone access
  4. Wait for connection
  5. Simulate user speech
  6. Wait for AI response
  7. Click "Stop" button
  8. Verify cleanup

#### Test: Multi-Turn Conversation
- **Description**: Test multiple back-and-forth exchanges
- **Steps**:
  1. Start session
  2. User speaks first message
  3. Wait for AI response
  4. User speaks second message
  5. Wait for AI response
  6. Verify transcript shows all messages
  7. Verify messages are in correct order

#### Test: Tool-Assisted Conversation
- **Description**: Test conversation with tool calls
- **Steps**:
  1. Start session
  2. User asks for weather in a city
  3. AI requests get_weather tool
  4. Tool executes and returns data
  5. AI responds with weather information
  6. Verify tool indicator appears during execution
  7. Verify final response includes weather data

---

### 3.2 Error Recovery

#### Test: Microphone Denial Recovery
- **Description**: Test handling of denied microphone access
- **Steps**:
  1. Click "Start Session"
  2. Deny microphone permission
  3. Verify error message appears
  4. Verify button returns to "Start Session" state

#### Test: Network Failure Recovery
- **Description**: Test handling of connection failures
- **Steps**:
  1. Start session successfully
  2. Simulate network interruption
  3. Verify connection state changes to "failed"
  4. Verify cleanup occurs
  5. Verify user can restart session

#### Test: Backend Unavailable
- **Description**: Test handling when backend is offline
- **Steps**:
  1. Stop backend server
  2. Click "Start Session"
  3. Verify timeout or error message
  4. Verify loading state clears

---

### 3.3 UI Responsiveness

#### Test: Time Range Switching
- **Description**: Test switching time ranges during active session
- **Steps**:
  1. Start session
  2. Default should be 1m selected
  3. Click 3m button
  4. Verify waveform updates to show 180 seconds
  5. Click 5m button
  6. Verify waveform updates to show 300 seconds
  7. Verify active state styling updates

#### Test: Transcript Scrolling
- **Description**: Test transcript auto-scrolling
- **Steps**:
  1. Start session
  2. Generate many messages to overflow transcript area
  3. Verify scroll appears
  4. Verify new messages auto-scroll to bottom
  5. Verify manual scroll stays in place

---

## 4. Performance Tests

### 4.1 Canvas Rendering Performance

#### Test: Frame Rate
- **Description**: Verify waveform renders at 60fps
- **Metrics**:
  - Measure requestAnimationFrame callback frequency
  - Should maintain 60fps during idle
  - Should maintain acceptable fps during active conversation

#### Test: Memory Usage
- **Description**: Test for memory leaks in canvas rendering
- **Metrics**:
  - Monitor heap size over 5-minute session
  - Should not show continuous growth
  - Cleanup should release resources

---

### 4.2 WebRTC Performance

#### Test: Audio Latency
- **Description**: Measure end-to-end audio latency
- **Metrics**:
  - Time from user speech to AI response start
  - Should be < 1 second for simple queries
  - Monitor RTT and jitter in WebRTC stats

#### Test: Data Channel Throughput
- **Description**: Test message handling rate
- **Metrics**:
  - Should handle rapid event messages without lag
  - Should not drop messages during high activity

---

### 4.3 Resource Cleanup

#### Test: Connection Cleanup
- **Description**: Verify all resources are released
- **Steps**:
  1. Start session
  2. Stop session
  3. Verify media tracks are stopped
  4. Verify peer connection is closed
  5. Verify data channel is closed
  6. Verify audio context is closed
  7. No active WebRTC connections in chrome://webrtc-internals

---

## 5. Accessibility Tests

### 5.1 Keyboard Navigation

#### Test: Tab Order
- **Description**: Test keyboard navigation flow
- **Steps**:
  1. Tab through all interactive elements
  2. Verify logical order: Start/Stop → Time Range buttons
  3. Verify focus indicators are visible

#### Test: Keyboard Actions
- **Description**: Test button activation via keyboard
- **Steps**:
  1. Tab to "Start Session" button
  2. Press Enter or Space
  3. Verify session starts
  4. Tab to "Stop" button
  5. Press Enter or Space
  6. Verify session stops

---

### 5.2 Screen Reader Support

#### Test: ARIA Labels
- **Description**: Verify screen reader compatibility
- **Test Cases**:
  - Buttons should have descriptive labels
  - Status changes should be announced
  - Transcript messages should be readable
  - Time range buttons should indicate selected state

#### Test: Alt Text
- **Description**: Verify icons have text alternatives
- **Test Cases**:
  - Play icon should have accessible name
  - Stop icon should have accessible name
  - Sparkles icon should have accessible name
  - Wrench icon should have accessible name

---

### 5.3 Color Contrast

#### Test: WCAG Compliance
- **Description**: Verify color contrast ratios
- **Test Cases**:
  - Text on dark backgrounds should meet WCAG AA (4.5:1)
  - Button text should have sufficient contrast
  - AI message text should be readable
  - User message text should be readable
  - Status messages should be readable

---

## 6. Security Tests

### 6.1 Token Handling

#### Test: Ephemeral Token Security
- **Description**: Verify token is handled securely
- **Test Cases**:
  - Token should not be logged to console in production
  - Token should not be stored in localStorage
  - Token should be used only for WebRTC auth
  - Token should expire after use

#### Test: API Key Protection
- **Description**: Verify API key is never exposed
- **Test Cases**:
  - API key should never appear in frontend code
  - API key should never appear in network requests from browser
  - Only backend should have access to API key

---

### 6.2 Input Validation

#### Test: Tool Argument Validation
- **Description**: Test handling of malformed tool arguments
- **Test Cases**:
  - Should handle missing city parameter
  - Should handle empty strings
  - Should handle special characters
  - Should prevent injection attacks

#### Test: Message Parsing
- **Description**: Test handling of malformed messages
- **Test Cases**:
  - Should handle invalid JSON gracefully
  - Should handle missing required fields
  - Should not crash on unexpected message types

---

## 7. Browser Compatibility Tests

### 7.1 WebRTC Support

#### Test: Browser Support Matrix
- **Desktop Browsers to Test**:
  - Chrome/Chromium (latest, latest-1)
  - Firefox (latest, latest-1)
  - Safari (latest, latest-1)
  - Edge (latest, latest-1)
- **Mobile Browsers to Test**:
  - iOS Safari (latest, latest-1)
  - Chrome Mobile (Android, latest)
  - Firefox Mobile (Android, latest)
  - Samsung Internet (latest)

**Note**: Mobile browsers have different WebRTC implementations and stricter security policies for microphone access. Test microphone permissions, audio playback, and connection stability on mobile devices.

#### Test: WebRTC Feature Detection
- **Test Cases**:
  - Should detect RTCPeerConnection support
  - Should detect getUserMedia support
  - Should show helpful message if not supported

---

### 7.2 Audio API Support

#### Test: Web Audio API
- **Test Cases**:
  - AudioContext should be available
  - AnalyserNode should be available
  - Should handle vendor prefixes (webkitAudioContext)

---

## 8. Testing Tools & Framework Recommendations

### Recommended Testing Stack

#### Unit & Integration Tests
- **Framework**: Jest + React Testing Library
- **Purpose**: Test React components and utilities in isolation
- **Setup**:
  ```bash
  npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest ts-jest
  ```

#### E2E Tests
- **Framework**: Playwright or Cypress
- **Purpose**: Test complete user flows in real browser
- **Setup**:
  ```bash
  npm install --save-dev @playwright/test
  # or
  npm install --save-dev cypress
  ```

#### Performance Tests
- **Tools**: Chrome DevTools Performance Profiler, Lighthouse
- **Purpose**: Measure rendering performance and resource usage

#### WebRTC Testing
- **Tools**: webrtc-internals, manual testing with actual Azure connection
- **Purpose**: Validate WebRTC connection quality and stability

---

## 9. Test Data & Mocking

### 9.1 Mock Data

#### Session Response Mock
```typescript
const mockSessionResponse = {
  id: "sess_test123",
  model: "gpt-realtime",
  expires_at: Date.now() + 60000,
  client_secret: {
    value: "eph_test_token_123",
    expires_at: Date.now() + 60000
  },
  webrtc_url: "https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc",
  turn_detection: {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500
  },
  voice: "alloy",
  instructions: "You are a helpful AI assistant."
};
```

#### Weather API Mock Response
```typescript
const mockWeatherResponse = {
  ok: true,
  city: "San Francisco, California, United States",
  latitude: 37.7749,
  longitude: -122.4194,
  weather: {
    temperature_c: 18,
    windspeed_kmh: 12,
    winddirection_deg: 270,
    is_day: 1,
    time: "2024-01-15T10:00:00",
    code: 0
  }
};
```

#### Transcript Messages Mock
```typescript
const mockTranscript = [
  {
    role: "user" as const,
    content: "What's the weather in San Francisco?",
    timestamp: "10:30:15 AM"
  },
  {
    role: "ai" as const,
    content: "Let me check the weather for you.",
    timestamp: "10:30:16 AM"
  },
  {
    role: "ai" as const,
    content: "The current temperature in San Francisco is 18°C with light winds.",
    timestamp: "10:30:18 AM"
  }
];
```

---

### 9.2 Mocking Strategies

#### Mock getUserMedia
```typescript
const mockGetUserMedia = jest.fn().mockResolvedValue({
  getTracks: () => [
    {
      kind: 'audio',
      stop: jest.fn()
    }
  ]
});

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  }
});
```

#### Mock RTCPeerConnection
```typescript
class MockRTCPeerConnection {
  localDescription = null;
  remoteDescription = null;
  connectionState = 'new';
  
  createDataChannel = jest.fn().mockReturnValue({
    addEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn()
  });
  
  addTrack = jest.fn();
  createOffer = jest.fn().mockResolvedValue({ sdp: 'mock-offer' });
  setLocalDescription = jest.fn();
  setRemoteDescription = jest.fn();
  close = jest.fn();
}

global.RTCPeerConnection = MockRTCPeerConnection as any;
```

#### Mock fetch for Backend API
```typescript
global.fetch = jest.fn((url) => {
  if (url.includes('/session')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSessionResponse)
    });
  }
  return Promise.reject(new Error('Unhandled fetch URL'));
}) as jest.Mock;
```

---

## 10. Continuous Integration

### CI Pipeline Tests

#### On Pull Request
- Run all unit tests
- Run integration tests
- Run linting (ESLint)
- Run type checking (TypeScript)
- Build application
- Generate test coverage report (aim for >80%)

#### On Main Branch
- Run all tests from PR
- Run E2E tests
- Run performance benchmarks
- Deploy to staging environment

---

## 11. Manual Testing Checklist

### Pre-Release Testing
- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Edge (latest)
- [ ] Test microphone permissions flow
- [ ] Test with poor network conditions
- [ ] Test with firewall/VPN enabled
- [ ] Test session timeout handling
- [ ] Test rapid start/stop cycles
- [ ] Test with different microphone devices
- [ ] Test weather tool with various cities
- [ ] Test with international cities (different languages)
- [ ] Test transcript scrolling with long conversations
- [ ] Test all time range selections (1m, 3m, 5m)
- [ ] Verify no console errors in production build
- [ ] Test on high-DPI displays
- [ ] Test with browser zoom levels (50%, 100%, 150%, 200%)
- [ ] Test accessibility with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Test keyboard-only navigation

---

## 12. Known Limitations & Future Test Coverage

### Current Limitations
- No existing test infrastructure
- No CI/CD pipeline configured
- WebRTC requires real Azure connection for full testing
- Browser-based audio requires manual testing

### Future Test Coverage Needed
- Automated E2E tests for voice interactions
- Load testing for concurrent sessions
- Cross-browser automation for WebRTC
- Mobile browser testing (iOS Safari, Chrome Mobile)
- Offline functionality tests
- Session persistence tests
- Audio quality tests (bitrate, codec support)
- Multi-language support tests

---

## 13. Test Coverage Goals

### Target Coverage
- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: All component interactions covered
- **E2E Tests**: All critical user paths covered
- **Browser Compatibility**: Latest 2 versions of major browsers

### Priority Areas for Coverage
1. WebRTC connection establishment (High Priority)
2. Tool execution flow (High Priority)
3. Error handling (High Priority)
4. Transcript management (Medium Priority)
5. UI state management (Medium Priority)
6. Waveform rendering (Low Priority - primarily visual)

---

## Conclusion

This test plan provides comprehensive coverage for the Realtime Voice Chatbot frontend. The tests are organized by category and priority, making it easy to implement them incrementally. Start with high-priority unit tests, then add integration tests, and finally implement E2E tests for critical user flows.

Remember to:
- Write tests before fixing bugs (Test-Driven Bug Fixing)
- Keep tests maintainable and readable
- Mock external dependencies appropriately
- Run tests frequently during development
- Update tests when requirements change
- Monitor test coverage and aim for continuous improvement
