import { DynamicTool, DynamicStructuredTool, tool } from '@langchain/core/tools';
import type { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolOptions } from '../types/index';
import { convertJsonSchemaToZod } from './json-schema-to-zod';

export class ToolManager {
  private tools: any[] = [];

  /**
   * Add a tool to the manager
   */
  addTool(toolOptions: ToolOptions): void {
    if (toolOptions.schema) {
      // Resolve schema: accept both Zod schemas and JSONSchema7 objects
      let resolvedSchema: z.ZodTypeAny;

      if (toolOptions.schema instanceof z.ZodType) {
        resolvedSchema = toolOptions.schema;
      } else {
        // Treat as JSONSchema7 — convert to Zod
        const converted = convertJsonSchemaToZod(toolOptions.schema as any);
        resolvedSchema =
          converted instanceof z.ZodObject ? converted : z.object({ value: converted });
      }

      // Use DynamicStructuredTool for tools with a schema (cast to avoid deep type inference)
      const schemaForTool = (
        resolvedSchema instanceof z.ZodObject ? resolvedSchema : z.object({ value: resolvedSchema })
      ) as z.ZodObject<any>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createTool = tool as (...args: any[]) => any;
      const langchainTool = createTool(
        async (input: any) => {
          try {
            const result = await toolOptions.func(input);
            return typeof result === 'string' ? result : JSON.stringify(result);
          } catch (error) {
            return `Error executing tool: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        },
        {
          name: toolOptions.name,
          description: toolOptions.description,
          schema: schemaForTool,
        },
      );
      this.tools.push(langchainTool);
    } else {
      // Use DynamicTool for tools without schema (expects string input)
      const langchainTool = new DynamicTool({
        name: toolOptions.name,
        description: toolOptions.description,
        func: async (input: string) => {
          try {
            const result = await toolOptions.func(input);
            return typeof result === 'string' ? result : JSON.stringify(result);
          } catch (error) {
            return `Error executing tool: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        },
      });
      this.tools.push(langchainTool);
    }
  }

  /**
   * Add multiple tools at once
   */
  addTools(toolOptions: ToolOptions[]): void {
    toolOptions.forEach((tool) => this.addTool(tool));
  }

  /**
   * Add an existing LangChain tool
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addLangChainTool(tool: any): void {
    this.tools.push(tool);
  }

  /**
   * Get all tools
   */
  getTools(): Tool[] {
    return [...this.tools];
  }

  /**
   * Clear all tools
   */
  clearTools(): void {
    this.tools = [];
  }

  /**
   * Remove a tool by name
   */
  removeTool(name: string): boolean {
    const index = this.tools.findIndex((tool) => tool.name === name);
    if (index !== -1) {
      this.tools.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.find((tool) => tool.name === name);
  }
}
