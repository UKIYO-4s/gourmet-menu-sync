import { parseHTML } from 'linkedom';

interface Env {
  SELECTORS: KVNamespace;
  AI: Ai;
  ENVIRONMENT: string;
}

interface ActionRequest {
  type: 'search' | 'fill' | 'click';
  keyword?: string;
  data?: Record<string, string>;
  target?: string;
}

interface Command {
  tool: 'fill_form' | 'press_key' | 'click' | 'wait';
  args: Record<string, string | number>;
}

interface ValidateRequest {
  site: string;
  page: string;
  html: string;
  url: string;
  action?: ActionRequest;
}

interface SelectorDefinition {
  version: string;
  site: string;
  displayName: string;
  baseUrl: string;
  pages: {
    [pageName: string]: {
      url_pattern: string;
      description: string;
      required_elements: ElementDefinition[];
      page_indicators: string[];
    };
  };
}

interface ElementDefinition {
  id: string;
  selector: string;
  alternatives: string[];
  type: 'input' | 'textarea' | 'button' | 'select' | 'file';
  description: string;
}

interface MatchedElement {
  id: string;
  selector: string;
  found: boolean;
  healed?: boolean;
}

interface ValidationResult {
  logic_check: 'MATCH' | 'MISMATCH' | 'PARTIAL';
  ai_check?: {
    confirmed: boolean;
    confidence: number;
    analysis: string;
    original_selector?: string;
    healed_selector?: string;
  };
}

interface ValidateResponse {
  task_completed: boolean;
  status: 'GO' | 'ERROR';
  validation?: ValidationResult;
  execution?: {
    selector_used?: string;
    healed: boolean;
    kv_updated?: boolean;
  };
  commands?: Command[];
  healed?: boolean;
  matched_elements: MatchedElement[];
  ai_analysis?: string;
  updated_selectors?: { id: string; old: string; new: string }[];
  missing_elements?: { id: string; expected_selector: string; tried_alternatives: boolean }[];
  validation_time_ms: number;
  error_type?: string;
}

// Default selectors (fallback)
const defaultSelectors: Record<string, SelectorDefinition> = {
  tabelog: {
    version: '2025-01-09',
    site: 'tabelog',
    displayName: '食べログ',
    baseUrl: 'https://owner.tabelog.com',
    pages: {
      menu_edit: {
        url_pattern: 'owner.tabelog.com/.*/menu/edit/.*',
        description: 'メニュー編集ページ',
        required_elements: [
          { id: 'menu_name', selector: 'input[name="menu_name"]', alternatives: ['#menu-name', '.menu-name-input'], type: 'input', description: 'メニュー名入力' },
          { id: 'menu_price', selector: 'input[name="price"]', alternatives: ['#price', '.price-input'], type: 'input', description: '価格入力' },
          { id: 'save_button', selector: 'button[type="submit"]', alternatives: ['.btn-save', '.submit-btn', '#save-btn'], type: 'button', description: '保存ボタン' }
        ],
        page_indicators: ['.menu-edit-form', '#menu-editor']
      }
    }
  },
  hotpepper: {
    version: '2025-01-09',
    site: 'hotpepper',
    displayName: 'ホットペッパーグルメ',
    baseUrl: 'https://restaurant.hotpepper.jp',
    pages: {
      menu_edit: {
        url_pattern: 'restaurant.hotpepper.jp/.*/menu/edit/.*',
        description: 'メニュー編集ページ',
        required_elements: [
          { id: 'menu_name', selector: 'input[name="menuName"]', alternatives: ['#menuName', '.menu-title-input'], type: 'input', description: 'メニュー名入力' },
          { id: 'menu_price', selector: 'input[name="menuPrice"]', alternatives: ['#menuPrice', '.menu-price-input'], type: 'input', description: '価格入力' },
          { id: 'save_button', selector: '.btn-primary[type="submit"]', alternatives: ['.save-menu-btn', '#submit-menu'], type: 'button', description: '保存ボタン' }
        ],
        page_indicators: ['.menu-form', '#menu-edit-container']
      }
    }
  },
  gurunavi: {
    version: '2025-01-09',
    site: 'gurunavi',
    displayName: 'ぐるなび',
    baseUrl: 'https://pro.gnavi.co.jp',
    pages: {
      menu_edit: {
        url_pattern: 'pro.gnavi.co.jp/.*/menu/edit/.*',
        description: 'メニュー編集ページ',
        required_elements: [
          { id: 'menu_name', selector: 'input#menu-name', alternatives: ['input[name="name"]', '.menu-name'], type: 'input', description: 'メニュー名入力' },
          { id: 'menu_price', selector: 'input#menu-price', alternatives: ['input[name="price"]', '.menu-price'], type: 'input', description: '価格入力' },
          { id: 'save_button', selector: 'button.save-btn', alternatives: ['#save-menu', '.btn-submit'], type: 'button', description: '保存ボタン' }
        ],
        page_indicators: ['.menu-editor', '#menu-form']
      }
    }
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Root path - API info
    if (url.pathname === '/' || url.pathname === '') {
      return Response.json({
        name: 'Gourmet Selector Validator API',
        version: '1.0.0',
        description: 'DOM検証 + セルフヒーリング セレクタシステム',
        endpoints: {
          'GET /health': 'ヘルスチェック',
          'GET /selectors?site=tabelog': 'セレクタ定義取得',
          'POST /validate': 'DOM検証 + AI修復',
          'POST /selectors': 'セレクタ手動更新'
        },
        supported_sites: ['tabelog', 'hotpepper', 'gurunavi'],
        status: 'running'
      }, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders });
    }

    // Get selectors endpoint
    if (url.pathname === '/selectors' && request.method === 'GET') {
      const site = url.searchParams.get('site');
      if (!site) {
        return Response.json({ error: 'site parameter required' }, { status: 400, headers: corsHeaders });
      }

      const selectors = await getSelectors(env, site);
      return Response.json(selectors, { headers: corsHeaders });
    }

    // Validate endpoint
    if (url.pathname === '/validate' && request.method === 'POST') {
      try {
        const body = await request.json() as ValidateRequest;
        const result = await validateAndHeal(body, env);
        return Response.json(result, { headers: corsHeaders });
      } catch (error) {
        return Response.json(
          { status: 'ERROR', error_type: 'PARSE_ERROR', message: String(error) },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Update selectors endpoint (for manual updates)
    if (url.pathname === '/selectors' && request.method === 'POST') {
      try {
        const body = await request.json() as { site: string; selectors: SelectorDefinition };
        await env.SELECTORS.put(`selectors:${body.site}`, JSON.stringify(body.selectors));
        return Response.json({ success: true }, { headers: corsHeaders });
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 400, headers: corsHeaders });
      }
    }

    return Response.json({ error: 'Not Found' }, { status: 404, headers: corsHeaders });
  }
};

async function getSelectors(env: Env, site: string): Promise<SelectorDefinition> {
  const stored = await env.SELECTORS.get(`selectors:${site}`, 'json') as SelectorDefinition | null;
  if (stored) {
    return stored;
  }
  return defaultSelectors[site] || defaultSelectors.tabelog;
}

async function validateAndHeal(req: ValidateRequest, env: Env): Promise<ValidateResponse> {
  const startTime = Date.now();

  // Get selectors from KV or defaults
  const selectors = await getSelectors(env, req.site);
  const pageConfig = selectors.pages[req.page];

  if (!pageConfig) {
    // Even on error, try to generate best-effort commands if action provided
    const bestEffortCommands = req.action ? generateBestEffortCommands(req.action) : undefined;
    return {
      task_completed: false,
      status: 'ERROR',
      error_type: 'PAGE_NOT_FOUND',
      matched_elements: [],
      commands: bestEffortCommands,
      validation_time_ms: Date.now() - startTime
    };
  }

  // Parse HTML
  const { document } = parseHTML(req.html);

  const matchedElements: MatchedElement[] = [];
  const missingElements: { id: string; expected_selector: string; tried_alternatives: boolean }[] = [];
  let needsHealing = false;
  let logicCheckResult: 'MATCH' | 'MISMATCH' | 'PARTIAL' = 'MATCH';

  // Step 1: Logic Check - Check each required element
  for (const element of pageConfig.required_elements) {
    let found = document.querySelector(element.selector);
    let usedSelector = element.selector;
    let triedAlternatives = false;

    // Try alternatives if main selector fails
    if (!found && element.alternatives) {
      triedAlternatives = true;
      for (const alt of element.alternatives) {
        found = document.querySelector(alt);
        if (found) {
          usedSelector = alt;
          logicCheckResult = 'PARTIAL'; // Used alternative
          break;
        }
      }
    }

    if (found) {
      matchedElements.push({
        id: element.id,
        selector: usedSelector,
        found: true,
        healed: usedSelector !== element.selector
      });
    } else {
      needsHealing = true;
      logicCheckResult = 'MISMATCH';
      missingElements.push({
        id: element.id,
        expected_selector: element.selector,
        tried_alternatives: triedAlternatives
      });
    }
  }

  // Step 2: AI Check (always run for dual validation)
  let aiCheckResult: ValidationResult['ai_check'] | undefined;
  let kvUpdated = false;

  if (needsHealing && missingElements.length > 0) {
    // AI Healing mode
    const healResult = await attemptAIHealing(req.html, req.site, missingElements, env);

    if (healResult.success) {
      // Verify healed selectors work
      for (const healed of healResult.healedSelectors) {
        const found = document.querySelector(healed.newSelector);
        if (found) {
          matchedElements.push({
            id: healed.id,
            selector: healed.newSelector,
            found: true,
            healed: true
          });

          // Remove from missing
          const idx = missingElements.findIndex(m => m.id === healed.id);
          if (idx !== -1) {
            missingElements.splice(idx, 1);
          }

          aiCheckResult = {
            confirmed: true,
            confidence: 0.88,
            analysis: healResult.analysis || 'セレクタを自動修復しました',
            original_selector: healed.oldSelector,
            healed_selector: healed.newSelector
          };
        }
      }

      // Update KV with healed selectors if successful
      if (missingElements.length === 0) {
        await updateSelectorsInKV(env, req.site, selectors, healResult.healedSelectors);
        kvUpdated = true;
      }
    } else {
      aiCheckResult = {
        confirmed: false,
        confidence: 0.3,
        analysis: healResult.analysis || 'AI修復に失敗しました'
      };
    }
  } else {
    // AI Confirmation mode (validate that found elements are correct)
    const confirmResult = await confirmWithAI(req.html, req.site, matchedElements, env);
    aiCheckResult = {
      confirmed: confirmResult.confirmed,
      confidence: confirmResult.confidence,
      analysis: confirmResult.analysis
    };
  }

  // Generate commands based on action (ALWAYS generate if action provided)
  const commands = req.action ? generateCommands(req.action, matchedElements, pageConfig) : undefined;
  const isSuccess = missingElements.length === 0;

  // Build validation result
  const validation: ValidationResult = {
    logic_check: logicCheckResult,
    ai_check: aiCheckResult
  };

  // Find the selector used for execution
  const primaryElement = matchedElements.find(e =>
    e.id === 'search_input' || e.id === 'menu_name' || e.id.includes('input')
  );

  return {
    task_completed: isSuccess || commands !== undefined, // Task can complete even with partial success
    status: isSuccess ? 'GO' : 'ERROR',
    validation,
    execution: {
      selector_used: primaryElement?.selector,
      healed: matchedElements.some(e => e.healed),
      kv_updated: kvUpdated
    },
    commands,
    healed: matchedElements.some(e => e.healed),
    matched_elements: matchedElements,
    ai_analysis: aiCheckResult?.analysis,
    updated_selectors: matchedElements.filter(e => e.healed).map(e => ({
      id: e.id,
      old: '', // Would need to track original
      new: e.selector
    })),
    missing_elements: missingElements.length > 0 ? missingElements : undefined,
    error_type: !isSuccess ? 'SELECTOR_NOT_FOUND' : undefined,
    validation_time_ms: Date.now() - startTime
  };
}

// Generate commands based on action type and matched elements
function generateCommands(action: ActionRequest, matchedElements: MatchedElement[], pageConfig: { required_elements: ElementDefinition[] }): Command[] {
  const commands: Command[] = [];

  switch (action.type) {
    case 'search': {
      const inputElement = matchedElements.find(e => e.id === 'search_input' || e.id.includes('input'));
      if (inputElement && action.keyword) {
        commands.push({
          tool: 'fill_form',
          args: { selector: inputElement.selector, value: action.keyword }
        });
        commands.push({
          tool: 'press_key',
          args: { key: 'Enter' }
        });
      }
      break;
    }
    case 'fill': {
      if (action.data) {
        for (const [fieldId, value] of Object.entries(action.data)) {
          const element = matchedElements.find(e => e.id === fieldId);
          if (element) {
            commands.push({
              tool: 'fill_form',
              args: { selector: element.selector, value }
            });
          }
        }
      }
      break;
    }
    case 'click': {
      const targetElement = matchedElements.find(e => e.id === action.target || e.id.includes('button'));
      if (targetElement) {
        commands.push({
          tool: 'click',
          args: { selector: targetElement.selector }
        });
      }
      break;
    }
  }

  return commands;
}

// Generate best-effort commands when page config not found
function generateBestEffortCommands(action: ActionRequest): Command[] {
  const commands: Command[] = [];

  switch (action.type) {
    case 'search':
      if (action.keyword) {
        // Try common search selectors
        commands.push({
          tool: 'fill_form',
          args: { selector: 'input[type="search"], input[name="q"], input[aria-label*="検索"]', value: action.keyword }
        });
        commands.push({
          tool: 'press_key',
          args: { key: 'Enter' }
        });
      }
      break;
  }

  return commands;
}

// AI confirmation for found elements
async function confirmWithAI(
  html: string,
  site: string,
  matchedElements: MatchedElement[],
  env: Env
): Promise<{ confirmed: boolean; confidence: number; analysis: string }> {
  try {
    const truncatedHtml = html.substring(0, 10000);

    const prompt = `あなたはHTML解析の専門家です。以下の${site}サイトで、指定されたセレクタが正しい要素を指しているか確認してください。

見つかった要素:
${matchedElements.map(e => `- ${e.id}: "${e.selector}"`).join('\n')}

HTML (一部):
${truncatedHtml}

以下のJSON形式のみで回答:
{"confirmed": true/false, "confidence": 0.0-1.0, "analysis": "日本語で簡潔に"}

JSONのみ出力:`;

    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt,
      max_tokens: 200
    });

    const responseText = typeof response === 'string' ? response : (response as { response: string }).response;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        confirmed: parsed.confirmed ?? true,
        confidence: parsed.confidence ?? 0.9,
        analysis: parsed.analysis ?? '確認完了'
      };
    }

    return { confirmed: true, confidence: 0.8, analysis: 'AI確認完了（パース警告）' };
  } catch {
    return { confirmed: true, confidence: 0.7, analysis: 'AI確認スキップ（エラー）' };
  }
}

interface HealResult {
  success: boolean;
  healedSelectors: { id: string; oldSelector: string; newSelector: string }[];
  analysis?: string;
}

async function attemptAIHealing(
  html: string,
  site: string,
  missingElements: { id: string; expected_selector: string }[],
  env: Env
): Promise<HealResult> {
  try {
    // Truncate HTML to fit within token limits
    const truncatedHtml = html.substring(0, 15000);

    const prompt = `あなたはHTML解析の専門家です。以下の${site}サイトのHTMLから、指定された要素のCSSセレクタを提案してください。

探している要素:
${missingElements.map(e => `- ${e.id}: 以前は "${e.expected_selector}" でしたが見つかりません`).join('\n')}

HTML (一部):
${truncatedHtml}

以下のJSON形式のみで回答してください:
{
  "selectors": [
    {"id": "要素ID", "selector": "新しいCSSセレクタ", "confidence": 0.9}
  ],
  "analysis": "変更の分析（日本語で簡潔に）"
}

JSONのみ出力:`;

    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt,
      max_tokens: 500
    });

    // Parse AI response
    const responseText = typeof response === 'string' ? response : (response as { response: string }).response;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, healedSelectors: [], analysis: 'AI response did not contain valid JSON' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      selectors: { id: string; selector: string; confidence: number }[];
      analysis: string;
    };

    const healedSelectors = parsed.selectors
      .filter(s => s.confidence >= 0.7)
      .map(s => {
        const original = missingElements.find(m => m.id === s.id);
        return {
          id: s.id,
          oldSelector: original?.expected_selector || '',
          newSelector: s.selector
        };
      });

    return {
      success: healedSelectors.length > 0,
      healedSelectors,
      analysis: parsed.analysis
    };
  } catch (error) {
    console.error('AI healing error:', error);
    return {
      success: false,
      healedSelectors: [],
      analysis: `AI analysis failed: ${String(error)}`
    };
  }
}

async function updateSelectorsInKV(
  env: Env,
  site: string,
  currentSelectors: SelectorDefinition,
  healedSelectors: { id: string; newSelector: string }[]
): Promise<void> {
  // Create updated selectors
  const updated = { ...currentSelectors };

  for (const page of Object.values(updated.pages)) {
    for (const element of page.required_elements) {
      const healed = healedSelectors.find(h => h.id === element.id);
      if (healed) {
        // Add old selector to alternatives
        if (!element.alternatives.includes(element.selector)) {
          element.alternatives.unshift(element.selector);
        }
        // Update main selector
        element.selector = healed.newSelector;
      }
    }
  }

  // Update version
  updated.version = new Date().toISOString().split('T')[0];

  // Save to KV
  await env.SELECTORS.put(`selectors:${site}`, JSON.stringify(updated));

  // Also save history
  await env.SELECTORS.put(
    `selectors:${site}:history:${Date.now()}`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      changes: healedSelectors
    })
  );
}
