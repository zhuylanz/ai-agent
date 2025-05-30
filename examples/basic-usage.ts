import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicTool } from '@langchain/core/tools';
import { AIAgent } from '../src';

// Example 1: Simple AI Agent with OpenAI
async function simpleExample() {
  console.log('=== Simple AI Agent Example ===');

  const model = new ChatOpenAI({
    temperature: 0.7,
    model: 'gpt-4o-mini',
  });

  const agent = new AIAgent({
    model,
    systemMessage:
      'You are a helpful assistant that answers questions concisely.',
  });

  const response = await agent.invoke('What is the capital of France?');
  console.log('Response:', response.output);
}

// Example 2: AI Agent with Memory
async function memoryExample() {
  console.log('\\n=== AI Agent with Memory Example ===');

  const model = new ChatOpenAI({
    temperature: 0.7,
    model: 'gpt-4o-mini',
  });

  const agent = new AIAgent({
    model,
    memory: {
      type: 'buffer-window',
      contextWindowLength: 5, // Keep last 5 message pairs in memory
    },
    systemMessage:
      'You are a helpful assistant with memory of our conversation.',
  });

  console.log('First message:');
  const response1 = await agent.invoke(
    'My name is John. What should I call you?',
  );
  console.log('Response:', response1.output);

  console.log('\\nSecond message:');
  const response2 = await agent.invoke('What is my name?');
  console.log('Response:', response2.output);

  console.log('\\nConversation history:');
  const history = await agent.getConversationHistory();
  history.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg._getType()}: ${msg.content}`);
  });
}

// Example 3: AI Agent with Custom Tools
async function toolsExample() {
  console.log('\\n=== AI Agent with Tools Example ===');

  const model = new ChatOpenAI({
    temperature: 0.7,
    model: 'gpt-4o-mini',
  });

  const agent = new AIAgent({
    model,
    systemMessage:
      'You are a helpful assistant with access to calculation and weather tools.',
    maxIterations: 5,
    returnIntermediateSteps: true,
  });

  // Add a calculator tool
  agent.addTool({
    name: 'calculator',
    description:
      'Perform basic arithmetic calculations. Input should be a mathematical expression like "2 + 2" or "10 * 5".',
    func: async (expression: string) => {
      try {
        // Simple evaluation (in production, use a safer math parser)
        const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
        return `The result of ${expression} is ${result}`;
      } catch (error) {
        return `Error calculating ${expression}: Invalid expression`;
      }
    },
  });

  // Add a weather tool (mock)
  agent.addTool({
    name: 'get_weather',
    description: 'Get current weather for a city. Input should be a city name.',
    func: async (city: string) => {
      // Mock weather data
      const weather = ['sunny', 'cloudy', 'rainy', 'snowy'];
      const temp = Math.floor(Math.random() * 30) + 10;
      const condition = weather[Math.floor(Math.random() * weather.length)];
      return `The weather in ${city} is ${condition} with a temperature of ${temp}°C`;
    },
  });

  const response = await agent.invoke(
    'What is 15 + 27? Also, what is the weather like in Paris?',
  );
  console.log('Response:', response.output);

  if (response.intermediateSteps) {
    console.log('\\nIntermediate steps:');
    response.intermediateSteps.forEach((step, i) => {
      console.log(`Step ${i + 1}:`, JSON.stringify(step, null, 2));
    });
  }
}

// Example 4: AI Agent with Anthropic Claude
async function anthropicExample() {
  console.log('\\n=== AI Agent with Anthropic Claude ===');

  const model = new ChatAnthropic({
    temperature: 0.7,
    model: 'claude-3-sonnet-20240229',
  });

  const agent = new AIAgent({
    model,
    systemMessage:
      'You are Claude, an AI assistant created by Anthropic. Be helpful, harmless, and honest.',
    memory: {
      type: 'buffer-window',
      contextWindowLength: 10,
    },
  });

  const response = await agent.invoke(
    'Explain the concept of machine learning in simple terms.',
  );
  console.log('Response:', response.output);
}

// Example 5: Advanced Configuration
async function advancedExample() {
  console.log('\\n=== Advanced AI Agent Configuration ===');

  const model = new ChatOpenAI({
    temperature: 0.3,
    model: 'gpt-4',
  });

  const agent = new AIAgent({
    model,
    systemMessage: `You are an expert data analyst. You help users understand data and provide insights.
                   When using tools, explain what you're doing and why.`,
    maxIterations: 10,
    returnIntermediateSteps: true,
    memory: {
      type: 'buffer-window',
      contextWindowLength: 8,
    },
  });

  // Add a data analysis tool
  agent.addTool({
    name: 'analyze_data',
    description:
      'Analyze a dataset and provide statistics. Input should be a description of the data to analyze.',
    func: async (dataDescription: string) => {
      // Mock data analysis
      return `Analysis of ${dataDescription}:
      - Total records: ${Math.floor(Math.random() * 1000) + 100}
      - Mean value: ${(Math.random() * 100).toFixed(2)}
      - Standard deviation: ${(Math.random() * 20).toFixed(2)}
      - Outliers detected: ${Math.floor(Math.random() * 5)}`;
    },
  });

  // Add a visualization tool
  agent.addTool({
    name: 'create_chart',
    description:
      'Create a chart description for visualizing data. Input should specify the chart type and data.',
    func: async (chartRequest: string) => {
      return `Chart created: ${chartRequest}
      Recommended visualization: Bar chart with trending line
      Best practices applied: Clear labels, appropriate color scheme, readable fonts`;
    },
  });

  const response = await agent.invoke(
    'I have sales data for the past year. Can you help me analyze it and suggest visualizations?',
  );

  console.log('Response:', response.output);
}

// Run examples
async function runExamples() {
  try {
    // Note: You need to set your API keys as environment variables:
    // OPENAI_API_KEY for OpenAI examples
    // ANTHROPIC_API_KEY for Anthropic examples

    await simpleExample();
    await memoryExample();
    await toolsExample();

    // Uncomment if you have Anthropic API key
    // await anthropicExample();

    await advancedExample();
  } catch (error) {
    console.error('Error running examples:', error);
    console.log(
      '\\nNote: Make sure to set your API keys as environment variables:',
    );
    console.log('- OPENAI_API_KEY for OpenAI examples');
    console.log('- ANTHROPIC_API_KEY for Anthropic examples');
  }
}

// Export for use in other files
export {
  simpleExample,
  memoryExample,
  toolsExample,
  anthropicExample,
  advancedExample,
};

// Run if this file is executed directly
if (require.main === module) {
  runExamples();
}
