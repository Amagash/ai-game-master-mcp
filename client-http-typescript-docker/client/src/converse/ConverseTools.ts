import chalk from 'chalk';

type ToolFunction = (name: string, input: any) => Promise<any>;

interface Tool {
  name: string;
  description: string;
  function: ToolFunction;
  schema: any;
}

export class ConverseTools {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a new tool
   * @param name Tool name
   * @param func Tool function implementation
   * @param description Tool description
   * @param schema JSON schema for tool parameters
   */
  public registerTool(name: string, func: ToolFunction, description: string, schema: any): void {
    this.tools.set(name, {
      name,
      description,
      function: func,
      schema
    });
    console.log(`Registering tool - ${name}`);
  }

  /**
   * Execute a tool by name with given input
   * @param name Tool name
   * @param input Tool input parameters
   * @returns Tool execution result
   */
  public async executeTool(name: string, input: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      console.log(chalk.blue(`Executing tool ${name} with input:`), input);
      const result = await tool.function(name, input);
      console.log(chalk.green(`Tool ${name} execution result:`), result);
      return result;
    } catch (error) {
      console.error(chalk.red(`Error executing tool ${name}:`), error);
      throw error;
    }
  }

  /**
   * Get all tools formatted for the model
   * @returns Array of tools in the format expected by the model
   */
  public getToolsForModel(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.schema.properties || {},
        required: tool.schema.required || []
      }
    }));
  }

  /**
   * Get a list of all registered tool names
   * @returns Array of tool names
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool exists
   * @param name Tool name
   * @returns True if the tool exists
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools
   * @returns Number of tools
   */
  public getToolCount(): number {
    return this.tools.size;
  }
}
