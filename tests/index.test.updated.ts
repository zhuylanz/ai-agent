import { jest } from '@jest/globals';
import { AIAgent, ModelFactory } from '../src';
import { MemoryManager } from '../src/memory';
import { ToolManager } from '../src/tools';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';

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

// Mock ModelFactory
jest.mock('../src/models/model-factory', () => ({
  ModelFactory: {
    createModel: jest.fn(),
  },
}));

describe('AIAgent', () => {
  let mockModel: BaseChatModel;
  let mockModelFactory: jest.Mocked<typeof ModelFactory>;

  beforeEach(() => {
    mockModel = new MockChatModel() as unknown as BaseChatModel;
    
    // Mock ModelFactory.createModel to return our mock model
    mockModelFactory = ModelFactory as jest.Mocked<typeof ModelFactory>;
    mockModelFactory.createModel.mockResolvedValue(mockModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an agent with required options', async () => {
      const agent = new AIAgent({
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
      });

      expect(agent).toBeInstanceOf(AIAgent);

      // Wait for model initialization
      await (agent as any).ensureModelReady();
      
      expect(mockModelFactory.createModel).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      });
    });

    it('should set default values for optional options', async () => {
      const agent = new AIAgent({
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
      });

      // Wait for model initialization
      await (agent as any).ensureModelReady();

      // Access private properties through any cast for testing
      const agentAny = agent as any;
      expect(agentAny.systemMessage).toBe('You are a helpful assistant');
      expect(agentAny.maxIterations).toBe(10);
      expect(agentAny.returnIntermediateSteps).toBe(false);
    });

    it('should handle model initialization failure', async () => {
      mockModelFactory.createModel.mockRejectedValue(new Error('Invalid model config'));

      const agent = new AIAgent({
        model: {
          provider: 'openai',
          model: 'invalid-model',
        },
      });

      await expect((agent as any).ensureModelReady()).rejects.toThrow();
    });

    it('should create buffer window memory when memory config is provided', async () => {
      const agent = new AIAgent({
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
        memory: {
          type: 'buffer-window',
          contextWindowLength: 5,
        },
      });

      // Wait for memory setup to complete
      const agentAny = agent as any;
      if (agentAny.memorySetupPromise) {
        await agentAny.memorySetupPromise;
      }
      
      expect(agentAny.memory).toBeDefined();
    });
  });

  describe('tool management', () => {
    let agent: AIAgent;

    beforeEach(async () => {
      agent = new AIAgent({
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
      });
      
      // Wait for model initialization
      await (agent as any).ensureModelReady();
    });

    it('should add a custom tool', () => {
      const toolOptions = {
        name: 'test-tool',
        description: 'A test tool',
        func: async (input: string) => `Tool result: ${input}`,
      };

      agent.addTool(toolOptions);
      const tools = agent.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });

    it('should add multiple tools at once', () => {
      const toolsOptions = [
        {
          name: 'tool1',
          description: 'First tool',
          func: async (input: string) => `Tool 1: ${input}`,
        },
        {
          name: 'tool2',
          description: 'Second tool',
          func: async (input: string) => `Tool 2: ${input}`,
        },
      ];

      agent.addTools(toolsOptions);
      const tools = agent.getTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    it('should clear all tools', () => {
      const toolOptions = {
        name: 'test-tool',
        description: 'A test tool',
        func: async (input: string) => `Tool result: ${input}`,
      };

      agent.addTool(toolOptions);
      expect(agent.getTools()).toHaveLength(1);

      agent.clearTools();
      expect(agent.getTools()).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    let agent: AIAgent;

    beforeEach(async () => {
      agent = new AIAgent({
        model: {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229',
          temperature: 0.5,
        },
      });
      
      // Wait for model initialization
      await (agent as any).ensureModelReady();
    });

    it('should set system message', () => {
      const newMessage = 'You are a coding assistant';
      agent.setSystemMessage(newMessage);

      const agentAny = agent as any;
      expect(agentAny.systemMessage).toBe(newMessage);
    });

    it('should set max iterations', () => {
      const newMaxIterations = 15;
      agent.setMaxIterations(newMaxIterations);

      const agentAny = agent as any;
      expect(agentAny.maxIterations).toBe(newMaxIterations);
    });
  });

  describe('memory management', () => {
    let agent: AIAgent;

    beforeEach(async () => {
      agent = new AIAgent({
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
        memory: {
          type: 'buffer-window',
          contextWindowLength: 3,
        },
      });
      
      // Wait for initialization
      await (agent as any).ensureModelReady();
      await (agent as any).ensureMemoryReady();
    });

    it('should clear memory', async () => {
      // Add some memory first
      await agent.addToHistory('Hello', 'Hi there!');
      
      // Clear memory
      await agent.clearMemory();
      
      const history = await agent.getConversationHistory();
      expect(history).toHaveLength(0);
    });

    it('should add messages to history', async () => {
      await agent.addToHistory('Test input', 'Test output');
      
      const history = await agent.getConversationHistory();
      expect(history).toHaveLength(2); // Input and output messages
    });

    it('should get conversation history', async () => {
      const history = await agent.getConversationHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });
});

describe('ModelFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should be exported from the main module', () => {
    expect(ModelFactory).toBeDefined();
    expect(typeof ModelFactory.createModel).toBe('function');
  });
});
