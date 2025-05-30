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
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature?: number;
  maxTokens?: number;
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
  intermediateSteps?: any[];

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

  /** Tool schema for parameters */
  schema?: any;
}
