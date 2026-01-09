/**
 * Command Executor - Content Script
 *
 * Cloudflare Workers から受け取ったコマンドを
 * ユーザーのブラウザ上で実行する
 */

class CommandExecutor {
  constructor() {
    this.results = [];
  }

  /**
   * コマンドリストを順番に実行
   */
  async executeCommands(commands) {
    this.results = [];

    for (const cmd of commands) {
      try {
        const result = await this.executeCommand(cmd);
        this.results.push({ command: cmd, success: true, result });
      } catch (error) {
        this.results.push({ command: cmd, success: false, error: error.message });
        // エラーでも続行するかどうかは設定次第
      }
    }

    return this.results;
  }

  /**
   * 単一コマンドを実行
   */
  async executeCommand(cmd) {
    const { tool, args } = cmd;

    switch (tool) {
      case 'navigate':
        return this.navigate(args.url);

      case 'click':
        return this.click(args.selector);

      case 'type':
        return this.type(args.selector, args.text);

      case 'fill_form':
        return this.fillForm(args.selector, args.value);

      case 'press_key':
        return this.pressKey(args.key);

      case 'wait':
        return this.wait(args.seconds);

      case 'get_text':
        return this.getText(args.selector);

      case 'screenshot':
        return this.screenshot();

      default:
        throw new Error(`Unknown command: ${tool}`);
    }
  }

  // === コマンド実装 ===

  async navigate(url) {
    // Content Script からの navigate は popup.js で処理されるべき
    // ここでは何もしない（無限ループ防止）
    console.log('[CommandExecutor] Navigate should be handled by popup, skipping:', url);
    return { skipped: true, reason: 'Navigate handled by popup' };
  }

  async click(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    element.click();
    return { clicked: selector };
  }

  async type(selector, text) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    element.focus();

    // 既存の値をクリア
    element.value = '';

    // テキストを入力
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await this.sleep(50);
    }

    return { typed: text, selector };
  }

  async fillForm(selector, value) {
    // Try multiple selectors (comma-separated)
    const selectors = selector.split(',').map(s => s.trim());
    let element = null;

    for (const sel of selectors) {
      element = document.querySelector(sel);
      if (element) break;
    }

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    element.focus();
    await this.sleep(100);

    // Clear existing value
    element.value = '';

    // Use native input value setter for React/modern frameworks
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }

    // Dispatch multiple events for compatibility
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value
    }));

    await this.sleep(100);
    return { filled: value, selector };
  }

  async pressKey(key) {
    const keyMap = {
      'Enter': 13,
      'Tab': 9,
      'Escape': 27,
      'Backspace': 8,
      'ArrowUp': 38,
      'ArrowDown': 40,
      'ArrowLeft': 37,
      'ArrowRight': 39
    };

    const keyCode = keyMap[key] || key.charCodeAt(0);
    const activeElement = document.activeElement || document.body;

    const event = new KeyboardEvent('keydown', {
      key: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });

    activeElement.dispatchEvent(event);

    // Enter の場合はフォーム送信も試みる
    if (key === 'Enter') {
      const form = activeElement.closest('form');
      if (form) {
        form.submit();
      }
    }

    return { pressed: key };
  }

  async wait(seconds) {
    await this.sleep(seconds * 1000);
    return { waited: seconds };
  }

  async getText(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return { text: element.textContent || element.innerText };
  }

  async screenshot() {
    // Content Script からはスクリーンショットを直接取れないため
    // Background Script に依頼する
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'TAKE_SCREENSHOT' }, (response) => {
        resolve(response);
      });
    });
  }

  // ヘルパー
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// グローバルインスタンス
window.commandExecutor = new CommandExecutor();

// メッセージリスナー（Background Script から呼び出し）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'EXECUTE_COMMANDS') {
    window.commandExecutor.executeCommands(message.commands)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンス
  }

  if (message.action === 'EXECUTE_SINGLE_COMMAND') {
    window.commandExecutor.executeCommand(message.command)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

console.log('[CommandExecutor] Content script loaded');
