/**
 * Base Scraper - Common scraping utilities
 * Menu Simulator Extension
 */

const ScraperBase = {
  /**
   * Extract text content from element
   */
  getText(element, selector) {
    if (!element) return '';
    const el = selector ? element.querySelector(selector) : element;
    return el ? el.textContent.trim() : '';
  },

  /**
   * Extract number from text (price extraction)
   */
  extractPrice(text) {
    if (!text) return null;
    // Remove commas and extract digits
    const match = text.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  },

  /**
   * Extract image URL from element
   */
  getImageUrl(element, selector) {
    if (!element) return null;
    const img = selector ? element.querySelector(selector) : element.querySelector('img');
    if (!img) return null;

    // Check various image attributes
    return img.src || img.dataset.src || img.dataset.original || null;
  },

  /**
   * Convert image URL to base64
   */
  async imageToBase64(url) {
    if (!url) return null;

    try {
      const response = await fetch(url);
      const blob = await response.blob();

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('[Scraper] Failed to fetch image:', url, error);
      return null;
    }
  },

  /**
   * Generate unique ID
   */
  generateId(prefix = 'item') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Detect tax type from text
   */
  detectTaxType(text) {
    if (!text) return 'included';
    if (text.includes('税抜') || text.includes('税別') || text.includes('+税')) {
      return 'excluded';
    }
    return 'included';
  },

  /**
   * Clean text (remove extra whitespace, newlines)
   */
  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  },

  /**
   * Send scraped data to background script
   */
  async sendToBackground(data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'SCRAPED_DATA',
        payload: data
      }, (response) => {
        resolve(response);
      });
    });
  },

  /**
   * Show scraping indicator
   */
  showIndicator(message = 'スクレイピング中...') {
    // Remove existing indicator
    this.hideIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'menu-scraper-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    indicator.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      <span>${message}</span>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    document.body.appendChild(indicator);
  },

  /**
   * Hide scraping indicator
   */
  hideIndicator() {
    const existing = document.getElementById('menu-scraper-indicator');
    if (existing) {
      existing.remove();
    }
  },

  /**
   * Show success message
   */
  showSuccess(count) {
    this.hideIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'menu-scraper-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    indicator.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>${count}件のメニューを取得しました</span>
    `;

    document.body.appendChild(indicator);

    // Auto hide after 3 seconds
    setTimeout(() => this.hideIndicator(), 3000);
  },

  /**
   * Show error message
   */
  showError(message) {
    this.hideIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'menu-scraper-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    indicator.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>${message}</span>
    `;

    document.body.appendChild(indicator);

    // Auto hide after 5 seconds
    setTimeout(() => this.hideIndicator(), 5000);
  }
};

// Make available globally
window.ScraperBase = ScraperBase;
