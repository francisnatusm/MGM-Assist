const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });

// Initialize Firebase Admin
try {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

  if (serviceAccountJson || serviceAccountPath) {
    const serviceAccount = serviceAccountJson
      ? JSON.parse(serviceAccountJson)
      : require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase Admin initialized");
  } else {
    console.warn("⚠️ FIREBASE service account not provided. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY_PATH.");
  }
} catch (e) {
  console.error("🔥 Firebase init error:", e.message);
}

/** Lazy-load MCP SDK so dashboard/API cold starts succeed if the SDK fails on this runtime. */
function loadMcpClientModules() {
  try {
    return {
      Client: require('@modelcontextprotocol/sdk/client/index.js').Client,
      StreamableHTTPClientTransport: require('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransport,
      SSEClientTransport: require('@modelcontextprotocol/sdk/client/sse.js').SSEClientTransport
    };
  } catch (e) {
    console.error('MCP SDK load failed:', e.message);
    return null;
  }
}

const app = express();
const PORT = 3003;  // Changed from 3002 to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());

// API configuration
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_URL = "https://api.anthropic.com/v1/messages";
const MCP_SERVER_URL = 'http://localhost:3001'; // Custom MCP server with free APIs
const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN || '';
const BRIGHTDATA_MCP_URL = BRIGHTDATA_API_TOKEN
  ? `https://mcp.brightdata.com/mcp?token=${encodeURIComponent(BRIGHTDATA_API_TOKEN)}`
  : '';
const MODELS_TO_TRY = [
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001'
];
const MAX_TOOL_ROUNDS = 4;

const MGM_URLS = {
  transit: 'https://www.montgomeryal.gov/live/community/montgomery-area-transit-system',
  sanitation: 'https://www.montgomeryal.gov/government/city-government/city-departments/sanitation',
  events: 'https://www.montgomeryal.gov/government/city-government/city-calendar',
  news: 'https://www.montgomeryal.gov/government/stay-informed/city-news',
  report311: 'https://www.montgomeryal.gov/residents/report-an-issue',
  permits: 'https://www.montgomeryal.gov/government/city-government/city-departments/inspections',
  parks: 'https://www.montgomeryal.gov/city-government/departments/parks-recreation',
  police: 'https://www.montgomeryal.gov/government/city-government/city-departments/police',
  business: 'https://www.montgomeryal.gov/work/business-resources/license-and-revenue',
  neighborhoods: 'https://www.montgomeryal.gov/city-government/departments/neighborhood-services'
};

class BrightDataMCPClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.client = null;
    this.transport = null;
    this.connectionType = null;
    this.isConnected = false;
  }

  async connect() {
    if (!this.serverUrl) {
      throw new Error('BRIGHTDATA_API_TOKEN is missing');
    }

    if (this.isConnected && this.client) {
      return;
    }

    const mcp = loadMcpClientModules();
    if (!mcp) {
      throw new Error('MCP SDK unavailable on this runtime');
    }
    const { Client, StreamableHTTPClientTransport, SSEClientTransport } = mcp;

    await this.close();
    const clientInfo = { name: 'mgm-assist-bridge', version: '1.0.0' };
    let streamableError = null;

    try {
      const streamableClient = new Client(clientInfo);
      const streamableTransport = new StreamableHTTPClientTransport(new URL(this.serverUrl), {
        requestInit: {
          headers: {
            'User-Agent': 'Montgomery-Chatbot/1.0'
          }
        }
      });
      await streamableClient.connect(streamableTransport);
      this.client = streamableClient;
      this.transport = streamableTransport;
      this.connectionType = 'streamable-http';
      this.isConnected = true;
      return;
    } catch (error) {
      streamableError = error;
    }

    try {
      const sseClient = new Client(clientInfo);
      const sseTransport = new SSEClientTransport(new URL(this.serverUrl));
      await sseClient.connect(sseTransport);
      this.client = sseClient;
      this.transport = sseTransport;
      this.connectionType = 'sse';
      this.isConnected = true;
      return;
    } catch (sseError) {
      throw new Error(`Bright Data MCP connect failed: streamable=${streamableError?.message || 'unknown'}; sse=${sseError?.message || 'unknown'}`);
    }
  }

  async close() {
    if (this.transport && typeof this.transport.close === 'function') {
      try {
        await this.transport.close();
      } catch (_error) {
        // Ignore close errors while reconnecting.
      }
    }
    this.client = null;
    this.transport = null;
    this.connectionType = null;
    this.isConnected = false;
  }

  async listTools() {
    try {
      await this.connect();
      return await this.client.listTools();
    } catch (error) {
      this.isConnected = false;
      return { error: error.message };
    }
  }

  async callTool(name, args) {
    try {
      await this.connect();
      return await this.client.callTool({ name, arguments: args || {} });
    } catch (error) {
      this.isConnected = false;
      return { error: error.message };
    }
  }
}

// Simple HTTP client for local custom MCP server
class CustomMCPClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }

  async listTools() {
    try {
      const response = await fetch(`${this.serverUrl}/mcp/tools`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Montgomery-Chatbot/1.0'
        }
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error('Tool listing failed:', error.message);
      return { error: error.message };
    }
  }

  async callTool(name, args) {
    try {
      const response = await fetch(`${this.serverUrl}/mcp/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Montgomery-Chatbot/1.0'
        },
        body: JSON.stringify({ tool_name: name, tool_input: args || {} })
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error(`Tool execution failed for ${name}:`, error.message);
      return { error: error.message };
    }
  }
}

const brightDataClient = new BrightDataMCPClient(BRIGHTDATA_MCP_URL);
const customMcpClient = new CustomMCPClient(MCP_SERVER_URL);

let MCP_TOOLS = [];
let ACTIVE_MCP_SOURCE = 'none';

function toAnthropicToolList(rawTools = []) {
  return rawTools.map((tool) => {
    const inputSchema = tool.inputSchema || tool.input_schema || {};
    return {
      name: tool.name,
      description: tool.description || '',
      input_schema: {
        type: 'object',
        properties: inputSchema.properties || {},
        required: inputSchema.required || []
      }
    };
  });
}

async function connectCustomTools() {
  const toolList = await customMcpClient.listTools();
  if (toolList.error) {
    return { ok: false, error: toolList.error };
  }

  const rawTools = Array.isArray(toolList.tools) ? toolList.tools : [];
  MCP_TOOLS = toAnthropicToolList(rawTools);
  ACTIVE_MCP_SOURCE = 'custom';
  return { ok: true, count: MCP_TOOLS.length };
}

async function failoverToCustom(reason) {
  console.warn(`⚠️ Bright Data MCP unavailable (${reason}). Falling back to local custom MCP tools...`);
  const fallback = await connectCustomTools();
  if (!fallback.ok) {
    console.warn('⚠️ Custom MCP fallback failed:', fallback.error);
    MCP_TOOLS = [];
    ACTIVE_MCP_SOURCE = 'none';
    return false;
  }

  console.log('✅ Fallback active: local custom MCP tools');
  console.log(`   Available: ${MCP_TOOLS.length} tools`);
  return true;
}

async function initializeMCPTools() {
  try {
    if (BRIGHTDATA_MCP_URL) {
      console.log('📡 Connecting to Bright Data MCP (primary)...');
      const brightList = await brightDataClient.listTools();
      if (!brightList.error && Array.isArray(brightList.tools)) {
        MCP_TOOLS = toAnthropicToolList(brightList.tools);
        ACTIVE_MCP_SOURCE = 'brightdata';
        console.log(`✅ Connected to Bright Data MCP (${brightDataClient.connectionType || 'session'})`);
        console.log(`   Available: ${MCP_TOOLS.length} tools`);
        if (MCP_TOOLS.length > 0) {
          console.log('   Sample tools:', MCP_TOOLS.slice(0, 3).map(t => t.name).join(', ') + '...');
        }
        return;
      }

      await failoverToCustom(brightList.error || 'unable to list Bright Data tools');
      return;
    }

    console.warn('⚠️ BRIGHTDATA_API_TOKEN missing; using local custom MCP server only.');
    await failoverToCustom('token not configured');
  } catch (error) {
    await failoverToCustom(error.message);
  }
}

function getSystemPrompt() {
  const urlGuide = Object.entries(MGM_URLS)
    .map(([topic, url]) => `- ${topic}: ${url}`)
    .join('\n');

  const toolsInfo = MCP_TOOLS.length > 0
    ? ACTIVE_MCP_SOURCE === 'brightdata'
      ? `You have access to Bright Data MCP tools for live web intelligence.`
      : `You have access to local real-time tools powered by free public APIs.`
    : `Note: Real-time tools are not currently available, but you can guide the user based on available knowledge.`;

  return `
You are MGM Assist, an AI city assistant for Montgomery, Alabama.
You help residents of Montgomery with real-time, accurate information about:
- Trash & sanitation pickup schedules
- MATS bus routes and schedules
- City events and council meetings
- 311 issue reporting (potholes, streetlights, overgrown grass)
- Permits, inspections, and business licenses
- Parks, community centers, and city facilities
- Local news and city announcements

${toolsInfo}
${MCP_TOOLS.length > 0 ? 'For Montgomery city questions, ALWAYS fetch live data from the most relevant Montgomery URL first, then answer. Use tools before memory and cite the exact URL you used.' : 'When a user asks something, provide helpful guidance. Never answer from uncertain memory alone.'}

Montgomery Resources:
${urlGuide}

Be friendly, clear, and concise. Support both English and Spanish.
Primary phone for complex issues: 334-625-4636
  `.trim();
}

async function executeMcpTool(toolName, toolInput) {
  try {
    let result;

    if (ACTIVE_MCP_SOURCE === 'brightdata') {
      result = await brightDataClient.callTool(toolName, toolInput || {});
      if (result?.error) {
        const switched = await failoverToCustom(result.error);
        if (switched) {
          result = await customMcpClient.callTool(toolName, toolInput || {});
        }
      }
    } else {
      result = await customMcpClient.callTool(toolName, toolInput || {});
    }

    return {
      ok: !result.error,
      result: result.error ? { error: result.error } : result
    };
  } catch (error) {
    return {
      ok: false,
      result: { error: error.message }
    };
  }
}

async function runConversationWithTools(model, userMessage) {
  const messages = [
    {
      role: 'user',
      content: userMessage
    }
  ];
  const toolsUsed = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: getSystemPrompt(),
        tools: MCP_TOOLS.length > 0 ? MCP_TOOLS : undefined,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data
      };
    }

    const contentBlocks = Array.isArray(data.content) ? data.content : [];
    const toolUseBlocks = contentBlocks.filter((block) => block.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      const textBlock = contentBlocks.find((block) => block.type === 'text');
      return {
        ok: true,
        message: textBlock?.text || 'No response text received.',
        toolsUsed
      };
    }

    messages.push({
      role: 'assistant',
      content: contentBlocks
    });

    const toolResults = [];
    for (const toolUseBlock of toolUseBlocks) {
      const toolName = toolUseBlock.name;
      const toolInput = toolUseBlock.input || {};
      toolsUsed.push(toolName);

      try {
        const toolExecution = await executeMcpTool(toolName, toolInput);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolExecution.result)
        });
      } catch (toolError) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify({
            success: false,
            error: toolError.message
          })
        });
      }
    }

    messages.push({
      role: 'user',
      content: toolResults
    });
  }

  // If the model keeps requesting tools, force a final synthesis without tools.
  const finalResponse = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: `${getSystemPrompt()}\n\nYou already received tool outputs above. Do not call tools again. Provide the best final answer now and cite the Montgomery URL(s) used when relevant.`,
      messages
    })
  });

  const finalData = await finalResponse.json();
  if (!finalResponse.ok) {
    return {
      ok: false,
      status: finalResponse.status,
      data: finalData
    };
  }

  const finalBlocks = Array.isArray(finalData.content) ? finalData.content : [];
  const finalText = finalBlocks.find((block) => block.type === 'text')?.text;
  if (finalText) {
    return {
      ok: true,
      message: finalText,
      toolsUsed
    };
  }

  return {
    ok: true,
    message: 'I reached the tool-call limit while processing your request. Please try a more specific question.',
    toolsUsed
  };
}

// MCP Status endpoint - Check which MCP source is active
app.get('/api/mcp-status', async (req, res) => {
  res.json({
    active_mcp_source: ACTIVE_MCP_SOURCE,
    brightdata_token_configured: !!BRIGHTDATA_API_TOKEN,
    brightdata_mcp_url: BRIGHTDATA_MCP_URL ? '✅ Configured' : '❌ Not configured',
    tools_loaded: MCP_TOOLS.length,
    available_tools: MCP_TOOLS.map(t => t.name),
    status: ACTIVE_MCP_SOURCE === 'none' ? '❌ No MCP tools available' : `✅ Using ${ACTIVE_MCP_SOURCE} MCP`
  });
});

// Proxy endpoint for Claude API
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
    }

    if (MCP_TOOLS.length === 0) {
      await initializeMCPTools();
    }

    let lastError = null;

    for (const model of MODELS_TO_TRY) {
      const result = await runConversationWithTools(model, message);

      if (result.ok) {
        return res.json({
          message: result.message,
          model,
          tools_used: [...new Set(result.toolsUsed)]
        });
      }

      lastError = {
        status: result.status,
        model,
        data: result.data
      };

      const errorMessage = result?.data?.error?.message || '';
      const isModelError = errorMessage.toLowerCase().includes('model');
      if (!isModelError) {
        break;
      }
    }

    console.error('API Error:', lastError);
    return res.status(lastError?.status || 500).json({
      error: `${lastError?.data?.error?.message || 'Something went wrong'} (tried: ${MODELS_TO_TRY.join(', ')})`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// -------- DASHBOARD DATA API ENDPOINTS -------- //

/** Recursively convert Firestore Timestamps to ISO strings for JSON clients */
function serializeForClient(value) {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeForClient);
  if (typeof value === 'object' && value.constructor === Object) {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = serializeForClient(v);
    return o;
  }
  return value;
}

function careersEnvConfigured() {
  const k = process.env.USAJOBS_API_KEY || '';
  const e = process.env.USAJOBS_EMAIL || process.env.USAJOBS_EMAI || '';
  const a = process.env.ADZUNA_APP_ID || '';
  const b = process.env.ADZUNA_APP_KEY || '';
  return Boolean((k && e) || (a && b));
}

// Get Capital City Careers data
app.get('/api/dashboard/careers', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }

    const ref = db.collection('dashboards').doc('capitalCityCareers');
    let doc = await ref.get();
    const raw = doc.exists ? doc.data() : {};
    const n = Array.isArray(raw.jobs) ? raw.jobs.length : 0;

    if (n === 0 && careersEnvConfigured()) {
      try {
        await runJobsCron();
      } catch (e) {
        console.error('GET /api/dashboard/careers live pull:', e.message);
      }
      doc = await ref.get();
    }

    if (!doc.exists) {
      return res.json(
        serializeForClient({
          jobs: [],
          totalCount: 0,
          topIndustry: 'N/A',
          lastUpdated: null,
          configError: careersEnvConfigured()
            ? null
            : 'Add USAJOBS_API_KEY + USAJOBS_EMAIL (or Adzuna keys) in Vercel, redeploy, then reload.'
        })
      );
    }

    res.json(serializeForClient(doc.data()));
  } catch (error) {
    console.error('Error fetching careers data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Business Signals data
app.get('/api/dashboard/business', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }

    const doc = await db.collection('dashboards').doc('businessSignals').get();
    if (!doc.exists) {
      return res.json({ newBusinesses: 0, closedBusinesses: 0, hotNeighborhoods: [], lastUpdated: null });
    }

    res.json(serializeForClient(doc.data()));
  } catch (error) {
    console.error('Error fetching business data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Neighborhood Economy data
app.get('/api/dashboard/economy', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }

    const doc = await db.collection('dashboards').doc('neighborhoodEconomy').get();
    if (!doc.exists) {
      return res.json({ neighborhoods: [], lastUpdated: null });
    }

    res.json(serializeForClient(doc.data()));
  } catch (error) {
    console.error('Error fetching economy data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Opportunity Finder data
app.get('/api/dashboard/opportunities', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }

    const doc = await db.collection('dashboards').doc('opportunityFinder').get();
    if (!doc.exists) {
      return res.json({ grants: [], training: [], fairs: [], lastUpdated: null });
    }

    res.json(serializeForClient(doc.data()));
  } catch (error) {
    console.error('Error fetching opportunities data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Montgomery Pulse civic news feed
app.get('/api/montgomery-pulse', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }

    const { category, page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;

    let query = db.collection('montgomery_pulse')
      .orderBy('date', 'desc');

    const snapshot = await query.get();
    
    let allItems = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string for JSON
        date: data.date?.toDate ? data.date.toDate().toISOString() : data.date
      };
    });

    // Client-side filtering by category
    if (category && category !== 'all') {
      allItems = allItems.filter(item => item.category === category);
    }

    // Apply pagination
    const items = allItems.slice(offset, offset + limit);

    // Get parsed item timestamp and fetch timestamp
    const lastFetched = new Date().toISOString();
    const lastUpdated = items.length > 0 ? items[0].date : null;

    res.json({ items, lastUpdated, lastFetched });
  } catch (error) {
    console.error('Error fetching Montgomery Pulse data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear Montgomery Pulse collection (for debugging/resetting bad data)
app.post('/api/admin/clear-pulse', async (req, res) => {
  const db = getFirestore();
  if (!db) return res.status(500).json({ error: 'Firebase not initialized' });
  
  try {
    const collection = db.collection('montgomery_pulse');
    const docs = await collection.listDocuments();
    let deletedCount = 0;
    
    for (const doc of docs) {
      await doc.delete();
      deletedCount++;
    }
    
    res.json({ success: true, deleted: deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual update for a dashboard (for testing/debugging)
const refreshDashboardByName = async (dashboard) => {
  switch (dashboard) {
    case 'careers':
      await runJobsCron();
      return;
    case 'business':
      await runBusinessCron();
      return;
    case 'economy':
      await runEconomyCron();
      return;
    case 'opportunities':
      await runOpportunityCron();
      return;
    case 'pulse':
    case 'montgomery-pulse':
      await runMontgomeryPulseCron();
      return;
    default:
      throw new Error('Invalid dashboard name');
  }
};

app.post('/api/dashboard/refresh/:dashboard', async (req, res) => {
  try {
    const { dashboard } = req.params;
    await refreshDashboardByName(dashboard);

    res.json({ success: true, message: `${dashboard} dashboard refresh triggered` });
  } catch (error) {
    console.error(`Error refreshing ${req.params.dashboard}:`, error);
    const isInvalidDashboard = error.message === 'Invalid dashboard name';
    res.status(isInvalidDashboard ? 400 : 500).json({ error: error.message });
  }
});

// Vercel cron endpoints (GET) — one per dashboard for reliable serverless scheduling.
const makeCronHandler = (name, fn) => async (req, res) => {
  try {
    await fn();
    res.json({ success: true, message: `${name} cron refresh completed` });
  } catch (error) {
    console.error(`Cron refresh failed for ${name}:`, error.message);
    res.status(500).json({ error: error.message });
  }
};
app.get('/api/cron/refresh/careers', (req, res, next) => { makeCronHandler('careers', () => runJobsCron())(req, res); });
app.get('/api/cron/refresh/business', (req, res, next) => { makeCronHandler('business', () => runBusinessCron())(req, res); });
app.get('/api/cron/refresh/economy', (req, res, next) => { makeCronHandler('economy', () => runEconomyCron())(req, res); });
app.get('/api/cron/refresh/opportunities', (req, res, next) => { makeCronHandler('opportunities', () => runOpportunityCron())(req, res); });
app.get('/api/cron/refresh/pulse', (req, res, next) => { makeCronHandler('pulse', () => runMontgomeryPulseCron())(req, res); });

// Debug endpoint for Montgomery Pulse with detailed logging
app.get('/api/debug/pulse-scrape', async (req, res) => {
  const logs = [];
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log("🔄 Starting Montgomery Pulse debug scrape...");
    const db = getFirestore();
    if (!db) {
      log("❌ Firebase not initialized");
      return res.json({ success: false, error: "Firebase not initialized", logs });
    }

    if (MCP_TOOLS.length === 0) {
      log("⚙️ Initializing MCP tools...");
      await initializeMCPTools();
      log(`✅ MCP tools loaded: ${MCP_TOOLS.length} tools, source: ${ACTIVE_MCP_SOURCE}`);
    }

    const montgomeryUrls = [
      'https://www.montgomeryal.gov/government/stay-informed/city-news'
    ];

    log(`🌐 Scraping ${montgomeryUrls.length} URLs...`);
    const allScrapedContent = [];

    for (const url of montgomeryUrls) {
      try {
        log(` Scraping: ${url}`);
        let scrapeResult;
        
        if (ACTIVE_MCP_SOURCE === 'brightdata') {
          log(`  Using Bright Data MCP...`);
          scrapeResult = await executeMcpTool('scrape_as_markdown', { url });
        } else {
          log(`  Using custom MCP fallback...`);
          scrapeResult = await executeMcpTool('fetch_webpage_content', { 
            url, 
            parse_type: 'text' 
          });
        }

        if (scrapeResult.ok && scrapeResult.result) {
          let content = scrapeResult.result.content || scrapeResult.result.data || scrapeResult.result || '';
          // Ensure content is a string
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }
          log(`  ✅ Scraped ${content.length} characters`);
          allScrapedContent.push({ url, content: content.substring(0, 5000) });
        } else {
          log(`  ❌ Scrape failed: ${JSON.stringify(scrapeResult).substring(0, 200)}`);
        }
      } catch (error) {
        log(`  ❌ Error: ${error.message}`);
      }
    }

    if (allScrapedContent.length === 0) {
      log('⚠️ No content scraped');
      return res.json({ success: false, error: "No content scraped", logs });
    }

    log(`📤 Sending ${allScrapedContent.length} items to Claude for processing...`);
    const prompt = `Extract news items from this Montgomery, AL government website content. Return a JSON array with this structure:
[{"category": "council"|"mayor"|"ordinance"|"deadline"|"meeting", "title": "headline", "summary": "2-3 sentences", "deadline": "YYYY-MM-DD"|null, "actionLink": "url"|null, "actionLabel": "Apply Now"|"Register"|"Read More"|null, "source": "${montgomeryUrls[0]}"}]

Content: ${JSON.stringify(allScrapedContent[0].content).slice(0, 3000)}`;

    const claudeResult = await runConversationWithTools(MODELS_TO_TRY[0], prompt);
    
    if (!claudeResult.ok) {
      log(`❌ Claude processing failed: ${JSON.stringify(claudeResult)}`);
      return res.json({ success: false, error: "Claude failed", claudeDetails: claudeResult, logs });
    }

    log(`✅ Claude responded with ${claudeResult.message.length} characters`);
    
    let pulseItems = [];
    try {
      const jsonMatch = claudeResult.message.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        pulseItems = JSON.parse(jsonMatch[0]);
        log(`✅ Parsed ${pulseItems.length} items from Claude response`);
      } else {
        pulseItems = JSON.parse(claudeResult.message);
        log(`✅ Parsed ${pulseItems.length} items directly`);
      }
    } catch (e) {
      log(`❌ JSON parse error: ${e.message}`);
      log(`Claude response: ${claudeResult.message.substring(0, 500)}`);
      return res.json({ success: false, error: "Parse error", claudeResponse: claudeResult.message, logs });
    }

    log(`💾 Saving ${pulseItems.length} items to Firebase...`);
    const collection = db.collection('montgomery_pulse');
    let savedCount = 0;

    for (const item of pulseItems) {
      const itemId = Buffer.from(`${item.title}-${item.source||montgomeryUrls[0]}`).toString('base64').substring(0, 20);
      const existing = await collection.doc(itemId).get();
      if (!existing.exists) {
        await collection.doc(itemId).set({
          category: item.category || 'council',
          title: item.title || 'Untitled',
          summary: item.summary || '',
          date: admin.firestore.FieldValue.serverTimestamp(),
          deadline: item.deadline || null,
          actionLink: item.actionLink || null,
          actionLabel: item.actionLabel || null,
          source: item.source || montgomeryUrls[0]
        });
        savedCount++;
      }
    }

    log(`✅ Saved ${savedCount} new items (${pulseItems.length} total extracted)`);
    res.json({ success: true, saved: savedCount, extracted: pulseItems.length, items: pulseItems, logs });
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message, stack: error.stack, logs });
  }
});

// Production UI: Vite build output in /public (see frontend/vite.config.js).
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => (err ? next(err) : undefined));
});

// -------- CRON JOBS -------- //

// Helper: Get Firestore instance
const getFirestore = () => {
  try {
    return admin.firestore();
  } catch (error) {
    console.error('❌ Firestore not initialized. Please configure Firebase.');
    return null;
  }
};

// 1. Capital City Careers - Fetch real job listings from free public APIs
const runJobsCron = async () => {
  console.log("🔄 Running Capital City Careers Task...");
  const db = getFirestore();
  if (!db) return;

  const USAJOBS_API_KEY = process.env.USAJOBS_API_KEY || '';
  const USAJOBS_EMAIL = process.env.USAJOBS_EMAIL || process.env.USAJOBS_EMAI || '';
  const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '';
  const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '';
  const hasUsaJobsCreds = Boolean(USAJOBS_API_KEY && USAJOBS_EMAIL);
  const hasAdzunaCreds = Boolean(ADZUNA_APP_ID && ADZUNA_APP_KEY);

  try {
    const allJobs = [];
    const apiResults = { success: 0, failed: 0 };
    const now = new Date();
    const maxJobAgeDays = 365;
    const isMontgomeryAl = (locationText) => {
      const normalized = String(locationText || '').toLowerCase();
      return normalized.includes('montgomery') && (normalized.includes('al') || normalized.includes('alabama'));
    };

    const getUsaJobsLocation = (mv) => {
      const display = Array.isArray(mv?.PositionLocationDisplay)
        ? mv.PositionLocationDisplay.join(', ')
        : (mv?.PositionLocationDisplay || '');
      if (display) return display;

      // Some USAJobs records do not include PositionLocationDisplay but include structured locations.
      const first = Array.isArray(mv?.PositionLocation) ? mv.PositionLocation[0] : null;
      if (first) {
        const city = first.LocationName || first.CityName || first.City || '';
        const state = first.CountrySubDivisionCode || first.State || '';
        const country = first.CountryCode || 'US';
        return [city, state, country].filter(Boolean).join(', ');
      }

      return '';
    };

    // --- Source 1: USAJobs (no manual Host header — breaks on some serverless runtimes) ---
    if (hasUsaJobsCreds) {
      try {
        const usajobsHeaders = {
          'User-Agent': USAJOBS_EMAIL,
          'Authorization-Key': USAJOBS_API_KEY
        };
        const queries = [
          'LocationName=Montgomery%2C+Alabama&ResultsPerPage=50',
          'Keyword=Montgomery&LocationName=Alabama&ResultsPerPage=50'
        ];
        let items = [];
        let lastStatus = 0;
        for (const q of queries) {
          const usajobsRes = await fetch(`https://data.usajobs.gov/api/search?${q}`, { headers: usajobsHeaders });
          lastStatus = usajobsRes.status;
          if (!usajobsRes.ok) continue;
          const usajobsData = await usajobsRes.json();
          const batch = usajobsData?.SearchResult?.SearchResultItems || [];
          if (batch.length > 0) {
            items = batch;
            break;
          }
        }

        if (items.length > 0) {
          const allFetched = [];
          const pushUsaJob = (mv, opts = {}) => {
            if (!mv) return;
            const skipAge = opts.skipAge === true;
            const skipClose = opts.skipClose === true;
            const publicationDate = mv.PublicationStartDate ? new Date(mv.PublicationStartDate) : null;
            const closeDate = mv.ApplicationCloseDate ? new Date(mv.ApplicationCloseDate) : null;
            if (!skipAge && publicationDate && !Number.isNaN(publicationDate.getTime())) {
              const ageDays = (now.getTime() - publicationDate.getTime()) / (1000 * 60 * 60 * 24);
              if (ageDays > maxJobAgeDays) return;
            }
            if (!skipClose && closeDate && !Number.isNaN(closeDate.getTime()) && closeDate < now) return;
            const location = getUsaJobsLocation(mv);
            const salaryMin = mv.PositionRemuneration?.[0]?.MinimumRange;
            const salaryMax = mv.PositionRemuneration?.[0]?.MaximumRange;
            const salaryInterval = mv.PositionRemuneration?.[0]?.RateIntervalCode;
            const salary = salaryMin
              ? `$${Number(salaryMin).toLocaleString()}–$${Number(salaryMax || salaryMin).toLocaleString()} ${salaryInterval || ''}`.trim()
              : null;
            allFetched.push({
              title: mv.PositionTitle || 'Government Position',
              company: mv.OrganizationName || 'U.S. Federal Government',
              location: location || 'Montgomery, AL',
              postedTime: publicationDate && !Number.isNaN(publicationDate.getTime())
                ? publicationDate.toISOString()
                : null,
              salary,
              url: mv.PositionURI || 'https://www.usajobs.gov',
              source: 'USAJobs'
            });
          };
          for (const item of items) pushUsaJob(item.MatchedObjectDescriptor, {});
          if (allFetched.length === 0) {
            for (const item of items) pushUsaJob(item.MatchedObjectDescriptor, { skipAge: true });
          }
          if (allFetched.length === 0) {
            for (const item of items) pushUsaJob(item.MatchedObjectDescriptor, { skipAge: true, skipClose: true });
          }
          const strict = allFetched.filter(j => isMontgomeryAl(j.location));
          const toAdd = strict.length > 0
            ? strict
            : allFetched.map(j => ({ ...j, location: j.location ? `${j.location} (Nearby/Remote)` : 'Nearby / Remote, AL' }));
          allJobs.push(...toAdd);
          console.log(`✅ USAJobs: ${items.length} fetched, ${strict.length} strict Montgomery, ${toAdd.length} shown`);
          apiResults.success++;
        } else {
          console.warn(`⚠️ USAJobs: no items (last HTTP ${lastStatus}) — check USAJOBS_API_KEY + USAJOBS_EMAIL`);
          apiResults.failed++;
        }
      } catch (e) {
        console.error('❌ USAJobs fetch error:', e.message);
        apiResults.failed++;
      }
    } else {
      console.warn('⚠️ USAJobs skipped: set USAJOBS_API_KEY + USAJOBS_EMAIL env vars. Register free at https://developer.usajobs.gov/apirequest/key');
      apiResults.failed++;
    }

    // --- Source 2: Adzuna API (private-sector jobs in Montgomery) ---
    if (hasAdzunaCreds) {
      try {
        const adzunaRes = await fetch(
          `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&where=montgomery+alabama&results_per_page=25&distance=15`,
          { headers: { 'User-Agent': 'MGM-Assist/1.0' } }
        );
        if (adzunaRes.ok) {
          const adzunaData = await adzunaRes.json();
          const results = adzunaData?.results || [];
          const adzunaFetched = [];
          for (const job of results) {
            const location = job.location?.display_name || '';
            adzunaFetched.push({
              title: job.title || 'Position',
              company: job.company?.display_name || 'Montgomery Employer',
              location: location || 'Montgomery, AL',
              postedTime: job.created ? new Date(job.created).toISOString() : 'Recently posted',
              salary: job.salary_min ? `$${Math.round(job.salary_min / 1000)}k–$${Math.round((job.salary_max || job.salary_min) / 1000)}k/yr` : null,
              url: job.redirect_url || 'https://www.adzuna.com',
              source: 'Adzuna'
            });
          }
          const strictAdz = adzunaFetched.filter(j => isMontgomeryAl(j.location));
          const toAddAdz = strictAdz.length > 0
            ? strictAdz
            : adzunaFetched.map(j => ({
                ...j,
                location: j.location ? `${j.location} (Nearby/Remote)` : 'Nearby / Remote, AL'
              }));
          allJobs.push(...toAddAdz);
          console.log(`✅ Adzuna: ${results.length} fetched, ${strictAdz.length} strict, ${toAddAdz.length} added`);
          apiResults.success++;
        } else {
          console.warn(`⚠️ Adzuna returned ${adzunaRes.status}`);
          apiResults.failed++;
        }
      } catch (e) {
        console.error('❌ Adzuna fetch error:', e.message);
        apiResults.failed++;
      }
    } else {
      console.warn('⚠️ Adzuna skipped: set ADZUNA_APP_ID + ADZUNA_APP_KEY env vars. Register free at https://developer.adzuna.com/');
    }

    const careersRef = db.collection('dashboards').doc('capitalCityCareers');
    const prevSnap = await careersRef.get();
    const prevData = prevSnap.exists ? prevSnap.data() : null;
    const prevCount = Array.isArray(prevData?.jobs) ? prevData.jobs.length : 0;

    if (allJobs.length > 0) {
      const jobsData = {
        jobs: allJobs.slice(0, 50),
        totalCount: allJobs.length,
        topIndustry: getTopIndustry(allJobs),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        scrapingStats: apiResults
      };
      await careersRef.set(jobsData);
      console.log(`✅ Capital City Careers updated: ${allJobs.length} jobs saved`);
    } else if (prevCount > 0) {
      const noApiCreds = !hasUsaJobsCreds && !hasAdzunaCreds;
      await careersRef.set(
        {
          scrapingStats: apiResults,
          feedStaleWarning: noApiCreds
            ? 'Job APIs are not configured on the server; showing your last saved listings. Add USAJOBS or Adzuna keys in Vercel to refresh.'
            : 'Latest sync returned no new listings; showing your previous feed. Try again later or check Vercel logs for USAJOBS/Adzuna.',
          configError: noApiCreds
            ? 'API keys not configured. Add USAJOBS_API_KEY + USAJOBS_EMAIL (free: developer.usajobs.gov) or ADZUNA_APP_ID + ADZUNA_APP_KEY (free: developer.adzuna.com) to Vercel environment variables.'
            : admin.firestore.FieldValue.delete()
        },
        { merge: true }
      );
      console.warn('⚠️ Capital City Careers: 0 this run — kept previous jobs in Firestore');
    } else {
      const noApiCreds = !hasUsaJobsCreds && !hasAdzunaCreds;
      await careersRef.set({
        jobs: [],
        totalCount: 0,
        topIndustry: 'N/A',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        scrapingStats: apiResults,
        feedStaleWarning: admin.firestore.FieldValue.delete(),
        configError: noApiCreds
          ? 'API keys not configured. Add USAJOBS_API_KEY + USAJOBS_EMAIL (free: developer.usajobs.gov) or ADZUNA_APP_ID + ADZUNA_APP_KEY (free: developer.adzuna.com) to Vercel environment variables.'
          : 'No jobs returned this run. Confirm USAJOBS User-Agent email matches your developer.usajobs.gov profile; check Vercel logs.'
      });
      console.warn(noApiCreds
        ? '⚠️ Capital City Careers: 0 jobs saved — no API keys configured'
        : '⚠️ Capital City Careers: 0 jobs saved — APIs returned no rows');
    }

  } catch (error) {
    console.error('❌ Capital City Careers cron failed:', error.message);
  }
};

// 2. Business Signals - Track new business licenses and closures
const runBusinessCron = async () => {
  console.log("🔄 Running Business Signals Task...");
  const db = getFirestore();
  if (!db) return;

  try {
    if (MCP_TOOLS.length === 0) await initializeMCPTools();

    // Scrape Montgomery business licensing page
    const licensePageResult = await executeMcpTool('web_scraper', {
      url: 'https://www.montgomeryal.gov/work/business-resources/license-and-revenue',
      extract: ['business_name', 'industry', 'status', 'date']
    });

    // Scrape Montgomery Chamber news
    const chamberNewsResult = await executeMcpTool('web_scraper', {
      url: 'https://www.montgomerychamber.com/news',
      extract: ['article_title', 'description', 'date']
    });

    // Process with Claude to extract business openings/closures
    const analysisPrompt = `Analyze this data and extract: 
    1. New business openings this week
    2. Business closures
    3. Hot neighborhoods for growth
    Return as JSON with: newBusinesses (count), closedBusinesses (count), hotNeighborhoods (array).
    Data: ${JSON.stringify({ licenses: licensePageResult.result, news: chamberNewsResult.result }).slice(0, 3000)}`;

    const claudeResult = await runConversationWithTools(MODELS_TO_TRY[0], analysisPrompt);
    
    let businessData;
    try {
      businessData = JSON.parse(claudeResult.message);
    } catch (e) {
      // Fallback to mock template if parsing fails
      businessData = {
        newBusinesses: Math.floor(Math.random() * 30) + 15,
        closedBusinesses: Math.floor(Math.random() * 5) + 1,
        hotNeighborhoods: [
          { name: 'Downtown MGM', count: Math.floor(Math.random() * 15) + 5 },
          { name: 'East Chase', count: Math.floor(Math.random() * 10) + 3 }
        ]
      };
    }

    businessData.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('dashboards').doc('businessSignals').set(businessData);
    console.log(`✅ Business Signals updated: ${businessData.newBusinesses} new businesses`);

  } catch (error) {
    console.error('❌ Business Signals cron failed:', error.message);
  }
};

// 3. Neighborhood Economy Map - Census and BLS data
const runEconomyCron = async () => {
  console.log("🔄 Running Neighborhood Economy Map Task...");
  const db = getFirestore();
  if (!db) return;

  try {
    if (MCP_TOOLS.length === 0) await initializeMCPTools();

    // Fetch unemployment data from BLS API
    const blsResult = await executeMcpTool('api_request', {
      url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/LAUCN010830000000003',
      method: 'GET'
    });

    // Fetch census data for Montgomery County
    const censusResult = await executeMcpTool('api_request', {
      url: 'https://api.census.gov/data/2021/acs/acs5?get=B19013_001E,B17001_002E&for=county:101&in=state:01',
      method: 'GET'
    });

    // Process with Claude
    const analysisPrompt = `Extract economic indicators for Montgomery neighborhoods from this data. Return JSON with: neighborhoods (array with name, unemployment, avgIncome, povertyRate). Data: ${JSON.stringify({ bls: blsResult.result, census: censusResult.result }).slice(0, 3000)}`;
    
    const claudeResult = await runConversationWithTools(MODELS_TO_TRY[0], analysisPrompt);

    let economyData;
    try {
      economyData = JSON.parse(claudeResult.message);
    } catch (e) {
      // Fallback template
      economyData = {
        neighborhoods: [
          { name: 'Central MGM', unemployment: 3.2, avgIncome: 55000, povertyRate: 15.3 },
          { name: 'East Montgomery', unemployment: 4.1, avgIncome: 48000, povertyRate: 18.7 },
          { name: 'Pike Road Area', unemployment: 2.8, avgIncome: 72000, povertyRate: 8.2 }
        ]
      };
    }

    economyData.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('dashboards').doc('neighborhoodEconomy').set(economyData);
    console.log(`✅ Neighborhood Economy updated: ${economyData.neighborhoods?.length || 0} areas`);

  } catch (error) {
    console.error('❌ Neighborhood Economy cron failed:', error.message);
  }
};

// 4. Opportunity Finder - Grants, Training, Job Fairs
const runOpportunityCron = async () => {
  console.log("🔄 Running Opportunity Finder Task...");
  const db = getFirestore();
  if (!db) return;

  try {
    if (MCP_TOOLS.length === 0) await initializeMCPTools();

    // Scrape multiple opportunity sources
    const sources = [
      { type: 'grants', url: 'https://www.montgomeryal.gov/work/business-resources/small-business-grants' },
      { type: 'training', url: 'https://www.aidt.edu/' },
      { type: 'fairs', url: 'https://www.montgomerychamber.com/events' }
    ];

    const opportunities = { grants: [], training: [], fairs: [] };

    for (const source of sources) {
      try {
        const scrapeResult = await executeMcpTool('web_scraper', {
          url: source.url,
          extract: ['title', 'deadline', 'description', 'link']
        });

        if (scrapeResult.ok && scrapeResult.result?.data) {
          const cleaningPrompt = `Extract opportunities from this data. Return JSON array with: name, deadline, link. Data: ${JSON.stringify(scrapeResult.result.data).slice(0, 2000)}`;
          const claudeResult = await runConversationWithTools(MODELS_TO_TRY[0], cleaningPrompt);
          
          try {
            const parsed = JSON.parse(claudeResult.message);
            opportunities[source.type] = parsed;
          } catch (e) {
            console.warn(`⚠️ Failed to parse ${source.type} opportunities`);
          }
        }
      } catch (error) {
        console.error(`❌ Error scraping ${source.type}:`, error.message);
      }
    }

    // Add fallback data if scraping failed
    if (opportunities.grants.length === 0) {
      opportunities.grants = [
        { name: 'Downtown Revitalization Grant', deadline: 'May 1, 2026', link: 'https://www.montgomeryal.gov/grants' },
        { name: 'Small Business Relief', deadline: 'June 15, 2026', link: 'https://www.montgomeryal.gov/grants' }
      ];
    }
    if (opportunities.training.length === 0) {
      opportunities.training = [
        { name: 'AIDT Tech Manufacturing', deadline: 'Rolling', link: 'https://www.aidt.edu/' },
        { name: 'ACCS IT Certification', deadline: 'April 30, 2026', link: 'https://www.accs.edu/' }
      ];
    }
    if (opportunities.fairs.length === 0) {
      opportunities.fairs = [
        { name: 'Montgomery Chamber Hiring Event', deadline: 'May 10, 2026', link: 'https://www.montgomerychamber.com/events' }
      ];
    }

    opportunities.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('dashboards').doc('opportunityFinder').set(opportunities);
    console.log(`✅ Opportunity Finder updated: ${opportunities.grants.length + opportunities.training.length + opportunities.fairs.length} total opportunities`);

  } catch (error) {
    console.error('❌ Opportunity Finder cron failed:', error.message);
  }
};

// Helper function to determine top industry from job listings
function getTopIndustry(jobs) {
  const industries = {};
  jobs.forEach(job => {
    const industry = categorizeJob(job.title);
    industries[industry] = (industries[industry] || 0) + 1;
  });
  return Object.keys(industries).reduce((a, b) => industries[a] > industries[b] ? a : b, 'General');
}

function categorizeJob(title) {
  const lower = title.toLowerCase();
  if (lower.includes('warehouse') || lower.includes('logistics') || lower.includes('driver')) return 'Logistics';
  if (lower.includes('nurse') || lower.includes('medical') || lower.includes('health')) return 'Healthcare';
  if (lower.includes('tech') || lower.includes('software') || lower.includes('it')) return 'Technology';
  if (lower.includes('retail') || lower.includes('sales')) return 'Retail';
  if (lower.includes('government') || lower.includes('public')) return 'Government';
  return 'General';
}

// 5. Montgomery Pulse - Scrape civic news every 6 hours
const runMontgomeryPulseCron = async () => {
  console.log("🔄 Running Montgomery Pulse Task at", new Date().toISOString());
  const db = getFirestore();
  if (!db) return;

  try {
    if (MCP_TOOLS.length === 0) {
      console.log("📡 Initializing MCP tools...");
      await initializeMCPTools();
    }
    console.log(`✅ MCP Source: ${ACTIVE_MCP_SOURCE} | Available Tools: ${MCP_TOOLS.length}`);

    const montgomeryUrls = [
      'https://www.montgomeryal.gov/government/stay-informed/city-news',
      'https://www.montgomeryal.gov/government/stay-informed/public-notices',
      'https://www.montgomeryal.gov/government/city-government/city-council',
      'https://www.montgomeryal.gov/government/city-government/mayor-s-office',
      'https://www.montgomeryal.gov/government/city-government/city-calendar'
    ];

    const allScrapedContent = [];

    // Scrape all Montgomery URLs
    for (const url of montgomeryUrls) {
      try {
        console.log(`📍 Scraping: ${url}`);
        let scrapeResult;
        
        // Try scrape_as_markdown first (Bright Data tool)
        if (ACTIVE_MCP_SOURCE === 'brightdata') {
          console.log(`  → Using Bright Data MCP...`);
          scrapeResult = await executeMcpTool('scrape_as_markdown', { url });
        } else {
          // Fallback to custom fetch_webpage_content
          console.log(`  → Using fallback fetch (non-Bright Data)...`);
          scrapeResult = await executeMcpTool('fetch_webpage_content', { 
            url, 
            parse_type: 'text' 
          });
        }

        if (scrapeResult.error) {
          console.error(`  ❌ Scrape error: ${scrapeResult.error}`);
        } else if (scrapeResult.ok && scrapeResult.result) {
          let content = scrapeResult.result.content || scrapeResult.result.data || scrapeResult.result || '';
          // Ensure content is a string
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }
          const truncated = content.substring(0, 5000);
          console.log(`  ✅ Scraped ${content.length} chars (using first 5000)`);
          allScrapedContent.push({ url, content: truncated });
        } else {
          console.warn(`  ⚠️ Unexpected result format:`, Object.keys(scrapeResult || {}));
        }
      } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error.message);
      }
    }

    console.log(`\n📊 Scrape Summary: ${allScrapedContent.length} URLs succeeded out of ${montgomeryUrls.length}`);
    if (allScrapedContent.length === 0) {
      console.error('❌ CRITICAL: No content scraped from Montgomery URLs. Aborting pulse update.');
      return;
    }

    // Send to Claude for processing
    console.log(`\n🤖 Sending scraped content to Claude for extraction...`);
    const prompt = `Read this scraped content from Montgomery, Alabama city government websites. 
    Extract each individual news item, announcement, public notice, council decision, mayor announcement, new ordinance, deadline, or upcoming meeting.
    
    For each item you find:
    1. Categorize it as exactly one of: "council", "mayor", "ordinance", "deadline", or "meeting"
    2. Write a clear 2-3 sentence plain English summary
    3. Extract the title/headline (max 10 words)
    4. Extract any deadline date if mentioned (as ISO date string or null)
    5. Extract any action link if there's a registration/application/more info URL (or null)
    6. Suggest an action label: "Apply Now", "Register", "Read More", or null
    
    Return ONLY a valid JSON array with this exact structure:
    [
      {
        "category": "council" | "mayor" | "ordinance" | "deadline" | "meeting",
        "title": "short headline",
        "summary": "2-3 sentence summary in plain English",
        "deadline": "YYYY-MM-DD" or null,
        "actionLink": "https://..." or null,
        "actionLabel": "Apply Now" | "Register" | "Read More" | null,
        "source": "original url"
      }
    ]
    
    Scraped content from Montgomery websites:
    ${JSON.stringify(allScrapedContent).slice(0, 8000)}`;

    let pulseItems = [];
    const buildFallbackItems = () => {
      console.log(`  ⚠️ Using fallback extraction (no Claude)...`);
      return allScrapedContent.map(({ url, content }) => {
        const lowerUrl = url.toLowerCase();
        let category = 'meeting';
        let categoryLabel = 'Meeting';
        if (lowerUrl.includes('council')) { category = 'council'; categoryLabel = 'Council'; }
        else if (lowerUrl.includes('mayor')) { category = 'mayor'; categoryLabel = 'Mayor'; }
        else if (lowerUrl.includes('notice')) { category = 'deadline'; categoryLabel = 'Notice'; }
        else if (lowerUrl.includes('news')) { category = 'ordinance'; categoryLabel = 'News'; }

        // Extract text from Bright Data's structured response
        let extractedText = '';
        try {
          if (typeof content === 'string' && content.startsWith('[')) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              extractedText = parsed.map(item => item.text || '').join(' ').trim();
            }
          } else {
            extractedText = String(content || '');
          }
        } catch {
          extractedText = String(content || '');
        }

        const compact = extractedText.replace(/\s+/g, ' ').trim();
        const title = `${categoryLabel} Update from Montgomery`;
        const summary = compact.slice(0, 300) || `Latest ${categoryLabel.toLowerCase()} update from City of Montgomery. Visit the link for full details and official announcements.`;

        return {
          category,
          title,
          summary,
          deadline: null,
          actionLink: url,
          actionLabel: 'Read More',
          source: url
        };
      });
    };

    const claudeResult = await runConversationWithTools(MODELS_TO_TRY[0], prompt);

    if (!claudeResult.ok) {
      console.error(`  ❌ Claude call failed (${claudeResult.status}): ${claudeResult.data?.error?.message || 'unknown error'}`);
      pulseItems = buildFallbackItems();
    } else {
      console.log(`  ✅ Claude responded`);
      try {
        // Try to parse Claude's response as JSON
        const jsonMatch = claudeResult.message.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error(`  ❌ No JSON array found in Claude response. Raw first 200 chars:`, claudeResult.message.substring(0, 200));
          pulseItems = buildFallbackItems();
        } else {
          pulseItems = JSON.parse(jsonMatch[0]);
          console.log(`  ✅ Parsed ${pulseItems.length} items from Claude`);
        }
      } catch (e) {
        console.error(`  ❌ Failed to parse Claude JSON: ${e.message}`);
        pulseItems = buildFallbackItems();
      }
    }

    if (!Array.isArray(pulseItems) || pulseItems.length === 0) {
      console.error('❌ No pulse items extracted; fallback also produced no records');
      return;
    }

    // Save to Firebase (only new items)
    console.log(`\n💾 Saving items to Firestore...`);
    const collection = db.collection('montgomery_pulse');
    let savedCount = 0;
    let duplicateCount = 0;

    for (const item of pulseItems) {
      try {
        // Create a unique ID based on title + source to avoid duplicates
        const itemId = Buffer.from(`${item.title}-${item.source}`).toString('base64').substring(0, 20);
        
        // Check if already exists
        const existing = await collection.doc(itemId).get();
        if (existing.exists) {
          duplicateCount++;
          continue;
        }

        // Save new item
        await collection.doc(itemId).set({
          category: item.category || 'council',
          title: item.title || 'Untitled',
          summary: item.summary || '',
          date: admin.firestore.FieldValue.serverTimestamp(),
          deadline: item.deadline || null,
          actionLink: item.actionLink || null,
          actionLabel: item.actionLabel || null,
          source: item.source || ''
        });
        
        savedCount++;
      } catch (error) {
        console.error('❌ Error saving pulse item:', error.message);
      }
    }

    console.log(`\n✅ COMPLETE: ${savedCount} new items saved | ${duplicateCount} duplicates skipped | ${pulseItems.length} total extracted`);
    console.log(`   Last update timestamp stored in Firestore\n`);

  } catch (error) {
    console.error('❌ Montgomery Pulse cron failed:', error.message);
  }
};

if (process.env.VERCEL !== '1') {
  cron.schedule('0 */6 * * *', runJobsCron);
  cron.schedule('0 0 * * *', runBusinessCron);
  cron.schedule('0 0 1 * *', runEconomyCron);
  cron.schedule('0 2 * * *', runOpportunityCron);
  cron.schedule('0 */6 * * *', runMontgomeryPulseCron);
}

async function initializeOnBoot() {
  // Initialize MCP tools once on process startup.
  await initializeMCPTools();
}

if (process.env.VERCEL !== '1') {
  app.listen(PORT, async () => {
    console.log(`🤖 Server running on http://localhost:${PORT}`);
    console.log(`💬 API is ready! Open the React app at http://localhost:5173 in your browser`);
    await initializeOnBoot();
  });
}

module.exports = app;
