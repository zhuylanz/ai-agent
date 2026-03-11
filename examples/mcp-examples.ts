/**
 * Example: Using the AI Agent with MCP (Model Context Protocol) servers
 *
 * MCP servers expose tools that the agent can call automatically.
 * The agent connects to each server on start-up, discovers all available tools,
 * and registers them so they can be invoked during a conversation.
 *
 * Transport options:
 *   'httpStreamable' – modern Streamable HTTP transport (recommended, default)
 *   'sse'            – legacy Server-Sent Events transport
 *
 * Authentication: pass any HTTP headers needed (e.g. a Bearer token).
 *
 * Tool filtering:
 *   toolMode: 'all'      – expose every tool from the server (default)
 *   toolMode: 'selected' – only expose the tools listed in includeTools
 *   toolMode: 'except'   – expose everything except the tools in excludeTools
 *
 * Run:
 *   export OPENAI_API_KEY="your-key"
 *   npx ts-node examples/mcp-examples.ts
 */

import { AIAgent, MCPServerConfig } from '../src';

// ---------------------------------------------------------------------------
// Example 1 – connect to a single MCP server (all tools)
// ---------------------------------------------------------------------------
async function exampleSingleMcpServer() {
  console.log('--- Example 1: Single MCP server ---\n');

  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
    },
    systemMessage:
      'You are a helpful assistant with access to external tools via MCP.',
    mcpServers: [
      {
        url: 'https://my-mcp-server.example.com/mcp',
        // transport: 'httpStreamable',   // default, can be omitted
        // timeout: 60_000,               // default 60 s
      },
    ],
  });

  try {
    // The agent automatically discovers and registers all tools from the server.
    const tools = await agent.getToolsAsync();
    console.log(
      'Registered tools:',
      tools.map((t) => t.name),
    );

    const response = await agent.invoke(
      'What tools do you have available? Please list them.',
    );
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ---------------------------------------------------------------------------
// Example 2 – connect to a server that requires authentication
// ---------------------------------------------------------------------------
async function exampleAuthenticatedMcpServer() {
  console.log('--- Example 2: Authenticated MCP server ---\n');

  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
    mcpServers: [
      {
        url: 'https://secure-mcp.example.com/mcp',
        headers: {
          Authorization: `Bearer ${process.env.MCP_API_TOKEN ?? 'your-token'}`,
        },
      },
    ],
  });

  try {
    const response = await agent.invoke('Summarise the latest sales report.');
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ---------------------------------------------------------------------------
// Example 3 – connect to a legacy SSE server
// ---------------------------------------------------------------------------
async function exampleSseTransport() {
  console.log('--- Example 3: SSE transport ---\n');

  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
    mcpServers: [
      {
        url: 'https://legacy-mcp.example.com/sse',
        transport: 'sse',
      },
    ],
  });

  try {
    const response = await agent.invoke('List all available orders.');
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ---------------------------------------------------------------------------
// Example 4 – limit which tools are exposed (selected / except)
// ---------------------------------------------------------------------------
async function exampleToolFiltering() {
  console.log('--- Example 4: Tool filtering ---\n');

  // Only expose the two tools we actually need
  const selectedAgent = new AIAgent({
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    mcpServers: [
      {
        url: 'https://my-mcp-server.example.com/mcp',
        toolMode: 'selected',
        includeTools: ['search_documents', 'get_customer'],
      },
    ],
  });

  // Expose every tool EXCEPT potentially dangerous admin operations
  const restrictedAgent = new AIAgent({
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    mcpServers: [
      {
        url: 'https://my-mcp-server.example.com/mcp',
        toolMode: 'except',
        excludeTools: ['delete_record', 'drop_table'],
      },
    ],
  });

  try {
    const selectedTools = await selectedAgent.getToolsAsync();
    console.log(
      'Selected tools:',
      selectedTools.map((t) => t.name),
    );

    const restrictedTools = await restrictedAgent.getToolsAsync();
    console.log(
      'Restricted tools:',
      restrictedTools.map((t) => t.name),
    );
  } catch (error) {
    console.error('Error:', error);
  }
}

// ---------------------------------------------------------------------------
// Example 5 – combine MCP tools with regular custom tools and memory
// ---------------------------------------------------------------------------
async function exampleMcpWithCustomToolsAndMemory() {
  console.log('--- Example 5: MCP + custom tools + memory ---\n');

  const mcpServers: MCPServerConfig[] = [
    {
      url: 'https://my-mcp-server.example.com/mcp',
      toolMode: 'all',
      timeout: 30_000,
    },
  ];

  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
    },
    systemMessage:
      'You are a helpful business assistant. Use external tools to look up data and local tools to format results.',
    maxIterations: 15,
    returnIntermediateSteps: true,
    memory: {
      type: 'buffer-window',
      contextWindowLength: 20,
      sessionId: 'mcp-session-001',
    },
    mcpServers,
  });

  // Add a local tool alongside the MCP tools
  agent.addTool({
    name: 'format_currency',
    description: 'Format a number as a currency string',
    func: ({ amount, currency }: { amount: number; currency: string }) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount),
  });

  try {
    const response1 = await agent.invoke(
      'Find the total revenue for Q1 2025 and format it in USD.',
    );
    console.log('Turn 1:', response1.output);

    // Memory keeps context across turns
    const response2 = await agent.invoke(
      'How does that compare to Q1 2024?',
    );
    console.log('Turn 2:', response2.output);

    if (response2.intermediateSteps?.length) {
      console.log('\nIntermediate steps:');
      response2.intermediateSteps.forEach((step, i) =>
        console.log(`  Step ${i + 1}: tool=${step.action.tool}`, step.observation),
      );
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// ---------------------------------------------------------------------------
// Example 6 – multiple MCP servers
// ---------------------------------------------------------------------------
async function exampleMultipleMcpServers() {
  console.log('--- Example 6: Multiple MCP servers ---\n');

  const agent = new AIAgent({
    model: { provider: 'openai', model: 'gpt-4o-mini' },
    systemMessage:
      'You have access to a CRM, a ticketing system, and a payments system via MCP.',
    mcpServers: [
      {
        url: 'https://crm-mcp.example.com/mcp',
        name: 'crm-client',
        headers: { Authorization: `Bearer ${process.env.CRM_TOKEN ?? ''}` },
      },
      {
        url: 'https://tickets-mcp.example.com/mcp',
        name: 'tickets-client',
        toolMode: 'except',
        excludeTools: ['delete_ticket'],
      },
      {
        url: 'https://payments-mcp.example.com/sse',
        transport: 'sse',
        name: 'payments-client',
        toolMode: 'selected',
        includeTools: ['get_invoice', 'list_transactions'],
      },
    ],
  });

  try {
    const allTools = await agent.getToolsAsync();
    console.log(
      'All registered tools:',
      allTools.map((t) => t.name),
    );

    const response = await agent.invoke(
      'Look up customer ID 42 in the CRM and retrieve their latest invoice from payments.',
    );
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

// ---------------------------------------------------------------------------
// Exports & runner
// ---------------------------------------------------------------------------
export {
  exampleSingleMcpServer,
  exampleAuthenticatedMcpServer,
  exampleSseTransport,
  exampleToolFiltering,
  exampleMcpWithCustomToolsAndMemory,
  exampleMultipleMcpServers,
};

if (require.main === module) {
  console.log('Running AI Agent MCP examples...\n');

  // Uncomment the example you want to run:
  // exampleSingleMcpServer();
  // exampleAuthenticatedMcpServer();
  // exampleSseTransport();
  // exampleToolFiltering();
  exampleMcpWithCustomToolsAndMemory();
  // exampleMultipleMcpServers();
}
