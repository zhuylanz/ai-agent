import { DynamicTool } from '@langchain/core/tools';
import type { Tool } from '@langchain/core/tools';
import type { ToolOptions } from '../types/index';

export class ToolManager {
  private tools: Tool[] = [];

  /**
   * Add a tool to the manager
   */
  addTool(toolOptions: ToolOptions): void {
    const tool = new DynamicTool({
      name: toolOptions.name,
      description: toolOptions.description,
      func: async (input: string) => {
        try {
          const result = await toolOptions.func(input);
          return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error) {
          return `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    });

    this.tools.push(tool);
  }

  /**
   * Add multiple tools at once
   */
  addTools(toolOptions: ToolOptions[]): void {
    toolOptions.forEach(tool => this.addTool(tool));
  }

  /**
   * Add an existing LangChain tool
   */
  addLangChainTool(tool: Tool): void {
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
    const index = this.tools.findIndex(tool => tool.name === name);
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
    return this.tools.find(tool => tool.name === name);
  }
}
