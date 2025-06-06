import type { Embeddings } from '@langchain/core/embeddings';
import { EmbeddingsConfig } from '../types';

export class EmbeddingsFactory {
  static async createEmbeddings(config: EmbeddingsConfig): Promise<Embeddings> {
    const { provider, model, apiKey } = config;

    switch (provider) {
      case 'openai': {
        try {
          const { OpenAIEmbeddings } = await import('@langchain/openai');
          return new OpenAIEmbeddings({
            modelName: model,
            apiKey: apiKey || process.env.OPENAI_API_KEY,
          });
        } catch (error) {
          throw new Error(
            'OpenAI embeddings provider requires @langchain/openai to be installed. Run: npm install @langchain/openai',
          );
        }
      }

      case 'cohere': {
        try {
          const { CohereEmbeddings } = await import('@langchain/community/embeddings/cohere');
          return new CohereEmbeddings({
            apiKey: apiKey || process.env.COHERE_API_KEY,
            // Note: Model name is often built into the CohereEmbeddings class
            // If you need to specify a model, you might need to check Cohere's documentation
          });
        } catch (error) {
          throw new Error(
            'Cohere embeddings provider requires @langchain/community to be installed. Run: npm install @langchain/community',
          );
        }
      }

      case 'huggingface': {
        try {
          const { HuggingFaceInferenceEmbeddings } = await import('@langchain/community/embeddings/hf');
          return new HuggingFaceInferenceEmbeddings({
            model,
            apiKey: apiKey || process.env.HUGGINGFACEHUB_API_TOKEN,
          });
        } catch (error) {
          throw new Error(
            'HuggingFace embeddings provider requires @langchain/community to be installed. Run: npm install @langchain/community',
          );
        }
      }

      default:
        throw new Error(
          `Unsupported embeddings provider: ${provider}. Supported providers: openai, cohere, huggingface`,
        );
    }
  }
}
