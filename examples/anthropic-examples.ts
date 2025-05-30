/**
 * Example: Using the AI Agent with Anthropic Claude
 *
 * This example shows how to use the AI Agent library with Anthropic's Claude models.
 * You'll need to install @langchain/anthropic and set your Anthropic API key.
 *
 * npm install @langchain/anthropic
 * export ANTHROPIC_API_KEY="your-api-key-here"
 */

import { AIAgent } from '../src';
import { ChatAnthropic } from '@langchain/anthropic';

async function exampleWithClaude() {
  // Create Anthropic model
  const model = new ChatAnthropic({
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
  });

  // Create AI Agent
  const agent = new AIAgent({
    model,
    systemMessage: 'You are Claude, a helpful AI assistant created by Anthropic.',
    maxIterations: 8,
    returnIntermediateSteps: true, // Get detailed steps
  });

  // Add tools for file operations
  agent.addTools([
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      func: async (filename: string) => {
        // Mock file reading
        return `Contents of ${filename}: [File content here]`;
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      func: async (args: string) => {
        const { filename, content } = JSON.parse(args);
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
  const model = new ChatAnthropic({
    model: 'claude-3-haiku-20240307', // Faster model for summarization
  });

  // Create agent with summary memory (good for long conversations)
  const agent = AIAgent.createWithMemory(model, 'user-456', {
    type: 'summary',
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
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export examples for use
export {
  exampleWithClaude,
  exampleWithSummaryMemory,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running Anthropic Claude examples...');
  console.log('Note: You need to set ANTHROPIC_API_KEY environment variable');

  // Uncomment to run specific examples:
  // exampleWithClaude();
  // exampleWithSummaryMemory();
}
