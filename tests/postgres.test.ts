import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIAgent } from '../src';
import { MemoryManager } from '../src/memory';
import type { PostgresConfig } from '../src/types';

// Create mock implementations
const mockPool = {
  query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
  end: jest.fn(() => Promise.resolve()),
};

const mockPostgresChatMessageHistory = {
  getMessages: jest.fn(() => Promise.resolve([])),
  addMessage: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
};

// Mock the modules before importing anything else
jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

jest.mock('@langchain/community/stores/message/postgres', () => ({
  PostgresChatMessageHistory: jest.fn(() => mockPostgresChatMessageHistory),
}));

// Mock ChatModel for testing
class MockChatModel {
  public bindTools = jest.fn();
  public lc_namespace = ['chat_models'];

  constructor() {
    this.bindTools.mockReturnValue(this);
  }

  async invoke(input: any): Promise<any> {
    return {
      content: `Mock response to: ${input}`,
    };
  }
}

describe('PostgreSQL Memory Integration', () => {
  let mockModel: any;
  const mockPostgresConfig: PostgresConfig = {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_password',
    tableName: 'test_chat_messages',
  };

  beforeEach(() => {
    mockModel = new MockChatModel();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any created memories
    await MemoryManager.clearMemory('test-session', 'postgres');
  });

  describe('MemoryManager.getMemory with postgres type', () => {
    test('should create postgres memory with configuration', async () => {
      const memory = await MemoryManager.getMemory(
        'test-session',
        {
          type: 'postgres',
          contextWindowLength: 5,
          postgresConfig: mockPostgresConfig,
        },
        mockModel,
      );

      expect(memory).toBeDefined();
      expect(memory.memoryKeys).toContain('chat_history');
    });

    test('should throw error when postgres config is missing', async () => {
      await expect(
        MemoryManager.getMemory(
          'test-session',
          {
            type: 'postgres',
          },
          mockModel,
        )
      ).rejects.toThrow('PostgreSQL configuration is required for postgres memory');
    });

    test('should use default table name when not specified', async () => {
      const configWithoutTableName = {
        ...mockPostgresConfig,
        tableName: undefined,
      };

      const memory = await MemoryManager.getMemory(
        'test-session',
        {
          type: 'postgres',
          postgresConfig: configWithoutTableName,
        },
        mockModel,
      );

      expect(memory).toBeDefined();
    });

    test('should use default context window length when not specified', async () => {
      const memory = await MemoryManager.getMemory(
        'test-session',
        {
          type: 'postgres',
          postgresConfig: mockPostgresConfig,
        },
        mockModel,
      );

      expect(memory).toBeDefined();
    });
  });

  describe('MemoryManager.createPostgresMemory', () => {
    test('should create postgres memory directly', async () => {
      const memory = await MemoryManager.createPostgresMemory(
        'test-session',
        mockPostgresConfig,
        8
      );

      expect(memory).toBeDefined();
      expect(memory.memoryKeys).toContain('chat_history');
    });

    test('should use default context window length', async () => {
      const memory = await MemoryManager.createPostgresMemory(
        'test-session',
        mockPostgresConfig
      );

      expect(memory).toBeDefined();
    });
  });

  describe('AIAgent with PostgreSQL memory', () => {
    test('should create agent with postgres memory configuration', async () => {
      const agent = new AIAgent({
        model: mockModel,
        memory: {
          type: 'postgres',
          sessionId: 'test-session',
          postgresConfig: mockPostgresConfig,
        },
      });

      expect(agent).toBeInstanceOf(AIAgent);
    });

    test('should setup postgres memory and respond to messages', async () => {
      const agent = new AIAgent({
        model: mockModel,
        memory: {
          type: 'postgres',
          sessionId: 'test-session',
          contextWindowLength: 5,
          postgresConfig: mockPostgresConfig,
        },
      });

      // Wait for memory setup
      await new Promise(resolve => setTimeout(resolve, 100));

      // The agent should work normally
      expect(agent).toBeInstanceOf(AIAgent);
    });

    test('should handle auto-generated session ID with postgres memory', async () => {
      const agent = new AIAgent({
        model: mockModel,
        memory: {
          type: 'postgres',
          // No sessionId provided - should be auto-generated
          postgresConfig: mockPostgresConfig,
        },
      });

      expect(agent).toBeInstanceOf(AIAgent);
      // Session ID should be auto-generated
      const sessionId = (agent as any).sessionId;
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });
  });

  describe('Error handling', () => {
    test('should handle postgres connection errors gracefully', async () => {
      const failingConfig = {
        ...mockPostgresConfig,
        host: 'nonexistent-host',
      };

      // This should not throw during creation, only during actual usage
      const memory = await MemoryManager.getMemory(
        'test-session',
        {
          type: 'postgres',
          postgresConfig: failingConfig,
        },
        mockModel,
      );

      expect(memory).toBeDefined();
    });

    test('should provide helpful error message for missing config', async () => {
      await expect(
        MemoryManager.getMemory(
          'test-session',
          {
            type: 'postgres',
            // Missing postgresConfig
          },
          mockModel,
        )
      ).rejects.toThrow('PostgreSQL configuration is required for postgres memory');
    });
  });
});
