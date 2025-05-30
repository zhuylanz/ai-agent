#!/usr/bin/env node

/**
 * PostgreSQL Memory Demo
 *
 * This script demonstrates how to use the AI Agent with PostgreSQL memory.
 * Make sure you have PostgreSQL running and the proper environment variables set.
 */

import { AIAgent, PostgresConfig } from '../src';

async function demonstratePostgresMemory() {
  console.log('🤖 AI Agent PostgreSQL Memory Demo');
  console.log('=====================================\n');

  // Configure PostgreSQL
  const postgresConfig: PostgresConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'aiagent_demo',
    user: process.env.POSTGRES_USER || 'demo_user',
    password: process.env.POSTGRES_PASSWORD || 'demo_password',
    tableName: 'demo_chat_messages',
  };

  console.log('📝 Creating AI Agent with PostgreSQL memory...');

  // Create AI Agent with PostgreSQL memory using the new constructor pattern
  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
    systemMessage:
      'You are a helpful assistant with persistent memory powered by PostgreSQL.',
    memory: {
      type: 'postgres',
      sessionId: 'demo-session-' + Date.now(),
      contextWindowLength: 10,
      postgresConfig,
    },
  });

  console.log(
    '✅ Agent created! Memory will be automatically set up on first use.\n',
  );

  // Simulate a conversation
  const conversations = [
    'Hi! My name is Alice and I love programming.',
    'What did I just tell you about myself?',
    'I also enjoy reading science fiction novels.',
    'Can you summarize what you know about me so far?',
  ];

  for (let i = 0; i < conversations.length; i++) {
    const message = conversations[i];
    console.log(`👤 User: ${message}`);

    try {
      const response = await agent.invoke(message);
      console.log(`🤖 Assistant: ${response.output}\n`);
    } catch (error) {
      console.error(`❌ Error: ${error}\n`);
      break;
    }
  }

  // Show conversation history
  try {
    console.log('📚 Retrieving conversation history from PostgreSQL...');
    const history = await agent.getConversationHistory();

    console.log(`Found ${history.length} messages in history:`);
    history.forEach((msg, index) => {
      const type = msg._getType();
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      console.log(
        `  ${index + 1}. [${type.toUpperCase()}] ${content.substring(0, 100)}${
          content.length > 100 ? '...' : ''
        }`,
      );
    });
  } catch (error) {
    console.error('❌ Error retrieving history:', error);
  }

  console.log(
    '\n🎉 Demo completed! The conversation is now stored in PostgreSQL.',
  );
  console.log(`   Table: ${postgresConfig.tableName}`);
  console.log(`   Session: ${(agent as any).sessionId}`);
}

// Handle CLI execution
if (require.main === module) {
  console.log('Starting PostgreSQL Memory Demo...\n');

  // Check environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  demonstratePostgresMemory()
    .then(() => {
      console.log('\n✅ Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      console.log('\n💡 Make sure:');
      console.log('  - PostgreSQL is running');
      console.log('  - Database exists and credentials are correct');
      console.log('  - OPENAI_API_KEY is set');
      console.log(
        '  - Required packages are installed: npm install pg @types/pg',
      );
      process.exit(1);
    });
}

export { demonstratePostgresMemory };
