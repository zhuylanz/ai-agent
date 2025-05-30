import { jest } from '@jest/globals';
import { AIAgent } from '../src';
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

describe('AIAgent', () => {
  let mockModel: BaseChatModel;

  beforeEach(() => {
    mockModel = new MockChatModel() as unknown as BaseChatModel;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an agent with required options', () => {
      const agent = new AIAgent({
        model: mockModel,
      });

      expect(agent).toBeInstanceOf(AIAgent);
    });

    it('should set default values for optional options', () => {
      const agent = new AIAgent({
        model: mockModel,
      });

      // Access private properties through any cast for testing
      const agentAny = agent as any;
      expect(agentAny.systemMessage).toBe('You are a helpful assistant');
      expect(agentAny.maxIterations).toBe(10);
      expect(agentAny.returnIntermediateSteps).toBe(false);
    });

    it('should throw error if model does not support tool calling', () => {
      const invalidModel = { lc_namespace: ['chat_models'] } as BaseChatModel;

      expect(() => {
        new AIAgent({ model: invalidModel });
      }).toThrow('AI Agent requires a Chat Model which supports Tools calling');
    });

    it('should create buffer window memory when memory config is provided', async () => {
      const agent = new AIAgent({
        model: mockModel,
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

    beforeEach(() => {
      agent = new AIAgent({ model: mockModel });
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

    it('should add multiple tools', () => {
      const toolOptions = [
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

      agent.addTools(toolOptions);
      const tools = agent.getTools();

      expect(tools).toHaveLength(2);
    });

    it('should clear all tools', () => {
      agent.addTool({
        name: 'test-tool',
        description: 'A test tool',
        func: async () => 'result',
      });

      expect(agent.getTools()).toHaveLength(1);

      agent.clearTools();
      expect(agent.getTools()).toHaveLength(0);
    });
  });

  describe('configuration methods', () => {
    let agent: AIAgent;

    beforeEach(() => {
      agent = new AIAgent({ model: mockModel });
    });

    it('should update system message', () => {
      agent.setSystemMessage('New system message');
      const agentAny = agent as any;

      expect(agentAny.systemMessage).toBe('New system message');
    });

    it('should update max iterations', () => {
      agent.setMaxIterations(15);
      const agentAny = agent as any;

      expect(agentAny.maxIterations).toBe(15);
    });
  });

  describe('memory operations', () => {
    let agent: AIAgent;

    beforeEach(() => {
      agent = new AIAgent({
        model: mockModel,
        memory: {
          type: 'buffer-window',
          contextWindowLength: 5,
        },
      });
    });

    it('should setup memory for a session', async () => {
      await agent.setupMemory({
        type: 'buffer-window',
        contextWindowLength: 3,
      });

      // Verify the agent has memory
      const agentAny = agent as any;
      expect(agentAny.memory).toBeDefined();
    });

    it('should clear memory', async () => {
      const agentAny = agent as any;
      const mockClear = jest.fn();
      agentAny.memory = { clear: mockClear };

      await agent.clearMemory();
      expect(mockClear).toHaveBeenCalled();
    });
  });
});

describe('MemoryManager', () => {
  it('should create buffer window memory', () => {
    const memory = MemoryManager.createBufferWindowMemory(5);
    expect(memory).toBeDefined();
  });

  it('should get memory for a session', async () => {
    const memory = await MemoryManager.getMemory('test-session', {
      type: 'buffer-window',
    });

    expect(memory).toBeDefined();
  });

  it('should clear memory for a session', async () => {
    // First create memory
    await MemoryManager.getMemory('test-session', {
      type: 'buffer-window',
    });

    // Then clear it
    await MemoryManager.clearMemory('test-session');

    // This should pass without throwing
    expect(true).toBe(true);
  });
});

describe('ToolManager', () => {
  let toolManager: ToolManager;

  beforeEach(() => {
    toolManager = new ToolManager();
  });

  it('should add a tool', () => {
    toolManager.addTool({
      name: 'test-tool',
      description: 'A test tool',
      func: async () => 'result',
    });

    const tools = toolManager.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test-tool');
  });

  it('should remove a tool by name', () => {
    toolManager.addTool({
      name: 'test-tool',
      description: 'A test tool',
      func: async () => 'result',
    });

    expect(toolManager.getTools()).toHaveLength(1);

    const removed = toolManager.removeTool('test-tool');
    expect(removed).toBe(true);
    expect(toolManager.getTools()).toHaveLength(0);
  });

  it('should return false when removing non-existent tool', () => {
    const removed = toolManager.removeTool('non-existent');
    expect(removed).toBe(false);
  });

  it('should get tool by name', () => {
    toolManager.addTool({
      name: 'test-tool',
      description: 'A test tool',
      func: async () => 'result',
    });

    const tool = toolManager.getTool('test-tool');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('test-tool');
  });

  it('should return undefined for non-existent tool', () => {
    const tool = toolManager.getTool('non-existent');
    expect(tool).toBeUndefined();
  });

  it('should clear all tools', () => {
    toolManager.addTool({
      name: 'tool1',
      description: 'Tool 1',
      func: async () => 'result1',
    });

    toolManager.addTool({
      name: 'tool2',
      description: 'Tool 2',
      func: async () => 'result2',
    });

    expect(toolManager.getTools()).toHaveLength(2);

    toolManager.clearTools();
    expect(toolManager.getTools()).toHaveLength(0);
  });
});
