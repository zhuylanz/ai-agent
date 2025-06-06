/**
 * Example: Using the AI Agent with Anthropic Claude
 *
 * This example shows how to use the AI Agent library with Anthropic's Claude models.
 * You'll need to set your Anthropic API key as an environment variable.
 *
 * export ANTHROPIC_API_KEY="your-api-key-here"
 */

import { AIAgent } from '../src';
import { z } from 'zod';

async function exampleWithClaude() {
  // Create AI Agent with Anthropic model configuration
  const agent = new AIAgent({
    model: {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
    },
    systemMessage: 'You are Claude, a helpful AI assistant created by Anthropic.',
    maxIterations: 8,
    returnIntermediateSteps: true, // Get detailed steps
  });

  // Add tools for file operations
  agent.addTools([
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      schema: z.object({
        filename: z.string().describe('The name of the file to read'),
      }),
      func: async ({ filename }: { filename: string }) => {
        // Mock file reading
        return `Contents of ${filename}: [File content here]`;
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      schema: z.object({
        filename: z.string().describe('The name of the file to write to'),
        content: z.string().describe('The content to write to the file'),
      }),
      func: async ({ filename, content }: { filename: string; content: string }) => {
        // Mock file writing
        console.log(`Writing to ${filename}: ${content}`);
        return `Successfully wrote to ${filename}`;
      },
    },
  ]);

  try {
    const response = await agent.invoke(
      'Please read the file "config.json" and then create a backup by writing the same content to "config.backup.json"'
    );

    console.log('Final Response:', response.output);

    if (response.intermediateSteps) {
      console.log('Intermediate Steps:');
      response.intermediateSteps.forEach((step, index) => {
        console.log(`Step ${index + 1}:`, step);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function exampleWithSummaryMemory() {
  // Create agent with summary memory using the new constructor pattern
  const agent = new AIAgent({
    model: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307', // Faster model for summarization
      temperature: 0.7,
    },
    memory: {
      type: 'summary',
      sessionId: 'user-456',
    },
    systemMessage: 'You are Claude, helping with a web development project.',
  });

  try {
    // Simulate a long conversation
    const conversations = [
      'I am working on a project to build a web application using React.',
      'The application will have user authentication and a dashboard.',
      'I need help with setting up the routing and state management.',
      'Can you remember what we discussed and suggest the next steps?',
    ];

    for (const [index, message] of conversations.entries()) {
      console.log(`\n--- Conversation ${index + 1} ---`);
      console.log('User:', message);

      const response = await agent.invoke(message);
      console.log('Assistant:', response.output);
    }

    // Show conversation history
    const history = await agent.getConversationHistory();
    console.log('\nConversation history length:', history.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function exampleWithCustomAPIKey() {
  // Example showing how to provide API key directly in model config
  const agent = new AIAgent({
    model: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.5,
      apiKey: 'your-anthropic-api-key-here', // You can provide API key directly
    },
    systemMessage: 'You are Claude, a helpful assistant.',
  });

  try {
    const response = await agent.invoke('Hello! Can you tell me about yourself?');
    console.log('Response:', response.output);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export examples for use
export {
  exampleWithClaude,
  exampleWithSummaryMemory,
  exampleWithCustomAPIKey,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running Anthropic Claude examples...');
  console.log('Note: You need to set ANTHROPIC_API_KEY environment variable');

  // Uncomment to run specific examples:
  // exampleWithClaude();
  // exampleWithSummaryMemory();
  // exampleWithCustomAPIKey();
}
