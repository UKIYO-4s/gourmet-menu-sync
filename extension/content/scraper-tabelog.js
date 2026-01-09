/**
 * Tabelog Scraper
 * Menu Simulator Extension
 *
 * Scrapes menu/course data from Tabelog restaurant pages
 */

const TabelogScraper = {
  platform: 'tabelog',
  platformName: '食べログ',

  /**
   * Check if current page is a scrapeable Tabelog page
   */
  canScrape() {
    const url = window.location.href;
    // Match menu pages: /menu/, /party/, /dtlmenu/
    return /tabelog\.com\/[^\/]+\/[^\/]+\/[^\/]+\/\d+\/(menu|party|dtlmenu)/.test(url);
  },

  /**
   * Get shop name from page
   */
  getShopName() {
    // Try various selectors for shop name
    const selectors = [
      '.rdheader-rstname a',
      '.rstinfo-table__name-wrap a',
      'h2.display-name a',
      '.rst-name a'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return ScraperBase.cleanText(el.textContent);
      }
    }

    return document.title.split(' - ')[0] || 'Unknown Shop';
  },

  /**
   * Scrape course/menu cards from page
   */
  async scrape(options = {}) {
    const { includeImages = true } = options;

    ScraperBase.showIndicator('食べログからメニューを取得中...');

    try {
      const items = [];
      const categories = new Map();

      // Try to scrape course list first
      const courseItems = await this.scrapeCourseList(includeImages);
      if (courseItems.length > 0) {
        items.push(...courseItems);
      }

      // Also try menu list
      const menuItems = await this.scrapeMenuList(includeImages);
      if (menuItems.length > 0) {
        items.push(...menuItems);
      }

      // Extract unique categories
      items.forEach(item => {
        if (item.categoryName && !categories.has(item.categoryName)) {
          categories.set(item.categoryName, {
            id: ScraperBase.generateId('cat'),
            name: item.categoryName,
            color: this.getCategoryColor(item.categoryName),
            order: categories.size
          });
        }
      });

      // Assign category IDs to items
      items.forEach(item => {
        if (item.categoryName && categories.has(item.categoryName)) {
          item.categoryId = categories.get(item.categoryName).id;
        }
        delete item.categoryName;
      });

      const result = {
        platform: this.platform,
        platformName: this.platformName,
        shop: {
          name: this.getShopName(),
          url: window.location.href,
          scrapedAt: new Date().toISOString()
        },
        categories: Array.from(categories.values()),
        items: items
      };

      ScraperBase.showSuccess(items.length);
      return result;

    } catch (error) {
      console.error('[Tabelog Scraper] Error:', error);
      ScraperBase.showError('取得に失敗しました');
      throw error;
    }
  },

  /**
   * Scrape course list (party/course pages)
   */
  async scrapeCourseList(includeImages) {
    const items = [];

    // Course cards selector - based on actual Tabelog structure
    const courseCards = document.querySelectorAll('.rstdtl-course-list__item, .rstdtl-party-list__item, .crs-dtl-course-item');

    for (const card of courseCards) {
      const item = await this.parseCourseCard(card, includeImages);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },

  /**
   * Scrape menu list (menu pages)
   */
  async scrapeMenuList(includeImages) {
    const items = [];

    // Menu items selector
    const menuCards = document.querySelectorAll('.rstdtl-menu-lst__item, .rstdtl-menu-item');

    for (const card of menuCards) {
      const item = await this.parseMenuCard(card, includeImages);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },

  /**
   * Parse a course card element
   */
  async parseCourseCard(card, includeImages) {
    try {
      // Course name (grade/title)
      const nameEl = card.querySelector('.crs-dtl-course-item__title a, .rstdtl-course-list__course-title a, a.crs-dtl-course-item__title-target');
      const name = nameEl ? ScraperBase.cleanText(nameEl.textContent) : null;

      if (!name) return null;

      // Price
      const priceEl = card.querySelector('.crs-dtl-course-item__price, .rstdtl-course-list__price');
      const priceText = priceEl ? priceEl.textContent : '';
      const price = ScraperBase.extractPrice(priceText);

      // Tax type
      const taxType = ScraperBase.detectTaxType(priceText);

      // Description
      const descEl = card.querySelector('.crs-dtl-course-item__contents, .rstdtl-course-list__course-content');
      const description = descEl ? ScraperBase.cleanText(descEl.textContent) : '';

      // Category (look for section heading)
      const categoryName = this.findCategoryName(card);

      // Image
      let image = null;
      if (includeImages) {
        const imgUrl = ScraperBase.getImageUrl(card, '.crs-dtl-course-item__photo img, .rstdtl-course-list__course-photo img');
        if (imgUrl) {
          image = await ScraperBase.imageToBase64(imgUrl);
        }
      }

      return {
        id: ScraperBase.generateId('item'),
        name,
        price: price || 0,
        taxType,
        description,
        image,
        categoryName: categoryName || 'コース',
        order: 0,
        hidden: false
      };
    } catch (error) {
      console.warn('[Tabelog Scraper] Failed to parse course card:', error);
      return null;
    }
  },

  /**
   * Parse a menu card element
   */
  async parseMenuCard(card, includeImages) {
    try {
      // Menu name
      const nameEl = card.querySelector('.rstdtl-menu-lst__menu-title, .rstdtl-menu-item__title');
      const name = nameEl ? ScraperBase.cleanText(nameEl.textContent) : null;

      if (!name) return null;

      // Price
      const priceEl = card.querySelector('.rstdtl-menu-lst__price, .rstdtl-menu-item__price');
      const priceText = priceEl ? priceEl.textContent : '';
      const price = ScraperBase.extractPrice(priceText);

      // Tax type
      const taxType = ScraperBase.detectTaxType(priceText);

      // Description
      const descEl = card.querySelector('.rstdtl-menu-lst__ex, .rstdtl-menu-item__description');
      const description = descEl ? ScraperBase.cleanText(descEl.textContent) : '';

      // Category
      const categoryName = this.findCategoryName(card);

      // Image
      let image = null;
      if (includeImages) {
        const imgUrl = ScraperBase.getImageUrl(card, '.rstdtl-menu-lst__photo img, .rstdtl-menu-item__photo img');
        if (imgUrl) {
          image = await ScraperBase.imageToBase64(imgUrl);
        }
      }

      return {
        id: ScraperBase.generateId('item'),
        name,
        price: price || 0,
        taxType,
        description,
        image,
        categoryName: categoryName || 'メニュー',
        order: 0,
        hidden: false
      };
    } catch (error) {
      console.warn('[Tabelog Scraper] Failed to parse menu card:', error);
      return null;
    }
  },

  /**
   * Find category name from card context
   */
  findCategoryName(card) {
    // Look for parent section heading
    let parent = card.parentElement;
    while (parent) {
      const heading = parent.querySelector('.rstdtl-menu-lst__head-title, .rstdtl-course-list__head-title, h3, h4');
      if (heading) {
        return ScraperBase.cleanText(heading.textContent);
      }
      parent = parent.parentElement;
      if (parent === document.body) break;
    }
    return null;
  },

  /**
   * Get category color based on name
   */
  getCategoryColor(name) {
    if (!name) return '#95a5a6';
    if (name.includes('ドリンク') || name.includes('飲み')) return '#3498db';
    if (name.includes('コース') || name.includes('宴会')) return '#9b59b6';
    if (name.includes('デザート') || name.includes('甘')) return '#f39c12';
    if (name.includes('料理') || name.includes('フード')) return '#e74c3c';
    return '#95a5a6';
  }
};

// Register scraper
window.TabelogScraper = TabelogScraper;

// Listen for scrape commands from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCRAPE_PAGE' && TabelogScraper.canScrape()) {
    TabelogScraper.scrape(request.options || {})
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

console.log('[Tabelog Scraper] Content script loaded');
