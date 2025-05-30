# AI Agent Library

A standalone AI Agent library. This library allows you to create powerful AI agents with memory, tool calling capabilities, and flexible configuration options.

## Features

- 🤖 **AI Agent Creation**: Create AI agents with any LangChain-compatible chat model
- 🧠 **Memory Management**: Built-in support for conversation memory with different types (buffer, buffer-window, summary, mysql)
- 🛠️ **Tool Integration**: Easy tool addition and management for function calling
- ⚙️ **Flexible Configuration**: Configurable system messages, max iterations, and more
- 🔄 **Session Management**: Multi-session support with isolated memory
- 📝 **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @zhuylanz/ai-agent
```

## Prerequisites

You'll need to install the LangChain model providers you want to use:

```bash
# For OpenAI
npm install @langchain/openai

# For Anthropic
npm install @langchain/anthropic

# For other providers, check LangChain documentation
```

## Quick Start

### Simple AI Agent

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { AIAgent } from '@zhuylanz/ai-agent';

const model = new ChatOpenAI({
  temperature: 0.7,
  model: 'gpt-4o-mini',
});

const agent = new AIAgent({
  model,
  systemMessage: 'You are a helpful assistant.',
});

const response = await agent.invoke('What is the capital of France?');
console.log(response.output); // "The capital of France is Paris."
```

### AI Agent with Memory

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { AIAgent } from '@zhuylanz/ai-agent';

const model = new ChatOpenAI({
  temperature: 0.7,
  model: 'gpt-4o-mini',
});

const agent = new AIAgent({
  model,
  memory: {
    type: 'buffer-window',
    contextWindowLength: 5, // Keep last 5 message pairs
  },
  systemMessage: 'You are a helpful assistant with memory.',
});

await agent.invoke('My name is John.');
const response = await agent.invoke('What is my name?');
console.log(response.output); // "Your name is John."
```

### AI Agent with Tools

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { AIAgent } from '@zhuylanz/ai-agent';

const model = new ChatOpenAI({
  temperature: 0.7,
  model: 'gpt-4o-mini',
});

const agent = new AIAgent({
  model,
  systemMessage: 'You are a helpful assistant with calculation abilities.',
  maxIterations: 5,
});

// Add a calculator tool
agent.addTool({
  name: 'calculator',
  description: 'Perform arithmetic calculations',
  func: async (expression: string) => {
    const result = eval(expression); // Use a safer math parser in production
    return `The result is ${result}`;
  },
});

const response = await agent.invoke('What is 15 + 27?');
console.log(response.output);
```

## API Reference

### AIAgent Class

#### Constructor Options

```typescript
interface AIAgentOptions {
  model: BaseChatModel;              // Required: LangChain chat model
  systemMessage?: string;            // System message for the agent
  maxIterations?: number;            // Maximum iterations (default: 10)
  returnIntermediateSteps?: boolean; // Return intermediate steps (default: false)
  passthroughBinaryImages?: boolean; // Pass binary images (default: false)
  memory?: MemoryConfig;             // Memory configuration
  tools?: Tool[];                    // Initial tools array
}

interface MemoryConfig {
  type?: 'buffer' | 'buffer-window' | 'summary' | 'mysql'; // Memory type
  sessionId?: string;               // Session ID (auto-generated if not provided)
  contextWindowLength?: number;      // Context window for buffer memory
  mysqlConfig?: MySQLConfig;        // MySQL configuration for mysql type
  instance?: BaseChatMemory;        // Custom memory instance
}
```

#### Methods

##### `invoke(input: string): Promise<AIAgentResponse>`
Execute the agent with the given input.

##### `addTool(toolOptions: ToolOptions): void`
Add a custom tool to the agent.

```typescript
interface ToolOptions {
  name: string;                    // Tool name
  description: string;             // Tool description
  func: (...args: any[]) => Promise<string> | string; // Tool function
  schema?: any;                    // Optional schema for parameters
}
```

##### `addLangChainTool(tool: Tool): void`
Add an existing LangChain tool.

##### `setupMemory(sessionId: string, options: MemoryOptions): Promise<void>`
Set up memory for a specific session.

```typescript
interface MemoryOptions {
  type: 'buffer' | 'buffer-window' | 'summary' | 'mysql';
  contextWindowLength?: number;     // For buffer-window memory
  mysqlConfig?: MySQLConfig;       // MySQL configuration for mysql type
}

interface MySQLConfig {
  host: string;                    // MySQL host
  port?: number;                   // MySQL port (default: 3306)
  database: string;                // Database name
  user: string;                    // Username
  password: string;                // Password
  tableName?: string;              // Table name (default: 'chat_messages')
}
```

##### `clearMemory(): Promise<void>`
Clear the agent's memory.

##### `getConversationHistory(): Promise<BaseMessage[]>`
Get the conversation history from memory.

#### Static Methods

The AIAgent class only supports constructor-based instantiation. There are no static factory methods.

### Memory Management

The library includes built-in memory management with automatic cleanup:

```typescript
import { MemoryManager } from 'ai-agent/memory';

// Get or create memory for a session
const memory = await MemoryManager.getMemory('session-123', {
  type: 'buffer-window',
  contextWindowLength: 10,
});

// Clear memory for a session
await MemoryManager.clearMemory('session-123');
```

### Tool Management

```typescript
import { ToolManager } from 'ai-agent/tools';

const toolManager = new ToolManager();

// Add tools
toolManager.addTool({
  name: 'weather',
  description: 'Get weather information',
  func: async (city: string) => `Weather in ${city}: Sunny, 25°C`,
});

// Get all tools
const tools = toolManager.getTools();
```

## Supported Models

The library works with any LangChain chat model that supports tool calling:

- **OpenAI**: gpt-4o-mini, GPT-4, GPT-4-turbo
- **Anthropic**: Claude-3 (Sonnet, Haiku, Opus)
- **Google**: Gemini Pro
- **And many others supported by LangChain**

## Memory Types

### Buffer Memory
Stores all conversation history:

```typescript
const agent = new AIAgent({
  model,
  memory: await MemoryManager.getMemory('session', { type: 'buffer' }),
});
```

### Buffer Window Memory
Stores a fixed number of recent message pairs:

```typescript
const agent = new AIAgent({
  model,
  contextWindowLength: 5, // Keep last 5 exchanges
});
```

### Summary Memory
Uses the LLM to summarize old conversations:

```typescript
const agent = new AIAgent({
  model,
  memory: await MemoryManager.getMemory('session', {
    type: 'summary'
  }),
});
```

### PostgreSQL Memory
Store conversation history in a PostgreSQL database for persistence across sessions:

First, install the required packages:
```bash
npm install pg @types/pg @langchain/community
```

Then use PostgreSQL memory:

```typescript
import { PostgresConfig } from 'ai-agent';

const postgresConfig: PostgresConfig = {
  host: 'localhost',
  port: 5432,
  database: 'ai_agent_db',
  user: 'your_username',
  password: 'your_password',
  tableName: 'chat_messages', // Optional, defaults to 'chat_messages'
};

// Automatic PostgreSQL memory setup - just provide sessionId in config!
const agent = new AIAgent({
  model,
  memory: {
    type: 'postgres',
    sessionId: 'user-session-123', // Memory auto-setup happens internally
    contextWindowLength: 10, // Keep last 10 message pairs
    postgresConfig,
  },
  systemMessage: 'You are a helpful assistant that remembers our conversations.',
});

// No setup required! Memory is automatically configured and ready to use

// Alternative: Auto-generated session ID
const agent2 = new AIAgent({
  model,
  memory: {
    type: 'postgres',
    // sessionId not provided - will be auto-generated
    postgresConfig,
  },
  systemMessage: 'You are a helpful assistant.',
});

// Conversations are automatically persisted to PostgreSQL on first use
const response1 = await agent.invoke('Hi, my name is John');
const response2 = await agent.invoke('What is my name?'); // Agent remembers!
```

The PostgreSQL memory automatically:
- Creates the required table if it doesn't exist
- Stores messages with session IDs for multi-user support
- Manages connection pooling for optimal performance
- Handles different message types (human, AI, system)
- Uses the LangChain PostgresChatMessageHistory for robust message management

Table structure:
```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_id ON chat_messages(session_id);
```

## Advanced Usage

### Custom Output Parsing

```typescript
import { z } from 'zod';

const agent = new AIAgent({
  model,
  systemMessage: 'Return structured responses',
  returnIntermediateSteps: true,
});

// The agent will automatically format responses when tools are used
```

### Session Management

```typescript
const agent = new AIAgent({ model });

// Set up memory for different users
await agent.setupMemory('user-123', {
  type: 'buffer-window',
  contextWindowLength: 10,
});

// Switch sessions
await agent.setupMemory('user-456', {
  type: 'buffer-window',
  contextWindowLength: 5,
});
```

### Error Handling

```typescript
const response = await agent.invoke('Complex query');

if (response.error) {
  console.error('Agent error:', response.error);
} else {
  console.log('Success:', response.output);

  if (response.intermediateSteps) {
    console.log('Steps taken:', response.intermediateSteps);
  }
}
```

## Examples

Check the `examples/` directory for comprehensive examples:

- `basic-usage.ts` - Basic agent creation and usage
- `memory-examples.ts` - Memory management examples
- `tool-examples.ts` - Custom tool implementations
- `advanced-patterns.ts` - Advanced usage patterns

## Configuration

### Environment Variables

Set your API keys as environment variables:

```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

### Model Configuration

```typescript
// OpenAI with custom settings
const openaiModel = new ChatOpenAI({
  temperature: 0.7,
  model: 'gpt-4',
  maxTokens: 1000,
});

// Anthropic with custom settings
const anthropicModel = new ChatAnthropic({
  temperature: 0.5,
  model: 'claude-3-sonnet-20240229',
  maxTokens: 2000,
});
```

## Performance Tips

1. **Memory Management**: Use buffer-window memory for long conversations to control token usage
2. **Tool Descriptions**: Write clear, concise tool descriptions for better agent performance
3. **System Messages**: Craft specific system messages for your use case
4. **Iteration Limits**: Set appropriate `maxIterations` to prevent infinite loops

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.0.0
- Initial release
- Basic agent functionality
- Memory management
- Tool integration
- TypeScript support

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/zhuylanz/ai-agent/issues)
- Documentation: [Full documentation](https://your-docs-site.com)

## Related Projects

- [LangChain](https://langchain.com) - The underlying framework
- [LangChain Community](https://github.com/langchain-ai/langchain) - Additional tools and integrations
