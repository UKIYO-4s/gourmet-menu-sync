/**
 * Native MCP Client
 *
 * Native Messaging を通じて MCP Server と通信するクライアント
 */

class NativeMCPClient {
  constructor() {
    this.hostName = 'com.menusimulator.nativehost';
    this.port = null;
    this.connected = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.onDisconnect = null;
  }

  /**
   * Native Host に接続
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('[NativeMCPClient] Connecting to:', this.hostName);

        this.port = chrome.runtime.connectNative(this.hostName);

        this.port.onMessage.addListener((message) => {
          this.handleMessage(message);
        });

        this.port.onDisconnect.addListener(() => {
          const error = chrome.runtime.lastError;
          console.log('[NativeMCPClient] Disconnected:', error?.message || 'No error');

          this.connected = false;
          this.port = null;

          // 保留中のリクエストをすべて拒否
          for (const [id, { reject }] of this.pendingRequests) {
            reject(new Error('Native host disconnected'));
          }
          this.pendingRequests.clear();

          if (this.onDisconnect) {
            this.onDisconnect(error?.message);
          }
        });

        // ping でテスト
        this.sendRequest('ping')
          .then((response) => {
            console.log('[NativeMCPClient] Ping successful:', response);
            this.connected = true;
            resolve();
          })
          .catch((error) => {
            console.error('[NativeMCPClient] Ping failed:', error);
            reject(error);
          });

      } catch (error) {
        console.error('[NativeMCPClient] Connect error:', error);
        reject(error);
      }
    });
  }

  /**
   * MCP Server に接続（Native Host 経由）
   */
  async connectMCP() {
    const response = await this.sendRequest('connect');
    if (!response.success) {
      throw new Error(response.error || 'Failed to connect to MCP');
    }
    return response;
  }

  /**
   * MCP ツール一覧を取得
   */
  async listTools() {
    const response = await this.sendRequest('list_tools');
    if (!response.success) {
      throw new Error(response.error || 'Failed to list tools');
    }
    return response.tools;
  }

  /**
   * MCP ツールを呼び出す
   */
  async callTool(toolName, args = {}) {
    const response = await this.sendRequest('call_tool', { tool: toolName, args });
    if (!response.success) {
      throw new Error(response.error || 'Tool call failed');
    }
    return response.result;
  }

  /**
   * Native Host にメッセージを送信
   */
  sendRequest(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Not connected to native host'));
        return;
      }

      const id = ++this.requestId;
      const message = { type, id, ...data };

      this.pendingRequests.set(id, { resolve, reject });

      console.log('[NativeMCPClient] Sending:', message);
      this.port.postMessage(message);

      // タイムアウト
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Native Host からのメッセージを処理
   */
  handleMessage(message) {
    console.log('[NativeMCPClient] Received:', message);

    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.type === 'error') {
        reject(new Error(message.error));
      } else {
        resolve(message);
      }
    }
  }

  /**
   * 切断
   */
  disconnect() {
    if (this.port) {
      // MCP Server との接続を閉じる
      this.port.postMessage({ type: 'disconnect', id: ++this.requestId });
      this.port.disconnect();
      this.port = null;
    }
    this.connected = false;
  }

  /**
   * 接続状態を確認
   */
  isConnected() {
    return this.connected && this.port !== null;
  }
}

// グローバルにエクスポート（拡張機能のスコープで使用）
if (typeof window !== 'undefined') {
  window.NativeMCPClient = NativeMCPClient;
}

// Service Worker 用
if (typeof self !== 'undefined') {
  self.NativeMCPClient = NativeMCPClient;
}
