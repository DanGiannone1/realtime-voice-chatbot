# Agent Command Center - Frontend Design Specification

## Overview
This document provides a comprehensive specification of all frontend UI elements for the Agent Command Center voice assistant interface. All measurements, colors, and styling details are documented to ensure consistent implementation.

---

## Color Palette

### Primary Colors
- **Bluish Grey (Interactive Elements)**: `#7B9DD3`
  - Used for: Title, action buttons
- **Emerald Green (AI Elements)**: `#10b981` (emerald-500)
  - Used for: AI message bubbles, AI waveforms, AI indicators
- **Dark Grey (User Elements)**: `#374151` (gray-700)
  - Used for: User message bubbles
- **Medium Grey (User Waveforms)**: `#6b7280` (gray-600)
  - Used for: User waveforms in visualization
- **Amber (Tool Calls)**: `#f59e0b` (amber-500)
  - Used for: Tool call indicators

### Background Colors
- **Pure Black**: `#000000`
  - Base background
- **Gradient Dark**: `#000000` to `#1A1A1A`
  - Used for: Panel backgrounds (visualization, telemetry, transcript)
- **Border Grey**: `#333333`
  - Used for: Message bubble borders, panel borders

### Text Colors
- **White**: `#ffffff`
  - Primary text on dark backgrounds
- **Grey-400**: `#9ca3af`
  - Timestamps, secondary text
- **Grey-500**: `#6b7280`
  - Placeholder text

---

## Typography

### Fonts
- **Sans-serif**: System default (likely Inter or similar)
- **Mono**: For timestamps

### Text Styles
- **Title (Agent Command Center)**
  - Size: `text-3xl` (1.875rem / 30px)
  - Weight: `font-bold` (700)
  - Color: `#7B9DD3`
  - Letter spacing: `tracking-tight`

- **Section Headers** (e.g., "Agent Telemetry", "Conversation Transcript")
  - Size: `text-xl` (1.25rem / 20px)
  - Weight: `font-semibold` (600)
  - Color: White

- **Message Text**
  - Size: `text-sm` (0.875rem / 14px)
  - Weight: Regular (400)
  - Color: White

- **Timestamps**
  - Size: `text-xs` (0.75rem / 12px)
  - Weight: Regular (400)
  - Color: `#9ca3af` with 70% opacity
  - Font: Monospace

- **Placeholder Text**
  - Size: `text-sm` (0.875rem / 14px)
  - Color: `#6b7280`

---

## Layout Structure

### Main Container
- **Display**: Flex
- **Direction**: Row
- **Height**: Full viewport (`h-screen`)
- **Background**: Linear gradient from `#000000` to `#1A1A1A` (top to bottom)
- **Padding**: `p-6` (1.5rem / 24px)
- **Gap**: `gap-6` (1.5rem / 24px)

### Left Column (Main Content)
- **Flex**: `flex-1`
- **Display**: Flex column
- **Gap**: `gap-6` (1.5rem / 24px)

### Right Column (Transcript Sidebar)
- **Width**: `w-96` (24rem / 384px)
- **Display**: Flex column
- **Background**: Linear gradient from `#000000` to `#1A1A1A`
- **Border**: `1px solid #333333`
- **Border radius**: `rounded-lg` (0.5rem / 8px)
- **Padding**: `p-6` (1.5rem / 24px)
- **Shadow**: `0 4px 6px -1px rgba(0, 0, 0, 0.5)`

---

## Component Specifications

### 1. Header Section

#### Title: "Agent Command Center"
- **Typography**: See Typography section above
- **Position**: Top left of main content area
- **Margin bottom**: `mb-6` (1.5rem / 24px)

#### Action Buttons Container
- **Display**: Flex row
- **Alignment**: Items center
- **Gap**: `gap-2` (0.5rem / 8px)
- **Position**: Top right of main content area

#### Start/Stop Button
- **Background**: 
  - Start: `#7B9DD3`
  - Stop: `#ef4444` (red-500)
- **Background (hover)**:
  - Start: `#6B8DC3` (darker blue)
  - Stop: `#dc2626` (red-600)
- **Text color**: White
- **Padding**: `px-4 py-2` (horizontal: 1rem / 16px, vertical: 0.5rem / 8px)
- **Border radius**: `rounded-md` (0.375rem / 6px)
- **Font size**: `text-sm` (0.875rem / 14px)
- **Font weight**: `font-medium` (500)
- **Shadow**: `0 2px 4px rgba(0, 0, 0, 0.5)`
- **Icon**: Play/Stop icon with `mr-2` spacing
- **Transition**: All properties, 200ms

#### Time Range Buttons (1m, 3m, 5m)
- **Background**: `#7B9DD3`
- **Background (hover)**: `#6B8DC3`
- **Background (active)**: `#5B7DB3` (even darker)
- **Text color**: White
- **Padding**: `px-3 py-2` (horizontal: 0.75rem / 12px, vertical: 0.5rem / 8px)
- **Border radius**: `rounded-md` (0.375rem / 6px)
- **Font size**: `text-sm` (0.875rem / 14px)
- **Font weight**: `font-medium` (500)
- **Shadow**: `0 2px 4px rgba(0, 0, 0, 0.5)`
- **Transition**: All properties, 200ms

---

### 2. Visualization Panel

**Note**: This component uses HTML5 Canvas for real-time waveform visualization. Implementation details are deferred until core functionality is complete.

#### Container
- **Background**: Linear gradient from `#000000` to `#1A1A1A`
- **Border**: `1px solid #333333`
- **Border radius**: `rounded-lg` (0.5rem / 8px)
- **Padding**: `p-6` (1.5rem / 24px)
- **Shadow**: `0 4px 6px -1px rgba(0, 0, 0, 0.5)`
- **Height**: `h-64` (16rem / 256px)

#### Canvas Element
- **Width**: Full container width
- **Height**: Full container height
- **Background**: Transparent

#### Waveform Colors
- **User (You)**: `#6b7280` (gray-600)
- **AI**: `#10b981` (emerald-500)
- **Tool Call**: `#f59e0b` (amber-500)

#### Time Labels
- **Position**: Bottom of canvas
- **Font size**: `text-xs` (0.75rem / 12px)
- **Color**: `#6b7280`
- **Labels**: "60s", "45s", "30s", "15s", "now" (right to left)

#### Playback Time Display
- **Position**: Bottom left of panel
- **Font size**: `text-sm` (0.875rem / 14px)
- **Color**: `#9ca3af`
- **Format**: "0:00 / 0:00" (current / total)

#### Legend
- **Position**: Bottom right of panel
- **Display**: Flex row
- **Gap**: `gap-4` (1rem / 16px)
- **Font size**: `text-xs` (0.75rem / 12px)
- **Color**: `#9ca3af`
- **Indicators**: Colored circles (8px diameter) with labels

---

### 3. Agent Telemetry Panel

#### Container
- **Background**: Linear gradient from `#000000` to `#1A1A1A`
- **Border**: `1px solid #333333`
- **Border radius**: `rounded-lg` (0.5rem / 8px)
- **Padding**: `p-6` (1.5rem / 24px)
- **Shadow**: `0 4px 6px -1px rgba(0, 0, 0, 0.5)`
- **Min height**: `min-h-64` (16rem / 256px)
- **Flex**: `flex-1`

#### Header
- **Text**: "Agent Telemetry"
- **Typography**: See Section Headers in Typography section
- **Margin bottom**: `mb-4` (1rem / 16px)

#### Empty State
- **Display**: Flex
- **Alignment**: Center (both axes)
- **Height**: Full container
- **Text**: "Telemetry data will appear here"
- **Text color**: `#6b7280`
- **Font size**: `text-sm` (0.875rem / 14px)

---

### 4. Conversation Transcript Panel

#### Container
- **Width**: `w-96` (24rem / 384px)
- **Background**: Linear gradient from `#000000` to `#1A1A1A`
- **Border**: `1px solid #333333`
- **Border radius**: `rounded-lg` (0.5rem / 8px)
- **Padding**: `p-6` (1.5rem / 24px)
- **Shadow**: `0 4px 6px -1px rgba(0, 0, 0, 0.5)`
- **Display**: Flex column
- **Height**: Full viewport height minus padding

#### Header
- **Text**: "Conversation Transcript"
- **Typography**: See Section Headers in Typography section
- **Margin bottom**: `mb-4` (1rem / 16px)

#### Messages Container
- **Flex**: `flex-1`
- **Overflow Y**: Auto (only when messages present)
- **Padding right**: `pr-2` (0.5rem / 8px) for scrollbar spacing
- **Gap**: `space-y-4` (1rem / 16px between messages)

#### Empty State
- **Display**: Flex
- **Alignment**: Center (both axes)
- **Height**: Full container
- **Text**: "Start the conversation to see transcripts here"
- **Text color**: `#6b7280`
- **Font size**: `text-sm` (0.875rem / 14px)

---

### 5. Message Bubbles

#### AI Message Bubble
- **Background**: `rgba(16, 185, 129, 0.1)` (emerald with 10% opacity)
- **Border**: `1px solid rgba(16, 185, 129, 0.3)` (emerald with 30% opacity)
- **Border radius**: `rounded-lg` (0.5rem / 8px)
- **Padding**: `p-3` (0.75rem / 12px)
- **Shadow**: `0 2px 4px rgba(0, 0, 0, 0.5)`
- **Max width**: `max-w-[85%]`
- **Alignment**: Left (self-start)

#### User Message Bubble
- **Background**: `#374151` (gray-700)
- **Border**: `1px solid #333333`
- **Border radius**: `rounded-lg` (0.5rem / 8px)
- **Padding**: `p-3` (0.75rem / 12px)
- **Shadow**: `0 2px 4px rgba(0, 0, 0, 0.5)`
- **Max width**: `max-w-[85%]`
- **Alignment**: Right (self-end)

#### Timestamp
- **Font size**: `text-xs` (0.75rem / 12px)
- **Font family**: Monospace
- **Color**: `#9ca3af` with 70% opacity
- **Margin bottom**: `mb-1` (0.25rem / 4px)
- **Format**: "HH:MM:SS AM/PM"

#### AI Message Icon (Sparkles)
- **Size**: `w-3 h-3` (0.75rem / 12px)
- **Color**: `#10b981` (emerald-500)
- **Position**: Inline with timestamp
- **Margin right**: `mr-1` (0.25rem / 4px)

#### Message Text
- **Font size**: `text-sm` (0.875rem / 14px)
- **Color**: White
- **Line height**: `leading-relaxed` (1.625)

---

## Elevation & Shadows

### Panel Shadow
\`\`\`css
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
\`\`\`

### Button Shadow
\`\`\`css
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
\`\`\`

### Message Bubble Shadow
\`\`\`css
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
\`\`\`

---

## Interactions & States

### Button Hover States
- **Transition**: All properties, 200ms ease
- **Background**: Darkens by approximately 10-15%
- **Cursor**: Pointer

### Button Active States
- **Background**: Darkens by approximately 20-25%
- **Scale**: Slightly reduced (optional)

### Scrollbar Styling
- **Width**: Thin (8px)
- **Track**: Transparent
- **Thumb**: `#374151` (gray-700)
- **Thumb (hover)**: `#4b5563` (gray-600)

---

## Responsive Behavior

### Current Implementation
- Fixed layout optimized for desktop (1920x1080 and similar)
- Sidebar width: 384px
- Main content: Flexible width


---

## Implementation Notes

### Technology Stack
- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS v4
- **Canvas**: HTML5 Canvas API for waveform visualization
- **Icons**: Lucide React

### Key Dependencies
- `lucide-react`: For icons (Play, Square, Sparkles, Wrench)
- Canvas API: For real-time waveform rendering

### State Management
- React hooks (`useState`, `useEffect`, `useRef`)
- Local component state for UI interactions
- Future: WebSocket connection for real-time data

### Performance Considerations
- Canvas rendering optimized for 60fps
- Message list virtualization (if needed for long conversations)
- Debounced scroll events
- Memoized components where appropriate

---



