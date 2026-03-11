import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CompatibilityCallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

import { convertJsonSchemaToZod } from './json-schema-to-zod';
import type { MCPServerConfig } from '../types/index';

type McpTool = { name: string; description?: string; inputSchema: JSONSchema7 };

/**
 * Recursively fetch all tools from the MCP server, following pagination cursors.
 */
async function getAllMcpTools(client: Client, cursor?: string): Promise<McpTool[]> {
  const { tools, nextCursor } = await client.listTools({ cursor });
  const mcpTools = tools as McpTool[];

  if (nextCursor) {
    return mcpTools.concat(await getAllMcpTools(client, nextCursor));
  }

  return mcpTools;
}

/**
 * Convert an MCP tool definition to a LangChain DynamicStructuredTool.
 * The JSON Schema inputSchema is converted to a Zod object schema so the
 * agent can validate and pass structured arguments.
 */
function mcpToolToLangChainTool(
  tool: McpTool,
  client: Client,
  timeout: number,
): DynamicStructuredTool {
  const rawSchema = convertJsonSchemaToZod(tool.inputSchema);

  // DynamicStructuredTool requires a ZodObject at the top level
  const objectSchema =
    rawSchema instanceof z.ZodObject ? rawSchema : z.object({ value: rawSchema });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (DynamicStructuredTool as any)({
    name: tool.name,
    description: tool.description ?? '',
    schema: objectSchema,
    func: async (args: Record<string, unknown>) => {
      try {
        const result = await client.callTool(
          { name: tool.name, arguments: args },
          CompatibilityCallToolResultSchema,
          { timeout },
        );

        if (result.isError) {
          const errorMsg = extractTextFromContent(result) ?? `Tool "${tool.name}" returned an error`;
          return errorMsg;
        }

        if (result.toolResult !== undefined) {
          return typeof result.toolResult === 'string'
            ? result.toolResult
            : JSON.stringify(result.toolResult);
        }

        if (result.content !== undefined) {
          const text = extractTextFromContent(result);
          return text ?? JSON.stringify(result.content);
        }

        return JSON.stringify(result);
      } catch (error) {
        return `Error calling MCP tool "${tool.name}": ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    },
    metadata: { mcpTool: true, mcpServer: tool.name },
  });
}

function extractTextFromContent(result: any): string | undefined {
  if (result?.content && Array.isArray(result.content)) {
    const textEntry = (result.content as Array<{ type: string; text?: string }>).find(
      (c) => c.type === 'text' && typeof c.text === 'string',
    );
    return textEntry?.text;
  }
  return undefined;
}

/**
 * Connect to an MCP server and return its tools as LangChain DynamicStructuredTool instances.
 * Supports both SSE and HTTP Streamable transports.
 */
export async function getMcpServerTools(config: MCPServerConfig): Promise<DynamicStructuredTool[]> {
  const {
    url,
    transport = 'httpStreamable',
    headers,
    name = 'ai-agent-mcp-client',
    timeout = 60_000,
    toolMode = 'all',
    includeTools,
    excludeTools,
  } = config;

  const endpointUrl = normalizeUrl(url);
  const client = new Client({ name, version: '1' }, { capabilities: {} });

  if (transport === 'httpStreamable') {
    const httpTransport = new StreamableHTTPClientTransport(new URL(endpointUrl), {
      requestInit: { headers },
    });
    await client.connect(httpTransport);
  } else {
    const sseTransport = new SSEClientTransport(new URL(endpointUrl), {
      eventSourceInit: {
        fetch: async (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, {
            ...init,
            headers: {
              ...((init?.headers as Record<string, string>) ?? {}),
              ...(headers ?? {}),
              Accept: 'text/event-stream',
            },
          }),
      },
      requestInit: { headers },
    });
    await client.connect(sseTransport);
  }

  const allTools = await getAllMcpTools(client);
  const filteredTools = filterTools(allTools, toolMode, includeTools, excludeTools);

  return filteredTools.map((tool) => mcpToolToLangChainTool(tool, client, timeout));
}

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

function filterTools(
  tools: McpTool[],
  mode: MCPServerConfig['toolMode'],
  includeTools?: string[],
  excludeTools?: string[],
): McpTool[] {
  switch (mode) {
    case 'selected': {
      if (!includeTools?.length) return tools;
      const include = new Set(includeTools);
      return tools.filter((t) => include.has(t.name));
    }
    case 'except': {
      const except = new Set(excludeTools ?? []);
      return tools.filter((t) => !except.has(t.name));
    }
    case 'all':
    default:
      return tools;
  }
}
