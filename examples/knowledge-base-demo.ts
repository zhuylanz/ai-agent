#!/usr/bin/env node

/**
 * Knowledge Base Demo
 *
 * This script demonstrates how to use the AI Agent with automatic vector search tools
 * created from knowledge base configurations.
 * Make sure you have PostgreSQL with pgvector extension running and proper environment variables set.
 */

import { AIAgent, KnowledgeBaseConfig } from '../src';

async function demonstrateKnowledgeBase() {
  console.log('🤖 AI Agent Knowledge Base Demo');
  console.log('==================================\n');

  // Configure knowledge bases with simple embeddings configuration
  const knowledgeBases: KnowledgeBaseConfig[] = [
    {
      name: 'company_kb',
      description:
        'Search through company documentation, policies, and procedures. Use this when the user asks about company-related information, HR policies, or internal procedures.',
      pgConfig: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'aiagent_demo',
        user: process.env.POSTGRES_USER || 'demo_user',
        password: process.env.POSTGRES_PASSWORD || 'demo_password',
        tableName: 'company_kb',
      },
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY,
      },
      topK: 5,
      includeMetadata: true,
    },
    {
      name: 'technical_kb',
      description:
        'Search through technical documentation, API references, and coding guidelines. Use this when the user asks technical questions about software development, APIs, or coding practices.',
      pgConfig: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'aiagent_demo',
        user: process.env.POSTGRES_USER || 'demo_user',
        password: process.env.POSTGRES_PASSWORD || 'demo_password',
        tableName: 'technical_kb',
      },
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: process.env.OPENAI_API_KEY,
      },
      topK: 3,
      includeMetadata: true,
    },
  ];

  console.log('📝 Creating AI Agent with knowledge base tools...');

  // Create AI Agent with automatic vector search tools
  const agent = new AIAgent({
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
    systemMessage: `You are a helpful assistant with access to company knowledge bases. 
You have access to the following knowledge bases:
- Company documentation (policies, procedures, HR info) - use search_company_kb tool
- Technical documentation (APIs, coding guidelines, development practices) - use search_technical_kb tool

IMPORTANT: When a user asks a question, you MUST search the relevant knowledge base first before providing an answer. Always use the appropriate search tool based on the type of question:
- For company, HR, policy, or procedure questions: use search_company_kb
- For technical, development, coding, or API questions: use search_technical_kb

Do not provide answers from your general knowledge without first searching the knowledge bases.`,
    knowledgeBases,
    memory: {
      type: 'buffer-window',
      contextWindowLength: 10,
    },
    returnIntermediateSteps: true,
  });

  console.log(
    '✅ Agent created! Initializing knowledge base search tools...\n',
  );

  // Display available tools (wait for initialization)
  console.log('🔧 Available tools:');
  const tools = await agent.getToolsAsync();
  tools.forEach((tool, index) => {
    console.log(`  ${index + 1}. ${tool.name} - ${tool.description}`);
  });
  console.log();

  // Simulate a conversation with knowledge base searches
  const questions = [
    "What's our company's vacation policy?",
    'How do I implement authentication in our API?',
    'What are the steps for onboarding new employees?',
    'Can you show me the coding standards for TypeScript?',
  ];

  for (const question of questions) {
    console.log(`👤 User: ${question}`);

    try {
      const response = await agent.invoke(question);
      console.log(`🤖 Assistant: ${response.output}\n`);

      if (response.error) {
        console.log(`❌ Error in response: ${response.error}\n`);
      }

      if (response.intermediateSteps && response.intermediateSteps.length > 0) {
        console.log('🔍 Tools used in this response:');
        response.intermediateSteps.forEach((step: any, index: number) => {
          if (step.action && step.action.tool) {
            console.log(
              `  - ${step.action.tool}: ${JSON.stringify(
                step.action.toolInput,
              )}`,
            );
            console.log(`  - Observation: ${step.observation}`);
          }
        });
        console.log();
      } else {
        console.log('ℹ️ No tools were called for this response\n');
      }
    } catch (error) {
      console.error(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  console.log('✨ Demo completed!');
}

// Handle environment validation
function validateEnvironment() {
  const required = ['OPENAI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }

  console.log('💡 Optional environment variables for PostgreSQL:');
  console.log('   - POSTGRES_HOST (default: localhost)');
  console.log('   - POSTGRES_PORT (default: 5432)');
  console.log('   - POSTGRES_DB (default: aiagent_demo)');
  console.log('   - POSTGRES_USER (default: demo_user)');
  console.log('   - POSTGRES_PASSWORD (default: demo_password)\n');
}

// Run the demo
if (require.main === module) {
  validateEnvironment();
  demonstrateKnowledgeBase().catch(console.error);
}

export { demonstrateKnowledgeBase };
