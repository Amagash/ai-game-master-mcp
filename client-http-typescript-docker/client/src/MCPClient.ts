import EventEmitter from 'events';
import axios from 'axios';
import chalk from 'chalk';

// Define types to replace the MCP SDK types
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface CallToolResult {
  result: any;
}

export class MCPClient extends EventEmitter {
  protected serverUrl: string;
  protected apiToken: string;
  protected isConnected: boolean = false;

  constructor(serverUrl: string, apiToken: string) {
    super();
    this.serverUrl = serverUrl;
    this.apiToken = apiToken;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log(chalk.yellow('Already connected to MCP server'));
      return;
    }
    
    try {
      console.log(chalk.blue(`Connecting to MCP server at ${this.serverUrl}...`));
      
      // Test connection with a health check
      // Use a direct endpoint that doesn't require authentication first
      try {
        const healthResponse = await axios.get(`${this.serverUrl.replace('/mcp', '')}/health`, {
          // Increased timeout to 30 seconds for health check
          timeout: 30000
        });
        
        console.log(chalk.green('API is reachable. Status:'), healthResponse.status);
      } catch (healthError) {
        console.log(chalk.yellow('Health endpoint not available, continuing with authenticated request'));
      }
      
      // Now try the authenticated endpoint
      const response = await axios.post(`${this.serverUrl}`, {
        action: "ping"
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        // Increased timeout to 30 seconds for ping
        timeout: 30000
      });
      
      // Accept 200 or 204 as success (204 is "No Content" but still success)
      if (response.status === 200 || response.status === 204) {
        this.isConnected = true;
        console.log(chalk.green(`Successfully connected to MCP server (status: ${response.status})`));
      } else {
        throw new Error(`Connection test failed with status: ${response.status}`);
      }
      
      // Set up polling for updates
      this.setupUpdatePolling();
    } catch (error) {
      console.error(chalk.red('Error connecting to MCP server:'), error);
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  private setupUpdatePolling(): void {
    try {
      console.log(chalk.blue('Setting up periodic polling for updates...'));
      
      // Set up periodic polling for updates
      setInterval(async () => {
        try {
          // Poll for updates
          const response = await axios.get(`${this.serverUrl}/updates`, {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            },
            // Increased timeout to 30 seconds for updates
            timeout: 30000
          }).catch(() => null);
          
          if (response && response.status === 200 && response.data) {
            // Process any updates
            if (response.data.type === 'toolListChanged') {
              this.emit('toolListChanged');
            } else if (response.data.type === 'resourceListChanged') {
              this.emit('resourceListChanged');
            } else if (response.data.type === 'resourceUpdated') {
              this.emit('resourceUpdated', { uri: response.data.uri });
            }
          }
        } catch (error) {
          // Ignore polling errors
        }
      }, 30000); // Poll every 30 seconds
      
      console.log(chalk.green('Update polling setup complete'));
    } catch (error) {
      console.error(chalk.red('Error setting up update polling:'), error);
    }
  }

  async getAvailableTools(): Promise<Tool[]> {
    try {
      console.log(chalk.blue('Fetching available tools from MCP server...'));
      
      const response = await axios.post(`${this.serverUrl}`, {
        action: "listTools"
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        // Increased timeout to 60 seconds for tool listing
        timeout: 60000
      });
      
      // Handle both 200 and 204 responses
      if (response.status === 204) {
        console.log(chalk.yellow('Server returned 204 No Content. No tools available.'));
        return [];
      } else if (response.status === 200 && response.data && response.data.tools) {
        console.log(chalk.green(`Retrieved ${response.data.tools.length} tools from MCP server`));
        return response.data.tools;
      } else {
        console.log(chalk.yellow('Server returned unexpected response format:'), response.data);
        return [];
      }
    } catch (error) {
      console.error(chalk.red('Error fetching tools:'), error);
      
      // Log more detailed error information
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(chalk.red('Response status:'), error.response.status);
        console.error(chalk.red('Response headers:'), error.response.headers);
        console.error(chalk.red('Response data:'), error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        console.error(chalk.red('No response received:'), error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(chalk.red('Request setup error:'), error.message);
      }
      
      // Return empty array instead of throwing to make the client more resilient
      console.log(chalk.yellow('Returning empty tools array due to error'));
      return [];
    }
  }

  async callTool(name: string, toolArgs: Record<string, any>): Promise<CallToolResult> {
    try {
      console.log(chalk.blue(`Calling tool ${name} with arguments:`), toolArgs);
      
      const response = await axios.post(`${this.serverUrl}`, {
        action: "callTool",
        name,
        arguments: toolArgs
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        // Increased timeout to 180 seconds (3 minutes) for tool calls
        timeout: 180000
      });
      
      // Handle both 200 and 204 responses
      if (response.status === 204) {
        console.log(chalk.yellow(`Tool ${name} returned 204 No Content`));
        return { result: null };
      } else if (response.status === 200) {
        console.log(chalk.green(`Tool ${name} returned result:`), response.data);
        return { result: response.data };
      } else {
        throw new Error(`Tool call failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error calling tool ${name}:`), error);
      throw new Error(`Failed to call tool ${name}: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log(chalk.blue('Closing connection to MCP server...'));
        // In a real implementation with SSE, you would close the EventSource connection here
        this.isConnected = false;
        console.log(chalk.green('Successfully closed connection to MCP server'));
      }
    } catch (error) {
      console.error(chalk.red('Error closing connection:'), error);
      throw error;
    }
  }
}
