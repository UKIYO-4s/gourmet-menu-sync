/**
 * Popup Script - Menu Simulator Assistant
 */

// DOM Elements
const elements = {
  extensionId: document.getElementById('extensionId'),
  btnCopyId: document.getElementById('btnCopyId'),
  connectionStatus: document.getElementById('connectionStatus'),
  lastConnected: document.getElementById('lastConnected'),
  pageInfo: document.getElementById('pageInfo'),
  platformBadge: document.getElementById('platformBadge'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnOpenWebApp: document.getElementById('btnOpenWebApp'),
  btnHelp: document.getElementById('btnHelp'),
  mcpSearchQuery: document.getElementById('mcpSearchQuery'),
  btnMcpTest: document.getElementById('btnMcpTest'),
  mcpTestResult: document.getElementById('mcpTestResult'),
  // Native MCP elements
  nativeMcpStatus: document.getElementById('nativeMcpStatus'),
  btnNativeConnect: document.getElementById('btnNativeConnect'),
  btnNativeListTools: document.getElementById('btnNativeListTools'),
  nativeToolSelect: document.getElementById('nativeToolSelect'),
  btnNativeCallTool: document.getElementById('btnNativeCallTool'),
  nativeMcpResult: document.getElementById('nativeMcpResult'),
  // Self-Healing Test elements
  healingSearchQuery: document.getElementById('healingSearchQuery'),
  btnHealingTest: document.getElementById('btnHealingTest'),
  healingTestResult: document.getElementById('healingTestResult'),
  healingValidation: document.getElementById('healingValidation'),
  logicCheckResult: document.getElementById('logicCheckResult'),
  aiCheckResult: document.getElementById('aiCheckResult'),
  selectorUsed: document.getElementById('selectorUsed')
};

// Native MCP Client instance
let nativeMcpClient = null;

// MCP Bridge URLs
const MCP_BRIDGE_URL = 'http://localhost:3456';
const CLOUDFLARE_WORKER_URL = 'https://menu-simulator-mcp.menu-simulator.workers.dev';

// Self-Healing Selector Validator API
const SELECTOR_VALIDATOR_URL = 'https://gourmet-selector-validator.menu-simulator.workers.dev';

// モード切り替え（'local' or 'cloudflare'）
let currentMode = 'cloudflare';

// Platform detection patterns
const PLATFORM_PATTERNS = {
  tabelog: /tabelog\.com/,
  hotpepper: /hotpepper\.jp/,
  gnavi: /gnavi\.co\.jp/
};

const PLATFORM_NAMES = {
  tabelog: '食べログ',
  hotpepper: 'ホットペッパー',
  gnavi: 'ぐるなび'
};

// Web app URL
const WEB_APP_URL = 'https://menu-simulator.pages.dev';

/**
 * Initialize popup
 */
async function init() {
  // Display extension ID
  elements.extensionId.textContent = chrome.runtime.id;

  // Load state from background
  await refreshState();

  // Get current tab info
  await updateCurrentTab();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Refresh state from background script
 */
async function refreshState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' });

    if (response && response.success && response.data) {
      const state = response.data;

      // Update last connected
      if (state.lastConnectedAt) {
        const date = new Date(state.lastConnectedAt);
        elements.lastConnected.textContent = date.toLocaleString('ja-JP');
        updateConnectionStatus('connected');
      } else {
        elements.lastConnected.textContent = '未接続';
        updateConnectionStatus('pending');
      }
    }
  } catch (error) {
    console.error('Failed to get state:', error);
    updateConnectionStatus('error');
  }
}

/**
 * Update connection status display
 */
function updateConnectionStatus(status) {
  const statusBar = elements.connectionStatus;

  statusBar.classList.remove('status--pending', 'status--connected', 'status--error');

  switch (status) {
    case 'connected':
      statusBar.classList.add('status--connected');
      statusBar.innerHTML = `
        <span class="status-icon">✅</span>
        <span class="status-text">Webアプリと接続済み</span>
      `;
      break;
    case 'error':
      statusBar.classList.add('status--error');
      statusBar.innerHTML = `
        <span class="status-icon">❌</span>
        <span class="status-text">エラーが発生しました</span>
      `;
      break;
    case 'pending':
    default:
      statusBar.classList.add('status--pending');
      statusBar.innerHTML = `
        <span class="status-icon">⏳</span>
        <span class="status-text">Webアプリからの接続を待機中</span>
      `;
  }
}

/**
 * Update current tab information
 */
async function updateCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
      const url = new URL(tab.url);
      elements.pageInfo.querySelector('.page-info__url').textContent = url.hostname + url.pathname.substring(0, 30) + '...';

      // Detect platform
      let detectedPlatform = null;
      for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
        if (pattern.test(tab.url)) {
          detectedPlatform = platform;
          break;
        }
      }

      if (detectedPlatform) {
        elements.platformBadge.textContent = PLATFORM_NAMES[detectedPlatform];
        elements.platformBadge.className = `platform-badge ${detectedPlatform}`;
      } else {
        elements.platformBadge.className = 'platform-badge hidden';
      }
    } else {
      elements.pageInfo.querySelector('.page-info__url').textContent = 'ページ情報を取得できません';
      elements.platformBadge.className = 'platform-badge hidden';
    }
  } catch (error) {
    console.error('Failed to get current tab:', error);
  }
}

/**
 * Copy extension ID to clipboard
 */
async function copyExtensionId() {
  try {
    await navigator.clipboard.writeText(chrome.runtime.id);
    showToast('コピーしました');
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('コピーに失敗しました');
  }
}

/**
 * Open web app in new tab
 */
function openWebApp() {
  chrome.tabs.create({ url: WEB_APP_URL });
}

/**
 * Show toast notification
 */
function showToast(message) {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show toast
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Hide after 2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

/**
 * Execute MCP action via local bridge server
 */
async function executeMcpAction(action) {
  try {
    const response = await fetch(`${MCP_BRIDGE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute via Cloudflare Workers
 */
async function executeCloudflareAction(action) {
  try {
    // 1. Cloudflare Workers からコマンドリストを取得
    const response = await fetch(`${CLOUDFLARE_WORKER_URL}/google-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: action.query })
    });
    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error };
    }

    // 2. コマンドを順番に実行
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: 'No active tab' };
    }

    let currentTabId = tab.id;

    for (const cmd of data.commands) {
      // navigate はタブAPIで直接実行
      if (cmd.tool === 'navigate') {
        await chrome.tabs.update(currentTabId, { url: cmd.args.url });
        // ページ読み込み待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // wait はここで待機
      if (cmd.tool === 'wait') {
        await new Promise(resolve => setTimeout(resolve, cmd.args.seconds * 1000));
        continue;
      }

      // その他のコマンドは Content Script で実行
      try {
        await chrome.tabs.sendMessage(currentTabId, {
          action: 'EXECUTE_SINGLE_COMMAND',
          command: cmd
        });
      } catch (e) {
        console.log('Command execution error:', e);
        // Content Script が読み込まれていない場合は scripting API を使用
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          files: ['content/command-executor.js']
        });
        // 再試行
        await new Promise(resolve => setTimeout(resolve, 500));
        await chrome.tabs.sendMessage(currentTabId, {
          action: 'EXECUTE_SINGLE_COMMAND',
          command: cmd
        });
      }
    }

    return {
      success: true,
      message: data.message || 'Commands executed'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run MCP test (Google search)
 */
async function runMcpTest() {
  const query = elements.mcpSearchQuery.value.trim();
  if (!query) {
    showToast('検索キーワードを入力してください');
    return;
  }

  // Show loading state
  elements.btnMcpTest.disabled = true;
  elements.btnMcpTest.textContent = '実行中...';
  elements.mcpTestResult.className = 'mcp-result';
  elements.mcpTestResult.textContent = `${currentMode === 'cloudflare' ? 'Cloudflare' : 'MCP'}に接続中...`;

  // Execute based on current mode
  let result;
  if (currentMode === 'cloudflare') {
    result = await executeCloudflareAction({ query });
  } else {
    result = await executeMcpAction({ type: 'google-search', query });
  }

  // Show result
  elements.btnMcpTest.disabled = false;
  elements.btnMcpTest.textContent = 'Google検索実行';

  if (result.success) {
    elements.mcpTestResult.className = 'mcp-result success';
    elements.mcpTestResult.textContent = `✅ ${result.message}`;
    showToast(`${currentMode === 'cloudflare' ? 'Cloudflare' : 'MCP'}実行成功！`);
  } else {
    elements.mcpTestResult.className = 'mcp-result error';
    elements.mcpTestResult.textContent = `❌ エラー: ${result.error}`;
    showToast('実行失敗');
  }
}

/**
 * Toggle between local and cloudflare mode
 */
function toggleMode() {
  currentMode = currentMode === 'local' ? 'cloudflare' : 'local';
  updateModeDisplay();
  showToast(`モード: ${currentMode === 'cloudflare' ? 'Cloudflare' : 'ローカル'}`);
}

/**
 * Update mode display
 */
function updateModeDisplay() {
  const modeBtn = document.getElementById('btnToggleMode');
  if (modeBtn) {
    modeBtn.textContent = currentMode === 'cloudflare' ? '☁️ Cloudflare' : '💻 ローカル';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  elements.btnCopyId.addEventListener('click', copyExtensionId);
  elements.btnRefresh.addEventListener('click', refreshState);
  elements.btnOpenWebApp.addEventListener('click', openWebApp);
  elements.btnMcpTest.addEventListener('click', runMcpTest);
  elements.btnHelp.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('ヘルプページは準備中です');
  });

  // Self-Healing Test event listener
  if (elements.btnHealingTest) {
    elements.btnHealingTest.addEventListener('click', runSelfHealingTest);
  }

  // Native MCP event listeners
  elements.btnNativeConnect.addEventListener('click', connectNativeMcp);
  elements.btnNativeListTools.addEventListener('click', listNativeTools);
  elements.btnNativeCallTool.addEventListener('click', callNativeTool);
  elements.nativeToolSelect.addEventListener('change', onToolSelectChange);
}

// ========================================
// Self-Healing Test Functions
// ========================================

/**
 * Run Self-Healing Test (Gmail Search)
 * 1. Get current tab's HTML
 * 2. Send to Cloudflare Workers /validate
 * 3. Execute returned commands
 */
async function runSelfHealingTest() {
  const keyword = elements.healingSearchQuery?.value?.trim();
  if (!keyword) {
    showToast('検索キーワードを入力してください');
    return;
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    showToast('アクティブなタブが見つかりません');
    return;
  }

  // Check if on Gmail
  if (!tab.url.includes('mail.google.com')) {
    showHealingResult('error', '❌ Gmailページで実行してください\nhttps://mail.google.com/mail/u/0/#inbox');
    return;
  }

  // Show loading state
  elements.btnHealingTest.disabled = true;
  elements.btnHealingTest.textContent = '実行中...';
  showHealingResult('info', '⏳ ページを分析中...');
  elements.healingValidation.classList.add('hidden');

  try {
    // 1. Get page HTML via content script
    const htmlResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML
    });

    if (!htmlResult || !htmlResult[0]?.result) {
      throw new Error('HTMLの取得に失敗しました');
    }

    const pageHtml = htmlResult[0].result;
    showHealingResult('info', '⏳ Cloudflare Workers に送信中...');

    // 2. Send to /validate endpoint
    const response = await fetch(`${SELECTOR_VALIDATOR_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: 'gmail',
        page: 'inbox',
        html: pageHtml,
        url: tab.url,
        action: {
          type: 'search',
          keyword: keyword
        }
      })
    });

    const result = await response.json();
    console.log('Validation result:', result);

    // 3. Show validation results
    showValidationResults(result);

    // 4. Execute commands if available
    if (result.commands && result.commands.length > 0) {
      showHealingResult('info', '⏳ コマンドを実行中...');

      // Inject command executor if needed
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/command-executor.js']
        });
      } catch (e) {
        console.log('Command executor already loaded or error:', e);
      }

      // Wait for script to load
      await new Promise(resolve => setTimeout(resolve, 300));

      // Execute commands
      for (const cmd of result.commands) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'EXECUTE_SINGLE_COMMAND',
            command: cmd
          });
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          console.error('Command execution error:', e);
        }
      }

      // Show final result
      if (result.task_completed) {
        showHealingResult('success', `✅ テスト成功！\n検索キーワード: "${keyword}"\n処理時間: ${result.validation_time_ms}ms`);
        showToast('セルフヒーリングテスト成功！');
      } else {
        showHealingResult('warning', `⚠️ 部分的に成功\n${result.ai_analysis || ''}`);
      }
    } else {
      showHealingResult('error', `❌ コマンドが生成されませんでした\n${result.ai_analysis || result.error_type || ''}`);
    }

  } catch (error) {
    console.error('Self-healing test error:', error);
    showHealingResult('error', `❌ エラー: ${error.message}`);
  } finally {
    elements.btnHealingTest.disabled = false;
    elements.btnHealingTest.textContent = 'テスト実行';
  }
}

/**
 * Show healing test result
 */
function showHealingResult(type, message) {
  if (elements.healingTestResult) {
    elements.healingTestResult.className = `mcp-result ${type}`;
    elements.healingTestResult.textContent = message;
    elements.healingTestResult.classList.remove('hidden');
  }
}

/**
 * Show validation results (logic check + AI check)
 */
function showValidationResults(result) {
  if (!elements.healingValidation) return;

  elements.healingValidation.classList.remove('hidden');

  // Logic Check
  if (elements.logicCheckResult && result.validation?.logic_check) {
    const logicStatus = result.validation.logic_check;
    const logicIcon = logicStatus === 'MATCH' ? '✅' : logicStatus === 'PARTIAL' ? '⚠️' : '❌';
    elements.logicCheckResult.textContent = `${logicIcon} ${logicStatus}`;
    elements.logicCheckResult.className = `validation-value ${logicStatus.toLowerCase()}`;
  }

  // AI Check
  if (elements.aiCheckResult && result.validation?.ai_check) {
    const aiCheck = result.validation.ai_check;
    const aiIcon = aiCheck.confirmed ? '✅' : '❌';
    const confidence = Math.round(aiCheck.confidence * 100);
    elements.aiCheckResult.textContent = `${aiIcon} ${aiCheck.confirmed ? '確認済' : '未確認'} (${confidence}%)`;
    elements.aiCheckResult.className = `validation-value ${aiCheck.confirmed ? 'match' : 'mismatch'}`;
  }

  // Selector Used
  if (elements.selectorUsed && result.execution?.selector_used) {
    const healed = result.execution.healed ? ' (修復済)' : '';
    elements.selectorUsed.textContent = `${result.execution.selector_used}${healed}`;
    elements.selectorUsed.className = `validation-value ${result.execution.healed ? 'healed' : 'original'}`;
  }
}

// ========================================
// Native MCP Functions
// ========================================

/**
 * Update Native MCP status display
 */
function updateNativeMcpStatus(status, message) {
  const statusBar = elements.nativeMcpStatus;

  statusBar.classList.remove('status--disconnected', 'status--connected', 'status--connecting', 'status--error');

  switch (status) {
    case 'connected':
      statusBar.classList.add('status--connected');
      statusBar.innerHTML = `
        <span class="status-icon">🟢</span>
        <span class="status-text">${message || 'MCP接続済み'}</span>
      `;
      break;
    case 'connecting':
      statusBar.classList.add('status--connecting');
      statusBar.innerHTML = `
        <span class="status-icon">🟡</span>
        <span class="status-text">${message || '接続中...'}</span>
      `;
      break;
    case 'error':
      statusBar.classList.add('status--error');
      statusBar.innerHTML = `
        <span class="status-icon">🔴</span>
        <span class="status-text">${message || 'エラー'}</span>
      `;
      break;
    case 'disconnected':
    default:
      statusBar.classList.add('status--disconnected');
      statusBar.innerHTML = `
        <span class="status-icon">⚫</span>
        <span class="status-text">${message || '未接続'}</span>
      `;
  }
}

/**
 * Connect to Native MCP Host
 */
async function connectNativeMcp() {
  try {
    updateNativeMcpStatus('connecting', 'Native Host に接続中...');
    elements.btnNativeConnect.disabled = true;

    // Create client and connect
    nativeMcpClient = new NativeMCPClient();

    nativeMcpClient.onDisconnect = (error) => {
      updateNativeMcpStatus('disconnected', error || '切断されました');
      setNativeControlsEnabled(false);
      elements.btnNativeConnect.disabled = false;
      elements.btnNativeConnect.textContent = '接続';
    };

    await nativeMcpClient.connect();

    updateNativeMcpStatus('connecting', 'MCP Server に接続中...');

    // Connect to MCP Server through Native Host
    await nativeMcpClient.connectMCP();

    updateNativeMcpStatus('connected', 'MCP接続済み');
    setNativeControlsEnabled(true);
    elements.btnNativeConnect.textContent = '切断';
    elements.btnNativeConnect.disabled = false;

    showNativeMcpResult('success', '✅ Native MCP に接続しました');
    showToast('MCP接続成功！');

  } catch (error) {
    console.error('Native MCP connect error:', error);
    updateNativeMcpStatus('error', error.message);
    showNativeMcpResult('error', `❌ 接続エラー: ${error.message}`);
    elements.btnNativeConnect.disabled = false;
    elements.btnNativeConnect.textContent = '接続';

    // Show helpful message for common errors
    if (error.message.includes('not found') || error.message.includes('Specified native messaging host not found')) {
      showNativeMcpResult('error', `❌ Native Host が見つかりません。\nインストール手順:\n1. native-host ディレクトリで npm install\n2. EXTENSION_ID=${chrome.runtime.id} npm run install-host`);
    }
  }
}

/**
 * Disconnect from Native MCP
 */
function disconnectNativeMcp() {
  if (nativeMcpClient) {
    nativeMcpClient.disconnect();
    nativeMcpClient = null;
  }
  updateNativeMcpStatus('disconnected');
  setNativeControlsEnabled(false);
  elements.btnNativeConnect.textContent = '接続';
}

/**
 * Enable/disable Native MCP controls
 */
function setNativeControlsEnabled(enabled) {
  elements.btnNativeListTools.disabled = !enabled;
  elements.nativeToolSelect.disabled = !enabled;
  elements.btnNativeCallTool.disabled = !enabled;
}

/**
 * List available MCP tools
 */
async function listNativeTools() {
  if (!nativeMcpClient || !nativeMcpClient.isConnected()) {
    showToast('MCPに接続してください');
    return;
  }

  try {
    elements.btnNativeListTools.disabled = true;
    elements.btnNativeListTools.textContent = '取得中...';

    const result = await nativeMcpClient.listTools();
    console.log('Tools:', result);

    // Populate tool select
    elements.nativeToolSelect.innerHTML = '<option value="">ツールを選択...</option>';

    if (result && result.tools) {
      for (const tool of result.tools) {
        const option = document.createElement('option');
        option.value = tool.name;
        option.textContent = tool.name;
        option.title = tool.description || '';
        elements.nativeToolSelect.appendChild(option);
      }
    }

    showNativeMcpResult('success', `✅ ${result.tools?.length || 0} ツールが利用可能`);
    showToast('ツール一覧を取得しました');

  } catch (error) {
    console.error('List tools error:', error);
    showNativeMcpResult('error', `❌ ツール取得エラー: ${error.message}`);
  } finally {
    elements.btnNativeListTools.disabled = false;
    elements.btnNativeListTools.textContent = 'ツール一覧';
  }
}

/**
 * Handle tool selection change
 */
function onToolSelectChange() {
  const selectedTool = elements.nativeToolSelect.value;
  elements.btnNativeCallTool.disabled = !selectedTool;
}

/**
 * Call selected MCP tool
 */
async function callNativeTool() {
  const toolName = elements.nativeToolSelect.value;
  if (!toolName) {
    showToast('ツールを選択してください');
    return;
  }

  if (!nativeMcpClient || !nativeMcpClient.isConnected()) {
    showToast('MCPに接続してください');
    return;
  }

  try {
    elements.btnNativeCallTool.disabled = true;
    elements.btnNativeCallTool.textContent = '実行中...';

    // For testing, use simple arguments based on tool name
    let args = {};
    if (toolName.includes('navigate')) {
      args = { url: 'https://www.google.com' };
    } else if (toolName.includes('snapshot') || toolName.includes('screenshot')) {
      args = {};
    }

    showNativeMcpResult('info', `⏳ ${toolName} を実行中...`);

    const result = await nativeMcpClient.callTool(toolName, args);
    console.log('Tool result:', result);

    showNativeMcpResult('success', `✅ 実行完了:\n${JSON.stringify(result, null, 2).substring(0, 500)}`);
    showToast('ツール実行成功！');

  } catch (error) {
    console.error('Call tool error:', error);
    showNativeMcpResult('error', `❌ 実行エラー: ${error.message}`);
  } finally {
    elements.btnNativeCallTool.disabled = false;
    elements.btnNativeCallTool.textContent = '実行';
  }
}

/**
 * Show Native MCP result
 */
function showNativeMcpResult(type, message) {
  elements.nativeMcpResult.className = `mcp-result ${type}`;
  elements.nativeMcpResult.textContent = message;
  elements.nativeMcpResult.classList.remove('hidden');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
