import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseChatMemory,
  BufferWindowMemory,
  ConversationSummaryMemory,
  BufferMemory,
} from 'langchain/memory';
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import { Pool } from 'pg';
import { MemoryConfig } from '../types';

export class MemoryManager {
  private static memories: Map<
    string,
    { memory: BaseChatMemory; lastAccessed: Date }
  > = new Map();

  /**
   * Create or retrieve a memory instance
   */
  static async getMemory(
    sessionId: string,
    options: MemoryConfig = {},
    model?: BaseChatModel,
  ): Promise<BaseChatMemory> {
    // Clean up old memories (older than 1 hour)
    this.cleanupStaleMemories();

    const key = `${sessionId}_${options.type}`;
    let memoryInstance = this.memories.get(key);

    if (memoryInstance) {
      memoryInstance.lastAccessed = new Date();
      return memoryInstance.memory;
    }

    // Create new memory based on type
    let memory: BaseChatMemory;

    switch (options.type) {
      case 'buffer-window':
        memory = new BufferWindowMemory({
          k: options.contextWindowLength || 10,
          inputKey: 'input',
          memoryKey: 'chat_history',
          outputKey: 'output',
          returnMessages: true,
        });
        break;

      case 'summary':
        if (!model) {
          throw new Error('Model is required for summary memory');
        }
        memory = new ConversationSummaryMemory({
          llm: model,
          inputKey: 'input',
          memoryKey: 'chat_history',
          outputKey: 'output',
          returnMessages: true,
        });
        break;

      case 'postgres':
        if (!options.postgresConfig) {
          throw new Error(
            'PostgreSQL configuration is required for postgres memory',
          );
        }

        // Create PostgreSQL connection pool
        const pool = new Pool({
          host: options.postgresConfig.host,
          port: options.postgresConfig.port || 5432,
          database: options.postgresConfig.database,
          user: options.postgresConfig.user,
          password: options.postgresConfig.password,
          ssl: false, // Configure SSL as needed
        });

        // Create PostgreSQL chat message history
        const pgChatHistory = new PostgresChatMessageHistory({
          pool,
          sessionId,
          tableName: options.postgresConfig.tableName || 'chat_messages',
        });

        // Create memory with PostgreSQL history
        memory = new BufferWindowMemory({
          k: options.contextWindowLength || 10,
          chatHistory: pgChatHistory,
          inputKey: 'input',
          memoryKey: 'chat_history',
          outputKey: 'output',
          returnMessages: true,
        });
        break;

      default:
        // Default to buffer window memory
        memory = new BufferWindowMemory({
          k: options.contextWindowLength || 10,
          inputKey: 'input',
          memoryKey: 'chat_history',
          outputKey: 'output',
          returnMessages: true,
        });
        break;
    }

    this.memories.set(key, {
      memory,
      lastAccessed: new Date(),
    });

    return memory;
  }

  /**
   * Clear memory for a specific session
   */
  static async clearMemory(sessionId: string, type?: string): Promise<void> {
    if (type) {
      const key = `${sessionId}_${type}`;
      const memoryInstance = this.memories.get(key);
      if (memoryInstance) {
        await memoryInstance.memory.clear();
        this.memories.delete(key);
      }
    } else {
      // Clear all memories for this session
      const keysToDelete: string[] = [];
      for (const [key, memoryInstance] of this.memories.entries()) {
        if (key.startsWith(`${sessionId}_`)) {
          await memoryInstance.memory.clear();
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.memories.delete(key));
    }
  }

  /**
   * Clean up memories that haven't been accessed in the last hour
   */
  private static cleanupStaleMemories(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [key, memoryInstance] of this.memories.entries()) {
      if (memoryInstance.lastAccessed < oneHourAgo) {
        memoryInstance.memory.clear().catch(console.error);
        this.memories.delete(key);
      }
    }
  }

  /**
   * Create a simple buffer window memory with context length
   */
  static createBufferWindowMemory(
    contextWindowLength: number = 10,
  ): BufferWindowMemory | BufferMemory {
    if (contextWindowLength === 0) {
      return new BufferMemory({
        inputKey: 'input',
        memoryKey: 'chat_history',
        outputKey: 'output',
        returnMessages: true,
      });
    }

    return new BufferWindowMemory({
      k: contextWindowLength,
      inputKey: 'input',
      memoryKey: 'chat_history',
      outputKey: 'output',
      returnMessages: true,
    });
  }

  /**
   * Create PostgreSQL memory with configuration
   */
  static async createPostgresMemory(
    sessionId: string,
    postgresConfig: any,
    contextWindowLength: number = 10,
  ): Promise<BaseChatMemory> {
    const pool = new Pool({
      host: postgresConfig.host,
      port: postgresConfig.port || 5432,
      database: postgresConfig.database,
      user: postgresConfig.user,
      password: postgresConfig.password,
      ssl: false, // Configure SSL as needed
    });

    const pgChatHistory = new PostgresChatMessageHistory({
      pool,
      sessionId,
      tableName: postgresConfig.tableName || 'chat_messages',
    });

    return new BufferWindowMemory({
      k: contextWindowLength,
      chatHistory: pgChatHistory,
      inputKey: 'input',
      memoryKey: 'chat_history',
      outputKey: 'output',
      returnMessages: true,
    });
  }
}
