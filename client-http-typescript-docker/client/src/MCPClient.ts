import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ToolListChangedNotificationSchema, ResourceListChangedNotificationSchema, ResourceUpdatedNotificationSchema, type ResourceUpdatedNotification } from '@modelcontextprotocol/sdk/types.js';
import EventEmitter from 'events';

export class MCPClient extends EventEmitter {
  private client: Client;
  // private transport: SSEClientTransport;
  private transport: StreamableHTTPClientTransport;

  constructor(serverUrl: string, apiToken: string) {
    super();
    this.client = new Client({
      name: 'mcp-bedrock-demo',
      version: '1.0.0'
    });

    // Create a transport to connect to our server
    this.transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      {
        requestInit: {
          headers: {
            'Authorization': "Bearer " + apiToken
          }
        }
      }
    );

    // Set up notification handlers
    this.client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      this.emit('toolListChanged');
    });

    this.client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      this.emit('resourceListChanged');
    });

    this.client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification: ResourceUpdatedNotification) => {
      this.emit('resourceUpdated', { uri: notification.params.uri });
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async getAvailableTools(): Promise<Tool[]> {
    const result = await this.client.listTools();
    return result.tools;
  }

  async callTool(name: string, toolArgs: Record<string, any>): Promise<CallToolResult> {
    return await this.client.callTool({
      name,
      arguments: toolArgs
    });
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
} 