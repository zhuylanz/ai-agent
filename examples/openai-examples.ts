/**
 * Example: Using the AI Agent with OpenAI
 *
 * This example shows how to use the AI Agent library with OpenAI's GPT models.
 * You'll need to set your OpenAI API key as an environment variable.
 *
 * export OPENAI_API_KEY="your-api-key-here"
 */

import { AIAgent } from '../src';
import { z } from 'zod';

async function exampleWithOpenAI() {
  // Create AI Agent with OpenAI model configuration
  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
    systemMessage: 'You are a helpful coding assistant.',
  });

  // Add a custom tool
  agent.addTool({
    name: 'calculate',
    description: 'Calculate mathematical expressions',
    schema: z.object({
      expression: z
        .string()
        .describe('The mathematical expression to calculate'),
    }),
    func: ({ expression }: { expression: string }) => {
      try {
        // Note: In production, use a proper math parser for security
        const result = eval(expression);
        return `The result of ${expression} is ${result}`;
      } catch (error) {
        return `Error calculating ${expression}: ${error}`;
      }
    },
  });

  try {
    // Use the agent
    const response = await agent.invoke('What is 15 * 24?');
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function exampleWithMemory() {
  // Create agent with memory using the new constructor pattern
  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
    memory: {
      type: 'buffer-window',
      contextWindowLength: 10,
      sessionId: 'user-123', // Optional session ID
    },
    systemMessage: 'You are a helpful assistant with memory.',
  });

  try {
    // First conversation
    const response1 = await agent.invoke('My name is John. Remember this.');
    console.log('Response 1:', response1.output);

    // Second conversation - should remember the name
    const response2 = await agent.invoke('What is my name?');
    console.log('Response 2:', response2.output);

    // View conversation history
    const history = await agent.getConversationHistory();
    console.log('Conversation history length:', history.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function exampleWithMultipleTools() {
  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
    systemMessage: 'You are a helpful assistant with access to various tools.',
    maxIterations: 10,
    returnIntermediateSteps: true, // Show intermediate steps
  });

  // Add multiple tools
  agent.addTools([
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      schema: z.object({
        city: z.string().describe('The city to get weather for'),
      }),
      func: async ({ city }: { city: string }) => {
        // Mock weather API call
        return `The weather in ${city} is sunny with 72°F`;
      },
    },
    {
      name: 'search_web',
      description: 'Search the web for information',
      schema: z.object({
        query: z.string().describe('The search query'),
      }),
      func: async ({ query }: { query: string }) => {
        // Mock web search
        return `Search results for "${query}": [Mock search results]`;
      },
    },
    {
      name: 'save_note',
      description: 'Save a note for later',
      schema: z.object({
        note: z.string().describe('The note content to save'),
      }),
      func: async ({ note }: { note: string }) => {
        console.log('Saving note:', note);
        return `Note saved: ${note}`;
      },
    },
  ]);

  try {
    const response = await agent.invoke(
      'What is the weather like in San Francisco? Also save a note that I asked about the weather.',
    );
    console.log('Response:', response.output);

    if (response.intermediateSteps) {
      console.log('Intermediate steps:');
      response.intermediateSteps.forEach((step, i) => {
        console.log(`Step ${i + 1}:`, step);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function exampleWithCustomAPIKey() {
  // Example showing how to provide API key directly in model config
  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      apiKey: 'your-api-key-here', // You can provide API key directly
    },
    systemMessage: 'You are a helpful assistant.',
  });

  try {
    const response = await agent.invoke('Hello! How are you?');
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export examples for use
export {
  exampleWithOpenAI,
  exampleWithMemory,
  exampleWithMultipleTools,
  exampleWithCustomAPIKey,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running AI Agent OpenAI examples...');

  // Uncomment to run specific examples:
  // exampleWithOpenAI();
  // exampleWithMemory();
  exampleWithMultipleTools();
  // exampleWithCustomAPIKey();
}
