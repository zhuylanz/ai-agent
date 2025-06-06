import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseMessagePromptTemplateLike } from '@langchain/core/prompts';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import type { BaseChatMemory } from 'langchain/memory';
import type { Tool } from '@langchain/core/tools';
import { omit } from 'lodash';

import type {
  AIAgentOptions,
  AIAgentResponse,
  ToolOptions,
  MemoryConfig,
  KnowledgeBaseConfig,
} from './types/index';
import { ToolManager } from './tools/index';
import { MemoryManager } from './memory/memory-manager';
import { ModelFactory } from './models/model-factory';
import { createVectorSearchTool } from './tools/vector-tools';

export class AIAgent {
  private model: BaseChatModel;
  private systemMessage: string;
  private maxIterations: number;
  private returnIntermediateSteps: boolean;
  private passthroughBinaryImages: boolean;
  private memory?: BaseChatMemory;
  private toolManager: ToolManager;
  private sessionId: string = Math.random().toString(36).substring(7); // Default sessionId
  private pendingMemoryConfig?: MemoryConfig;
  private memorySetupPromise?: Promise<void>;
  private modelInitPromise: Promise<void>;

  constructor(options: AIAgentOptions) {
    this.model = null as any;
    this.systemMessage = options.systemMessage || 'You are a helpful assistant';
    this.maxIterations = options.maxIterations || 10;
    this.returnIntermediateSteps = options.returnIntermediateSteps || true;
    this.passthroughBinaryImages = options.passthroughBinaryImages || false;
    this.toolManager = new ToolManager();

    this.modelInitPromise = this.initializeModel(options.model);

    if (options.tools) {
      if (Array.isArray(options.tools)) {
        this.toolManager.addTools(options.tools);
      } else {
        throw new Error('Tools must be an array of ToolOptions');
      }
    }

    // Auto-create vector search tools from knowledge bases
    if (options.knowledgeBases) {
      this.addKnowledgeBaseTools(options.knowledgeBases);
    }

    if (options.memory) {
      if (options.memory.sessionId) {
        this.sessionId = options.memory.sessionId;
      }
      this.pendingMemoryConfig = options.memory;
      this.memorySetupPromise = this.setupMemory(options.memory);
    }
  }

  /**
   * Initialize the model asynchronously
   */
  private async initializeModel(
    modelConfig: AIAgentOptions['model'],
  ): Promise<void> {
    try {
      this.model = await ModelFactory.createModel(modelConfig);

      if (!this.model.bindTools) {
        throw new Error(
          'AI Agent requires a Chat Model which supports Tools calling',
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize model: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Ensure model is initialized before operations
   */
  private async ensureModelReady(): Promise<void> {
    await this.modelInitPromise;
  }

  /**
   * Ensure memory is set up before operations
   */
  private async ensureMemoryReady(): Promise<void> {
    if (this.memorySetupPromise) {
      await this.memorySetupPromise;
      this.memorySetupPromise = undefined;
    }
  }

  /**
   * Set up memory for the agent with specific options
   */
  async setupMemory(options?: MemoryConfig): Promise<void> {
    if (!options) {
      return;
    }

    this.memory = await MemoryManager.getMemory(
      this.sessionId,
      options,
      this.model,
    );
  }

  /**
   * Create and add vector search tools from knowledge base configurations
   */
  private addKnowledgeBaseTools(knowledgeBases: KnowledgeBaseConfig[]): void {
    for (const kb of knowledgeBases) {
      try {
        const vectorSearchTool = createVectorSearchTool({
          toolName: `search_${kb.name}`,
          toolDescription: kb.description,
          pgConfig: kb.pgConfig,
          embeddings: kb.embeddings,
          topK: kb.topK || 4,
          includeMetadata: kb.includeMetadata !== false,
          metadataFilter: kb.metadataFilter,
          outputFormat: 'simple',
          allowDynamicTopK: true,
        });

        this.toolManager.addTool(vectorSearchTool);
      } catch (error) {
        console.error(
          `Failed to create vector search tool for knowledge base '${kb.name}':`,
          error,
        );
        throw new Error(
          `Failed to create vector search tool for knowledge base '${
            kb.name
          }': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Add a custom tool to the agent
   */
  addTool(toolOptions: ToolOptions): void {
    this.toolManager.addTool(toolOptions);
  }

  /**
   * Add multiple tools at once
   */
  addTools(toolOptions: ToolOptions[]): void {
    this.toolManager.addTools(toolOptions);
  }

  /**
   * Add an existing LangChain tool
   */
  addLangChainTool(tool: Tool): void {
    this.toolManager.addLangChainTool(tool);
  }

  /**
   * Get all available tools
   */
  getTools(): Tool[] {
    return this.toolManager.getTools();
  }

  /**
   * Clear all tools
   */
  clearTools(): void {
    this.toolManager.clearTools();
  }

  /**
   * Clear memory for the current session
   */
  async clearMemory(): Promise<void> {
    await this.ensureMemoryReady();

    if (this.memory) {
      await this.memory.clear();
    }
  }

  /**
   * Update the system message
   */
  setSystemMessage(message: string): void {
    this.systemMessage = message;
  }

  /**
   * Update max iterations
   */
  setMaxIterations(iterations: number): void {
    this.maxIterations = iterations;
  }

  /**
   * Prepare the prompt messages for the agent
   */
  private prepareMessages(): BaseMessagePromptTemplateLike[] {
    const messages: BaseMessagePromptTemplateLike[] = [];

    if (this.systemMessage) {
      messages.push(['system', this.systemMessage]);
    }

    messages.push(
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    );

    return messages;
  }

  /**
   * Create the chat prompt from messages
   */
  private preparePrompt(
    messages: BaseMessagePromptTemplateLike[],
  ): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages(messages);
  }

  /**
   * Execute the agent with the given input
   */
  async invoke(input: string): Promise<AIAgentResponse> {
    try {
      await this.ensureModelReady();
      await this.ensureMemoryReady();

      const messages = this.prepareMessages();
      const prompt = this.preparePrompt(messages);

      const tools = this.toolManager.getTools();

      // Create the base agent that calls tools
      const agent = createToolCallingAgent({
        llm: this.model,
        tools,
        prompt,
        streamRunnable: false,
      });

      // Disable streaming
      agent.streamRunnable = false;

      // Create the agent executor
      const executor = AgentExecutor.fromAgentAndTools({
        agent,
        memory: this.memory,
        tools,
        returnIntermediateSteps: this.returnIntermediateSteps,
        maxIterations: this.maxIterations,
      });

      // Invoke the executor with the given input
      const response = await executor.invoke({
        input,
      });

      // Clean up the response by removing internal keys
      const cleanedResponse = omit(
        response,
        'system_message',
        'formatting_instructions',
        'input',
        'chat_history',
        'agent_scratchpad',
      );

      return {
        output: cleanedResponse.output || '',
        intermediateSteps: this.returnIntermediateSteps
          ? cleanedResponse.intermediateSteps
          : undefined,
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute the agent with streaming support (if available)
   */
  async stream(
    input: string,
    onToken?: (token: string) => void,
  ): Promise<AIAgentResponse> {
    // Ensure model is ready before streaming
    await this.ensureModelReady();

    // For now, just call invoke - streaming can be added later if the model supports it
    // This is a placeholder for future streaming functionality
    return this.invoke(input);
  }

  /**
   * Get conversation history from memory
   */
  async getConversationHistory(): Promise<BaseMessage[]> {
    await this.ensureMemoryReady();

    if (!this.memory || !this.memory.chatHistory) {
      return [];
    }
    return this.memory.chatHistory.getMessages();
  }

  /**
   * Add a message to the conversation history
   */
  async addToHistory(input: string, output: string): Promise<void> {
    await this.ensureMemoryReady();

    if (this.memory) {
      await this.memory.saveContext({ input }, { output });
    }
  }
}

// Export all types and classes
export * from './types/index';
export { MemoryManager } from './memory/index';
export { ToolManager } from './tools/index';
export { ModelFactory } from './models/model-factory';
