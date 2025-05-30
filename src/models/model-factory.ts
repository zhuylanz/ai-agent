import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ModelConfig } from '../types';

export class ModelFactory {
  static async createModel(config: ModelConfig): Promise<BaseChatModel> {
    const { provider, model, temperature = 0.7, maxTokens, apiKey } = config;

    switch (provider) {
      case 'openai': {
        try {
          const { ChatOpenAI } = await import('@langchain/openai');
          return new ChatOpenAI({
            model,
            temperature,
            maxTokens,
            apiKey: apiKey || process.env.OPENAI_API_KEY,
          });
        } catch (error) {
          throw new Error(
            'OpenAI provider requires @langchain/openai to be installed. Run: npm install @langchain/openai',
          );
        }
      }

      case 'anthropic': {
        try {
          const { ChatAnthropic } = await import('@langchain/anthropic');
          return new ChatAnthropic({
            model,
            temperature,
            maxTokens,
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
          });
        } catch (error) {
          throw new Error(
            'Anthropic provider requires @langchain/anthropic to be installed. Run: npm install @langchain/anthropic',
          );
        }
      }

      default:
        throw new Error(
          `Unsupported provider: ${provider}. Supported providers: openai, anthropic`,
        );
    }
  }
}
