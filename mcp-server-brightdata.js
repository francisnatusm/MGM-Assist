/**
 * Comprehensive Bright Data MCP Server
 * Provides intelligent real-time data fetching for Claude
 * Claude will use this to answer ANY question with real-time data
 */

const express = require('express');
const fetch = require('node-fetch');

const app = express();
const MCP_PORT = 3001;

app.use(express.json());

/**
 * Get current date and time
 */
async function getCurrentDateTime() {
  try {
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
    const data = await response.json();
    const date = new Date(data.datetime);
    return {
      success: true,
      current_date: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      current_time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }),
      iso_datetime: date.toISOString(),
      unix_timestamp: Math.floor(date.getTime() / 1000)
    };
  } catch (error) {
    const now = new Date();
    return {
      success: true,
      current_date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      current_time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      note: 'Using local system time'
    };
  }
}

/**
 * Fetch content from any URL with smart parsing
 */
async function fetchWebContent(url, parseType = 'smart') {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        url: url
      };
    }

    const contentType = response.headers.get('content-type') || '';
    let content;

    if (contentType.includes('application/json')) {
      content = await response.json();
    } else if (contentType.includes('text/html')) {
      let html = await response.text();
      
      if (parseType === 'full') {
        // Return full HTML
        content = html;
      } else if (parseType === 'text') {
        // Extract text content only
        content = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/\n\s*\n/g, '\n')
          .trim()
          .substring(0, 3000);
      } else {
        // Smart parsing - extract meaningful content
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        
        // Try to get main content
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const mainContent = bodyMatch ? bodyMatch[1] : html;
        
        content = mainContent
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 2000);
      }
    } else {
      content = await response.text();
      content = content.substring(0, 2000);
    }

    return {
      success: true,
      content: content,
      url: url,
      content_type: contentType,
      status_code: response.status,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
}

/**
 * Search for information across multiple sources
 */
async function searchWebInformation(query) {
  try {
    // Try DuckDuckGo API (no key required)
    const ddgResponse = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    const ddgData = await ddgResponse.json();
    
    // Extract useful information from DuckDuckGo
    const results = {
      success: true,
      query: query,
      results: [],
      abstract: ddgData.Abstract || '',
      source: 'DuckDuckGo'
    };

    if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
      results.results = ddgData.RelatedTopics.slice(0, 5).map(topic => ({
        title: topic.Text || topic.FirstURL || '',
        url: topic.FirstURL || '',
        snippet: topic.Text || ''
      }));
    }

    if (ddgData.Results && ddgData.Results.length > 0) {
      results.results = ddgData.Results.slice(0, 5).map(result => ({
        title: result.Text || '',
        url: result.FirstURL || ''
      }));
    }

    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

/**
 * Get real-time stock/crypto prices (using free APIs)
 */
async function getRealtimePrices(search_term) {
  try {
    // Try to fetch from CoinGecko for crypto prices
    if (search_term.toLowerCase().includes('bitcoin') || search_term.toLowerCase().includes('crypto')) {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=usd&include_market_cap=true&include_24hr_change=true');
      const data = await response.json();
      return {
        success: true,
        prices: data,
        source: 'CoinGecko',
        fetched_at: new Date().toISOString()
      };
    }

    // For other searches, use web search
    return await searchWebInformation(search_term);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * MCP Tool Definition for Claude
 * Complete set of tools for real-time information retrieval
 */
const MCP_TOOLS = [
  {
    name: 'get_current_datetime',
    description: 'Get the current date and time. Use this for questions about "today", "current time", "what time is it", etc.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'fetch_webpage_content',
    description: 'Fetch and read the complete content from any website URL. Perfect for getting current information from specific websites, latest news, product pages, documentation, etc. Use this when user asks about a specific website or URL.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The website URL to fetch content from (include https://)'
        },
        parse_type: {
          type: 'string',
          enum: ['smart', 'text', 'full'],
          description: 'How to parse: smart=extract main content, text=text only, full=all HTML'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'search_web_information',
    description: 'Search the web for information about any topic. Use this when user asks about current events, news, general information, or you need real-time data about something unknown.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (e.g., "latest news about Tesla", "Bitcoin price today", "how to...")'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_realtime_prices',
    description: 'Get real-time prices for cryptocurrencies, stocks, or other commodities. Use this for price queries about Bitcoin, Ethereum, gold prices, etc.',
    input_schema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'What price to look up (e.g., "Bitcoin price", "Ethereum", "gold price")'
        }
      },
      required: ['search_term']
    }
  }
];

/**
 * MCP Endpoint: Get available tools
 * Claude calls this to discover what tools are available
 */
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: MCP_TOOLS,
    mcp_version: '1.0.0'
  });
});

/**
 * MCP Endpoint: Execute a tool
 * Claude calls this to execute a specific tool
 */
app.post('/mcp/execute', async (req, res) => {
  try {
    const { tool_name, tool_input } = req.body;
    const safeToolInput = tool_input || {};

    console.log(`🔧 Executing tool: ${tool_name}`, safeToolInput);

    if (tool_name === 'get_current_datetime') {
      const result = await getCurrentDateTime();
      console.log('✅ DateTime result:', result);
      return res.json(result);
    }

    if (tool_name === 'fetch_webpage_content') {
      const result = await fetchWebContent(safeToolInput.url, safeToolInput.parse_type || 'smart');
      console.log('✅ Webpage fetch result:', result.success ? 'Success' : result.error);
      return res.json(result);
    }

    if (tool_name === 'search_web_information') {
      const result = await searchWebInformation(safeToolInput.query);
      console.log('✅ Search result:', result.success ? 'Success' : result.error);
      return res.json(result);
    }

    if (tool_name === 'get_realtime_prices') {
      const result = await getRealtimePrices(safeToolInput.search_term);
      console.log('✅ Price result:', result.success ? 'Success' : result.error);
      return res.json(result);
    }

    res.status(400).json({
      success: false,
      error: `Unknown tool: ${tool_name}`,
      available_tools: MCP_TOOLS.map(t => t.name)
    });

  } catch (error) {
    console.error('❌ Tool execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mcp_server: 'custom-free-api',
    port: MCP_PORT,
    tools_available: MCP_TOOLS.length,
    tool_names: MCP_TOOLS.map(t => t.name)
  });
});

app.listen(MCP_PORT, () => {
  console.log(`\n🚀 ===== COMPREHENSIVE MCP SERVER READY =====`);
  console.log(`🔗 Server: http://localhost:${MCP_PORT}`);
  console.log(`📋 Available Tools (${MCP_TOOLS.length}):`);
  MCP_TOOLS.forEach(tool => {
    console.log(`   ✓ ${tool.name}`);
  });
  console.log(`\n💡 Claude will automatically use these tools to:`);
  console.log(`   • Get current date/time`);
  console.log(`   • Fetch any website content`);
  console.log(`   • Search the web for information`);
  console.log(`   • Get real-time prices`);
  console.log(`\n🌐 Data source: Free public APIs (no Bright Data API usage)`);
  console.log(`✅ Ready to answer ANY real-time question!\n`);
});
