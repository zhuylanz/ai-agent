/**
 * Example: Using the AI Agent with OpenAI
 *
 * This example shows how to use the AI Agent library with OpenAI's GPT models.
 * You'll need to install @langchain/openai and set your OpenAI API key.
 *
 * npm install @langchain/openai
 * export OPENAI_API_KEY="your-api-key-here"
 */

import { AIAgent } from '../src';
import { ChatOpenAI } from '@langchain/openai';

async function exampleWithOpenAI() {
  // Create OpenAI model
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.7,
  });

  // Create AI Agent with simple configuration
  const agent = new AIAgent({
    model,
    systemMessage: 'You are a helpful coding assistant.',
  });

  // Add a custom tool
  agent.addTool({
    name: 'calculate',
    description: 'Calculate mathematical expressions',
    func: (expression: string) => {
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
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  // Create agent with memory
  const agent = new AIAgent({
    model,
    memory: {
      type: 'buffer-window',
      contextWindowLength: 10,
    },
  });

  // Setup memory for the agent
  await agent.setupMemory('user-123', {
    type: 'buffer-window',
    contextWindowLength: 10,
  });

  try {
    // First conversation
    const response1 = await agent.invoke('My name is John. Remember this.');
    console.log('Response 1:', response1.output);

    // Second conversation - should remember the name
    const response2 = await agent.invoke('What is my name?');
    console.log('Response 2:', response2.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function exampleWithMultipleTools() {
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agent = new AIAgent({
    model,
    systemMessage: 'You are a helpful assistant with access to various tools.',
    maxIterations: 10,
  });

  // Add multiple tools
  agent.addTools([
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      func: async (city: string) => {
        // Mock weather API call
        return `The weather in ${city} is sunny with 72°F`;
      },
    },
    {
      name: 'search_web',
      description: 'Search the web for information',
      func: async (query: string) => {
        // Mock web search
        return `Search results for "${query}": [Mock search results]`;
      },
    },
    {
      name: 'save_note',
      description: 'Save a note for later',
      func: async (note: string) => {
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
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export examples for use
export { exampleWithOpenAI, exampleWithMemory, exampleWithMultipleTools };

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running AI Agent examples...');
  console.log('Note: You need to set OPENAI_API_KEY environment variable');

  // Uncomment to run specific examples:
  // exampleWithOpenAI();
  exampleWithMemory();
  // exampleWithMultipleTools();
}
