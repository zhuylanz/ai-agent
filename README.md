# @lapage/ai-agent

A standalone, TypeScript-first AI Agent library built on [LangChain](https://js.langchain.com/). Wire up OpenAI or Anthropic models, register tools (including live **MCP servers**), add persistent memory, and query **vector knowledge bases** — all from a single `AIAgent` class.

## Table of Contents

- [@lapage/ai-agent](#lapageai-agent)
	- [Table of Contents](#table-of-contents)
	- [Features](#features)
	- [Installation](#installation)
	- [Quick Start](#quick-start)
	- [Models](#models)
	- [Tools](#tools)
		- [Custom tools — Zod schema](#custom-tools--zod-schema)
		- [Custom tools — JSON Schema](#custom-tools--json-schema)
	- [MCP Tool Calling](#mcp-tool-calling)
		- [Single server](#single-server)
		- [Authentication](#authentication)
		- [Tool filtering](#tool-filtering)
		- [Legacy SSE transport](#legacy-sse-transport)
		- [Multiple servers](#multiple-servers)
			- [`MCPServerConfig` reference](#mcpserverconfig-reference)
	- [Memory](#memory)
		- [Buffer window memory](#buffer-window-memory)
		- [Conversation summary memory](#conversation-summary-memory)
		- [PostgreSQL-backed memory](#postgresql-backed-memory)
			- [`MemoryConfig` reference](#memoryconfig-reference)
	- [Knowledge Bases](#knowledge-bases)
			- [`KnowledgeBaseConfig` reference](#knowledgebaseconfig-reference)
			- [`EmbeddingsConfig` reference](#embeddingsconfig-reference)
	- [API Reference](#api-reference)
		- [`new AIAgent(options)`](#new-aiagentoptions)
		- [Instance methods](#instance-methods)
		- [`AIAgentResponse`](#aiagentresponse)
	- [Environment Variables](#environment-variables)
	- [Development](#development)
		- [Running examples](#running-examples)
	- [License](#license)

---

## Features

- **Multi-provider LLM support** — OpenAI (GPT-4o, etc.) and Anthropic (Claude 3/3.5) via optional peer dependencies
- **MCP tool calling** — connect to any [Model Context Protocol](https://modelcontextprotocol.io) server and auto-register all its tools
- **Custom tools** — register functions with Zod or JSON Schema 7 input schemas
- **Conversation memory** — in-memory buffer window, summary memory, or PostgreSQL-backed history
- **Vector knowledge bases** — automatic RAG tools powered by pgvector + configurable embeddings
- **TypeScript-first** — full type definitions, strict mode, exported interfaces for every option

---

## Installation

```bash
npm install @lapage/ai-agent
```

Install the LLM provider you need (at least one required):

```bash
npm install @langchain/openai      # for OpenAI / GPT models
npm install @langchain/anthropic   # for Anthropic / Claude models
```

---

## Quick Start

```ts
import { AIAgent } from '@lapage/ai-agent';

const agent = new AIAgent({
  model: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  systemMessage: 'You are a helpful assistant.',
});

const { output } = await agent.invoke('What is the capital of France?');
console.log(output); // Paris
```

---

## Models

Configure the model via the `model` option:

```ts
// OpenAI
model: {
  provider: 'openai',
  model: 'gpt-4o',          // any OpenAI chat model
  temperature: 0.7,          // default: 0.7
  maxTokens: 1024,           // optional
  apiKey: 'sk-...',          // or set OPENAI_API_KEY env var
}

// Anthropic
model: {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.5,
  apiKey: 'sk-ant-...',      // or set ANTHROPIC_API_KEY env var
}
```

| Field         | Type                      | Default | Description          |
| ------------- | ------------------------- | ------- | -------------------- |
| `provider`    | `'openai' \| 'anthropic'` | —       | LLM provider         |
| `model`       | `string`                  | —       | Model name           |
| `temperature` | `number`                  | `0.7`   | Sampling temperature |
| `maxTokens`   | `number`                  | —       | Max output tokens    |
| `apiKey`      | `string`                  | env var | Override API key     |

---

## Tools

### Custom tools — Zod schema

```ts
import { z } from 'zod';

agent.addTool({
  name: 'calculate',
  description: 'Evaluate a mathematical expression',
  schema: z.object({
    expression: z.string().describe('e.g. "12 * 4 + 7"'),
  }),
  func: ({ expression }) => String(eval(expression)),
});
```

### Custom tools — JSON Schema

```ts
agent.addTool({
  name: 'get_user',
  description: 'Look up a user by ID',
  schema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The user UUID' },
    },
    required: ['userId'],
  },
  func: async ({ userId }) => {
    const user = await db.users.findById(userId);
    return JSON.stringify(user);
  },
});
```

Add several tools at once with `addTools([ ... ])`.

---

## MCP Tool Calling

The agent can connect to any [MCP](https://modelcontextprotocol.io) server and automatically discover and register all the tools it exposes. No manual tool registration is required.

### Single server

```ts
const agent = new AIAgent({
  model: { provider: 'openai', model: 'gpt-4o' },
  mcpServers: [
    {
      url: 'https://my-mcp-server.example.com/mcp',
    },
  ],
});

// Tools are fetched lazily on first use, or eagerly:
const tools = await agent.getToolsAsync();
console.log(tools.map(t => t.name));

const { output } = await agent.invoke('What can you do?');
```

### Authentication

```ts
mcpServers: [
  {
    url: 'https://secure-mcp.example.com/mcp',
    headers: {
      Authorization: `Bearer ${process.env.MCP_API_TOKEN}`,
    },
  },
],
```

Any arbitrary HTTP headers can be passed (API keys, custom auth schemes, etc.).

### Tool filtering

By default all tools from the server are registered. Use `toolMode` to limit them:

```ts
// Only expose specific tools
{
  url: '...',
  toolMode: 'selected',
  includeTools: ['search_documents', 'get_invoice'],
}

// Expose everything except dangerous operations
{
  url: '...',
  toolMode: 'except',
  excludeTools: ['delete_record', 'drop_table'],
}
```

### Legacy SSE transport

```ts
{
  url: 'https://legacy-mcp.example.com/sse',
  transport: 'sse',   // default is 'httpStreamable'
}
```

### Multiple servers

```ts
mcpServers: [
  {
    url: 'https://crm-mcp.example.com/mcp',
    name: 'crm-client',
    headers: { Authorization: `Bearer ${process.env.CRM_TOKEN}` },
  },
  {
    url: 'https://payments-mcp.example.com/mcp',
    name: 'payments-client',
    toolMode: 'selected',
    includeTools: ['get_invoice', 'list_transactions'],
  },
],
```

All tools from every server are merged into a single pool available to the agent.

#### `MCPServerConfig` reference

| Field          | Type                              | Default                 | Description                              |
| -------------- | --------------------------------- | ----------------------- | ---------------------------------------- |
| `url`          | `string`                          | —                       | MCP server endpoint URL                  |
| `transport`    | `'httpStreamable' \| 'sse'`       | `'httpStreamable'`      | Wire protocol                            |
| `headers`      | `Record<string, string>`          | —                       | HTTP headers (auth, etc.)                |
| `name`         | `string`                          | `'ai-agent-mcp-client'` | Client identifier                        |
| `timeout`      | `number`                          | `60000`                 | Tool call timeout (ms)                   |
| `toolMode`     | `'all' \| 'selected' \| 'except'` | `'all'`                 | Tool filtering strategy                  |
| `includeTools` | `string[]`                        | —                       | Tools to expose (`toolMode: 'selected'`) |
| `excludeTools` | `string[]`                        | —                       | Tools to hide (`toolMode: 'except'`)     |

---

## Memory

Pass a `memory` option to retain conversation history across turns.

### Buffer window memory

Keeps the last *N* exchanges in memory:

```ts
const agent = new AIAgent({
  model: { provider: 'openai', model: 'gpt-4o-mini' },
  memory: {
    type: 'buffer-window',
    contextWindowLength: 10,   // number of message pairs, default 10
    sessionId: 'user-123',     // optional; auto-generated if omitted
  },
});

await agent.invoke('My name is Alice.');
const reply = await agent.invoke('What is my name?'); // "Alice"
```

### Conversation summary memory

The model summarises older messages, keeping context compact for long conversations:

```ts
memory: {
  type: 'summary',
  sessionId: 'user-456',
}
```

> Requires the same model instance — an extra LLM call is made periodically to summarise.

### PostgreSQL-backed memory

Persist conversation history across process restarts:

```ts
memory: {
  type: 'postgres',
  sessionId: 'user-789',
  contextWindowLength: 20,
  postgresConfig: {
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    user: 'pguser',
    password: 'secret',
    tableName: 'chat_messages',  // default: 'chat_messages'
  },
}
```

#### `MemoryConfig` reference

| Field                 | Type                                         | Default           | Description                       |
| --------------------- | -------------------------------------------- | ----------------- | --------------------------------- |
| `type`                | `'buffer-window' \| 'summary' \| 'postgres'` | `'buffer-window'` | Memory strategy                   |
| `sessionId`           | `string`                                     | auto-generated    | Isolates history per user/session |
| `contextWindowLength` | `number`                                     | `10`              | Messages to keep in window        |
| `postgresConfig`      | `PostgresConfig`                             | —                 | Required for `'postgres'` type    |

---

## Knowledge Bases

Attach one or more vector knowledge bases. The agent automatically gets a search tool per knowledge base and uses it to answer questions via RAG.

Requires PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension.

```ts
import { AIAgent } from '@lapage/ai-agent';

const agent = new AIAgent({
  model: { provider: 'openai', model: 'gpt-4o' },
  knowledgeBases: [
    {
      name: 'company_docs',
      description:
        'Company policies, HR procedures, and internal documentation. ' +
        'Use this when the user asks about company-related topics.',
      pgConfig: {
        host: 'localhost',
        port: 5432,
        database: 'vectordb',
        user: 'pguser',
        password: 'secret',
        tableName: 'company_docs',
      },
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small',
      },
      topK: 5,
      includeMetadata: true,
    },
  ],
});

const { output } = await agent.invoke('What is the parental leave policy?');
```

#### `KnowledgeBaseConfig` reference

| Field             | Type                  | Default | Description                                |
| ----------------- | --------------------- | ------- | ------------------------------------------ |
| `name`            | `string`              | —       | Unique name; becomes part of the tool name |
| `description`     | `string`              | —       | Helps the agent decide when to use this KB |
| `pgConfig`        | `PGVectorConfig`      | —       | PostgreSQL + pgvector connection           |
| `embeddings`      | `EmbeddingsConfig`    | —       | Embeddings model for search                |
| `topK`            | `number`              | `4`     | Results to retrieve per query              |
| `includeMetadata` | `boolean`             | `true`  | Include document metadata in results       |
| `metadataFilter`  | `Record<string, any>` | —       | Optional filter applied to every search    |

#### `EmbeddingsConfig` reference

| Field      | Type                                    | Description                              |
| ---------- | --------------------------------------- | ---------------------------------------- |
| `provider` | `'openai' \| 'cohere' \| 'huggingface'` | Embeddings provider                      |
| `model`    | `string`                                | Model name                               |
| `apiKey`   | `string`                                | Override API key (falls back to env var) |

---

## API Reference

### `new AIAgent(options)`

| Option                    | Type                    | Default                         | Description                                 |
| ------------------------- | ----------------------- | ------------------------------- | ------------------------------------------- |
| `model`                   | `ModelConfig`           | —                               | **Required.** LLM to use                    |
| `systemMessage`           | `string`                | `'You are a helpful assistant'` | System prompt                               |
| `maxIterations`           | `number`                | `10`                            | Max tool-calling loops before stopping      |
| `returnIntermediateSteps` | `boolean`               | `true`                          | Include step-by-step tool calls in response |
| `memory`                  | `MemoryConfig`          | —                               | Conversation memory                         |
| `tools`                   | `ToolOptions[]`         | —                               | Custom tools to register upfront            |
| `mcpServers`              | `MCPServerConfig[]`     | —                               | MCP servers to auto-register tools from     |
| `knowledgeBases`          | `KnowledgeBaseConfig[]` | —                               | Vector knowledge bases                      |

### Instance methods

| Method                        | Returns                    | Description                                    |
| ----------------------------- | -------------------------- | ---------------------------------------------- |
| `invoke(input)`               | `Promise<AIAgentResponse>` | Run the agent on a user message                |
| `stream(input, onToken?)`     | `Promise<AIAgentResponse>` | Streaming-aware invoke (returns same response) |
| `addTool(options)`            | `void`                     | Register a custom tool                         |
| `addTools(options[])`         | `void`                     | Register multiple tools at once                |
| `addLangChainTool(tool)`      | `void`                     | Register a pre-built LangChain tool            |
| `getTools()`                  | `Tool[]`                   | Return currently registered tools (sync)       |
| `getToolsAsync()`             | `Promise<Tool[]>`          | Return tools after all async init completes    |
| `removeTool(name)`            | `boolean`                  | Remove a tool by name                          |
| `clearTools()`                | `void`                     | Remove all tools                               |
| `setupMemory(config)`         | `Promise<void>`            | (Re-)configure memory after construction       |
| `clearMemory()`               | `Promise<void>`            | Wipe the current session's history             |
| `getConversationHistory()`    | `Promise<BaseMessage[]>`   | Return raw message history                     |
| `addToHistory(input, output)` | `Promise<void>`            | Manually append a turn to history              |
| `setSystemMessage(msg)`       | `void`                     | Update the system prompt                       |
| `setMaxIterations(n)`         | `void`                     | Update the iteration cap                       |

### `AIAgentResponse`

```ts
interface AIAgentResponse {
  output: string;                    // Final answer
  intermediateSteps?: AgentStep[];   // Tool calls (when returnIntermediateSteps: true)
  error?: string;                    // Set when invocation fails
}
```

---

## Environment Variables

| Variable                   | Provider                   |
| -------------------------- | -------------------------- |
| `OPENAI_API_KEY`           | OpenAI models & embeddings |
| `ANTHROPIC_API_KEY`        | Anthropic models           |
| `COHERE_API_KEY`           | Cohere embeddings          |
| `HUGGINGFACEHUB_API_TOKEN` | HuggingFace embeddings     |

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run demo scripts (requires .env file with API keys)
npm run demo:openai
npm run demo:anthropic
npm run demo:postgres
```

### Running examples

Copy `.env.example` to `.env` and fill in your keys, then:

```bash
# OpenAI examples (basic, memory, tools, MCP)
npm run demo:openai

# Anthropic examples
npm run demo:anthropic

# PostgreSQL memory / knowledge base demo
npm run demo:postgres
```

---

## License

MIT © Huy Lan
