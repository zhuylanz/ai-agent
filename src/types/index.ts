import { z } from 'zod';

// LangChain types for intermediate steps
export interface AgentAction {
  /** Name of the tool to execute */
  tool: string;
  /** Input parameters for the tool */
  toolInput: any;
  /** Tool call ID for tracking */
  toolCallId: string;
  /** Log message for the action */
  log: string;
  /** Array of messages in the conversation */
  messageLog: any[];
}

export interface AgentStep {
  /** The action taken by the agent */
  action: AgentAction;
  /** The observation/result from executing the action */
  observation: string;
}

export interface AIAgentOptions {
  /** The chat model to use for the agent */
  model: ModelConfig;

  /** System message to provide context to the agent */
  systemMessage?: string;

  /** Maximum number of iterations the agent can perform */
  maxIterations?: number;

  /** Whether to return intermediate steps in the response */
  returnIntermediateSteps?: boolean;

  /** Whether to passthrough binary images */
  passthroughBinaryImages?: boolean;

  /** Memory configuration for conversation history */
  memory?: MemoryConfig;

  /** Array of tools available to the agent */
  tools?: ToolOptions[];

  /** Knowledge bases configuration for automatic vector search tools */
  knowledgeBases?: KnowledgeBaseConfig[];
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface EmbeddingsConfig {
  provider: 'openai' | 'cohere' | 'huggingface';
  model: string;
  apiKey?: string;
}

export interface MemoryConfig {
  /** Type of memory to use */
  type?: 'buffer-window' | 'summary' | 'postgres';

  /** Session ID for memory isolation. Auto-generated if not provided */
  sessionId?: string;

  /** For buffer window memory - number of messages to keep */
  contextWindowLength?: number;

  /** PostgreSQL configuration for postgres memory type */
  postgresConfig?: PostgresConfig;
}

export interface AIAgentResponse {
  /** The final output from the agent */
  output: string;

  /** Intermediate steps if returnIntermediateSteps is true */
  intermediateSteps?: AgentStep[];

  /** Error if execution failed */
  error?: string;
}

export interface PostgresConfig {
  /** Postgres host */
  host: string;

  /** Postgres port */
  port?: number;

  /** Database name */
  database: string;

  /** Username for Postgres connection */
  user: string;

  /** Password for Postgres connection */
  password: string;

  /** Table name for storing chat messages */
  tableName?: string;
}

export interface ToolOptions {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Tool function */
  func: (...args: any[]) => Promise<string> | string;

  /** Tool schema for parameters - Zod schema defining the input structure */
  schema?: z.ZodSchema;
}

export interface KnowledgeBaseConfig {
  /** Name of the knowledge base (used as tool name) */
  name: string;
  /** Description to help the AI Agent understand when to query this knowledge base */
  description: string;
  /** PostgreSQL configuration for the vector store */
  pgConfig: PGVectorConfig;
  /** Embeddings configuration for the vector search */
  embeddings: EmbeddingsConfig;
  /** Number of documents to retrieve by default */
  topK?: number;
  /** Whether to include metadata in search results */
  includeMetadata?: boolean;
  /** Optional metadata filter to apply to searches */
  metadataFilter?: Record<string, any>;
}

export interface PGVectorConfig {
  /** Postgres host */
  host: string;
  /** Postgres port */
  port: number;
  /** Database name */
  database: string;
  /** Username for Postgres connection */
  user: string;
  /** Password for Postgres connection */
  password: string;
  /** Table name for storing vectors */
  tableName?: string;
  /** Collection name for organizing vectors */
  collectionName?: string;
  /** Collection table name */
  collectionTableName?: string;
  /** Custom column configuration */
  columns?: {
    idColumnName?: string;
    vectorColumnName?: string;
    contentColumnName?: string;
    metadataColumnName?: string;
  };
}
