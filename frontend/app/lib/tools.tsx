/**
 * Realtime API Tool Definitions and Handlers
 * 
 * This file contains all tool definitions and their implementations for the
 * Azure OpenAI Realtime API. Tools are executed client-side when the AI
 * requests them during a conversation.
 */

// ============================================================================
// Types
// ============================================================================

export interface ToolResult {
  ok: boolean;
  error?: string;
  [key: string]: any; // Allow additional fields like city, weather, etc.
}

export interface WeatherData {
  ok: boolean;
  city?: string;
  latitude?: number;
  longitude?: number;
  weather?: {
    temperature_c: number;
    windspeed_kmh: number;
    winddirection_deg: number;
    is_day: number;
    time: string;
    code: number;
  };
  error?: string;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "get_weather",
    description: "Get the current weather for a specified city. Returns temperature in Celsius, wind speed, and current conditions using Open-Meteo API.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "The city name (e.g., 'San Francisco', 'Tokyo', 'London')"
        }
      },
      required: ["city"]
    }
  }
] as const;

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Get weather for a city using Open-Meteo API (no API key needed)
 * 
 * This uses:
 * 1. Open-Meteo Geocoding API to convert city name to coordinates
 * 2. Open-Meteo Weather API to get current weather data
 * 
 * @param args - Tool arguments containing city name
 * @returns Weather data or error
 */
async function handleGetWeather(args: { city: string }): Promise<ToolResult> {
  try {
    const city = (args?.city || "").trim();
    
    if (!city) {
      return { ok: false, error: "city is required" };
    }

    console.log(`🌤️  Fetching weather for "${city}"`);

    // 1) Geocode the city
    const geoResp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(city)}`
    );
    
    if (!geoResp.ok) {
      throw new Error(`Geocoding API error: ${geoResp.statusText}`);
    }
    
    const geo = await geoResp.json();
    const loc = geo?.results?.[0];
    
    if (!loc) {
      return { ok: false, error: `city not found: ${city}` };
    }

    console.log(`📍 Found: ${loc.name}, ${loc.country} (${loc.latitude}, ${loc.longitude})`);

    // 2) Get current weather
    const wxResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`
    );
    
    if (!wxResp.ok) {
      throw new Error(`Weather API error: ${wxResp.statusText}`);
    }
    
    const wx = await wxResp.json();
    const cur = wx?.current_weather || {};

    const result: WeatherData = {
      ok: true,
      city: `${loc.name}${loc.admin1 ? ", " + loc.admin1 : ""}${loc.country ? ", " + loc.country : ""}`,
      latitude: loc.latitude,
      longitude: loc.longitude,
      weather: {
        temperature_c: cur.temperature,
        windspeed_kmh: cur.windspeed,
        winddirection_deg: cur.winddirection,
        is_day: cur.is_day,
        time: cur.time,
        code: cur.weathercode,
      },
    };

    console.log("✅ Weather data retrieved:", result);
    
    return result;
    
  } catch (error) {
    console.error("❌ Weather tool error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to fetch weather data";
    
    return {
      ok: false,
      error: errorMessage
    };
  }
}

// ============================================================================
// Tool Registry & Executor
// ============================================================================

/**
 * Registry of all available tools and their handler functions
 */
const TOOL_HANDLERS: Record<string, (args: any) => Promise<ToolResult>> = {
  get_weather: handleGetWeather,
  // Add more tools here as you build them:
  // search_knowledge_base: handleSearchKnowledgeBase,
  // get_calendar_events: handleGetCalendarEvents,
  // etc.
};

/**
 * Execute a tool call by name with the given arguments
 * 
 * @param toolName - Name of the tool to execute
 * @param args - Arguments to pass to the tool
 * @returns Result of the tool execution
 */
export async function executeToolCall(
  toolName: string, 
  args: any
): Promise<ToolResult> {
  console.log(`🔧 Executing tool: ${toolName}`, args);
  
  const handler = TOOL_HANDLERS[toolName];
  
  if (!handler) {
    const availableTools = Object.keys(TOOL_HANDLERS).join(", ");
    console.error(`❌ Unknown tool: ${toolName}`);
    
    return {
      ok: false,
      error: `unknown tool: ${toolName}. Available tools: ${availableTools}`
    };
  }
  
  try {
    const result = await handler(args);
    
    if (result.ok) {
      console.log(`✅ Tool "${toolName}" completed successfully`);
    } else {
      console.log(`⚠️  Tool "${toolName}" completed with error:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Tool "${toolName}" threw an exception:`, error);
    
    return {
      ok: false,
      error: error instanceof Error 
        ? error.message 
        : "Tool execution failed with an unknown error"
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a list of all available tool names
 * @returns Array of tool names
 */
export function getAvailableTools(): string[] {
  return Object.keys(TOOL_HANDLERS);
}

/**
 * Check if a tool exists in the registry
 * @param toolName - Name of the tool to check
 * @returns True if the tool exists
 */
export function isToolAvailable(toolName: string): boolean {
  return toolName in TOOL_HANDLERS;
}

/**
 * Get the count of registered tools
 * @returns Number of available tools
 */
export function getToolCount(): number {
  return Object.keys(TOOL_HANDLERS).length;
}

// ============================================================================
// Helper for parsing JSON safely
// ============================================================================

/**
 * Safely parse JSON, returning empty object on failure
 */
export function safeParseJSON(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// ============================================================================
// Debug Helper
// ============================================================================

/**
 * Log information about all registered tools (useful for debugging)
 */
export function logToolInfo(): void {
  console.log("📋 Registered Tools:");
  console.log(`   Total: ${getToolCount()}`);
  console.log(`   Tools: ${getAvailableTools().join(", ")}`);
  console.log("\n📝 Tool Definitions:");
  TOOL_DEFINITIONS.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
}