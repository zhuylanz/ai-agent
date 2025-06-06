import {
  PGVectorStore,
  type PGVectorStoreArgs,
} from '@langchain/community/vectorstores/pgvector';
import type { Document } from '@langchain/core/documents';
import type { Embeddings } from '@langchain/core/embeddings';
import type { VectorStore } from '@langchain/core/vectorstores';
import type pg from 'pg';
import { z } from 'zod';
import { ToolOptions } from '../types';

// Configuration interfaces for PGVector
export interface PGVectorConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  tableName?: string;
  collectionName?: string;
  collectionTableName?: string;
  columns?: {
    idColumnName?: string;
    vectorColumnName?: string;
    contentColumnName?: string;
    metadataColumnName?: string;
  };
}

export interface RetrieveDocumentsConfig {
  pgConfig: PGVectorConfig;
  embeddings: Embeddings;
  topK?: number;
  includeMetadata?: boolean;
  metadataFilter?: Record<string, any>;
}

/**
 * Extended PGVectorStore class to handle custom filtering.
 * This wrapper is necessary because when used as a retriever,
 * similaritySearchVectorWithScore should use this.filter instead of
 * expecting it from the parameter
 */
class ExtendedPGVectorStore extends PGVectorStore {
  static async initialize(
    embeddings: Embeddings,
    args: PGVectorStoreArgs & { dimensions?: number },
  ): Promise<ExtendedPGVectorStore> {
    const { dimensions, ...rest } = args;
    const postgresqlVectorStore = new this(embeddings, rest);

    await postgresqlVectorStore._initializeClient();
    await postgresqlVectorStore.ensureTableInDatabase(dimensions);
    if (postgresqlVectorStore.collectionTableName) {
      await postgresqlVectorStore.ensureCollectionTableInDatabase();
    }

    return postgresqlVectorStore;
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: PGVectorStore['FilterType'],
  ) {
    const mergedFilter = { ...this.filter, ...filter };
    return await super.similaritySearchVectorWithScore(query, k, mergedFilter);
  }
}

/**
 * Creates a PostgreSQL connection pool
 */
function createPostgresPool(config: PGVectorConfig): pg.Pool {
  const Pool = require('pg').Pool;
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

/**
 * Creates a PGVector store configuration
 */
function createPGVectorConfig(
  config: PGVectorConfig,
  pool: pg.Pool,
  filter?: Record<string, any>,
): PGVectorStoreArgs {
  const pgVectorConfig: PGVectorStoreArgs = {
    pool,
    tableName: config.tableName || 'ai_agent_vectors',
    filter,
  };

  if (config.collectionName) {
    pgVectorConfig.collectionName = config.collectionName;
    pgVectorConfig.collectionTableName =
      config.collectionTableName || 'ai_agent_vector_collections';
  }

  if (config.columns) {
    pgVectorConfig.columns = {
      idColumnName: config.columns.idColumnName || 'id',
      vectorColumnName: config.columns.vectorColumnName || 'embedding',
      contentColumnName: config.columns.contentColumnName || 'text',
      metadataColumnName: config.columns.metadataColumnName || 'metadata',
    };
  }

  return pgVectorConfig;
}

/**
 * Output format options for the vector search tool
 */
export type VectorSearchOutputFormat = 'structured' | 'n8n' | 'simple';

export interface VectorSearchToolConfig extends RetrieveDocumentsConfig {
  /** Tool name (defaults to 'search_documents') */
  toolName?: string;
  /** Tool description */
  toolDescription?: string;
  /** Output format for results */
  outputFormat?: VectorSearchOutputFormat;
  /** Whether to allow dynamic topK parameter */
  allowDynamicTopK?: boolean;
}

/**
 * Core function to perform vector similarity search
 */
async function performVectorSearch(
  query: string,
  config: RetrieveDocumentsConfig,
  topK: number,
): Promise<Array<[Document, number]>> {
  // Create PostgreSQL pool
  const pool = createPostgresPool(config.pgConfig);

  try {
    // Create PGVector configuration
    const pgVectorConfig = createPGVectorConfig(
      config.pgConfig,
      pool,
      config.metadataFilter,
    );

    // Initialize the vector store
    const vectorStore = await ExtendedPGVectorStore.initialize(
      config.embeddings,
      pgVectorConfig,
    );

    try {
      // Embed the query
      const embeddedQuery = await config.embeddings.embedQuery(query);

      // Search for similar documents
      return await vectorStore.similaritySearchVectorWithScore(
        embeddedQuery,
        topK,
        config.metadataFilter,
      );
    } finally {
      // Release the vector store client
      vectorStore.client?.release();
    }
  } finally {
    // Close the pool
    await pool.end();
  }
}

/**
 * Format search results based on the specified output format
 */
function formatSearchResults(
  documents: Array<[Document, number]>,
  format: VectorSearchOutputFormat,
  includeMetadata: boolean,
): any {
  switch (format) {
    case 'structured':
      const results = documents.map(([doc, score]) => {
        const result: any = {
          pageContent: doc.pageContent,
          score: score,
        };

        if (includeMetadata) {
          result.metadata = doc.metadata;
        }

        return result;
      });

      return JSON.stringify({
        success: true,
        documents: results,
        count: results.length,
      });

    case 'n8n':
      return documents
        .map(([doc]) => {
          if (includeMetadata) {
            return { type: 'text', text: JSON.stringify(doc) };
          }
          return {
            type: 'text',
            text: JSON.stringify({ pageContent: doc.pageContent }),
          };
        })
        .filter((document) => !!document);

    case 'simple':
    default:
      return documents.map(([doc, score]) => ({
        content: doc.pageContent,
        score: score,
        ...(includeMetadata && { metadata: doc.metadata }),
      }));
  }
}

/**
 * Creates a unified vector search tool with configurable behavior
 */
export function createVectorSearchTool(
  config: VectorSearchToolConfig,
): ToolOptions {
  const {
    toolName = 'search_documents',
    toolDescription = 'Search for relevant documents using vector similarity search.',
    outputFormat = 'simple',
    allowDynamicTopK = true,
    ...searchConfig
  } = config;

  const baseSchema = z.object({
    query: z.string().describe('The search query to find similar documents'),
  });

  let schema: z.ZodSchema;
  if (allowDynamicTopK) {
    schema = baseSchema.extend({
      topK: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(searchConfig.topK || 4)
        .describe(
          'Number of documents to retrieve (defaults to configured value)',
        ),
    });
  } else {
    schema = baseSchema;
  }

  return {
    name: toolName,
    description: toolDescription,
    schema,
    func: async (args: z.infer<typeof schema>) => {
      const { query } = args;
      const topK = allowDynamicTopK
        ? (args as any).topK || searchConfig.topK || 4
        : searchConfig.topK || 4;

      const documents = await performVectorSearch(query, searchConfig, topK);

      return formatSearchResults(
        documents,
        outputFormat,
        searchConfig.includeMetadata !== false,
      );
    },
  };
}
