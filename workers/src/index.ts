import { parseHTML } from 'linkedom';

interface Env {
  SELECTORS: KVNamespace;
  AI: Ai;
  ENVIRONMENT: string;
}

interface ValidateRequest {
  site: 'tabelog' | 'hotpepper' | 'gurunavi';
  page: string;
  html: string;
  url: string;
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

interface ValidateResponse {
  status: 'GO' | 'ERROR';
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
    return {
      status: 'ERROR',
      error_type: 'PAGE_NOT_FOUND',
      matched_elements: [],
      validation_time_ms: Date.now() - startTime
    };
  }

  // Parse HTML
  const { document } = parseHTML(req.html);

  const matchedElements: MatchedElement[] = [];
  const missingElements: { id: string; expected_selector: string; tried_alternatives: boolean }[] = [];
  let needsHealing = false;

  // Check each required element
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
      missingElements.push({
        id: element.id,
        expected_selector: element.selector,
        tried_alternatives: triedAlternatives
      });
    }
  }

  // If elements are missing, try AI healing
  if (needsHealing && missingElements.length > 0) {
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
        }
      }

      // Update KV with healed selectors if successful
      if (missingElements.length === 0) {
        await updateSelectorsInKV(env, req.site, selectors, healResult.healedSelectors);
      }

      return {
        status: missingElements.length === 0 ? 'GO' : 'ERROR',
        healed: true,
        matched_elements: matchedElements,
        ai_analysis: healResult.analysis,
        updated_selectors: healResult.healedSelectors.map(h => ({
          id: h.id,
          old: h.oldSelector,
          new: h.newSelector
        })),
        missing_elements: missingElements.length > 0 ? missingElements : undefined,
        validation_time_ms: Date.now() - startTime
      };
    }

    return {
      status: 'ERROR',
      error_type: 'SELECTOR_NOT_FOUND',
      matched_elements: matchedElements,
      missing_elements: missingElements,
      ai_analysis: healResult.analysis || 'AI healing failed',
      validation_time_ms: Date.now() - startTime
    };
  }

  return {
    status: 'GO',
    matched_elements: matchedElements,
    validation_time_ms: Date.now() - startTime
  };
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
