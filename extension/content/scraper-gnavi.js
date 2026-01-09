/**
 * Gurunavi Scraper
 * Menu Simulator Extension
 *
 * Scrapes menu/course data from Gurunavi restaurant pages
 */

const GnaviScraper = {
  platform: 'gnavi',
  platformName: 'ぐるなび',

  /**
   * Check if current page is a scrapeable Gurunavi page
   */
  canScrape() {
    const url = window.location.href;
    // Match menu pages: /menu1-9/
    return /r\.gnavi\.co\.jp\/[a-z0-9]+\/menu\d*/.test(url);
  },

  /**
   * Get shop name from page
   */
  getShopName() {
    const selectors = [
      '.restaurant-name',
      '#info-name',
      'h1.restaurant-header__name',
      '.basic-info .name'
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

    ScraperBase.showIndicator('ぐるなびからメニューを取得中...');

    try {
      const items = [];
      const categories = new Map();

      // Scrape menu sections
      const menuItems = await this.scrapeMenuSections(includeImages);
      if (menuItems.length > 0) {
        items.push(...menuItems);
      }

      // Scrape course list if on course page
      const courseItems = await this.scrapeCourseList(includeImages);
      if (courseItems.length > 0) {
        items.push(...courseItems);
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
      console.error('[Gnavi Scraper] Error:', error);
      ScraperBase.showError('取得に失敗しました');
      throw error;
    }
  },

  /**
   * Scrape menu sections (regular menu pages)
   */
  async scrapeMenuSections(includeImages) {
    const items = [];

    // Find all menu sections with category headers
    const sections = document.querySelectorAll('.menu-section, .menuBox, [class*="menu-list"]');

    for (const section of sections) {
      // Get category name from section header
      const headerEl = section.querySelector('.menu-section-header, .menuBoxHead, h2, h3');
      const categoryName = headerEl ? ScraperBase.cleanText(headerEl.textContent) : null;

      // Get menu items within this section
      const menuCards = section.querySelectorAll('.menu-item, .menuItem, .menu-list-item');

      for (const card of menuCards) {
        const item = await this.parseMenuCard(card, includeImages, categoryName);
        if (item) {
          items.push(item);
        }
      }
    }

    // Also try standalone menu items
    const standaloneCards = document.querySelectorAll('.menu-content__item, .menuListItem');
    for (const card of standaloneCards) {
      const item = await this.parseMenuCard(card, includeImages, null);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },

  /**
   * Scrape course list
   */
  async scrapeCourseList(includeImages) {
    const items = [];

    // Course cards selector
    const courseCards = document.querySelectorAll('.course-item, .courseItem, .course-list__item');

    for (const card of courseCards) {
      const item = await this.parseCourseCard(card, includeImages);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },

  /**
   * Parse a menu card element
   */
  async parseMenuCard(card, includeImages, defaultCategory) {
    try {
      // Menu name
      const nameEl = card.querySelector('.menu-item-name, .menuItemName, .menu-name, [class*="name"]');
      const name = nameEl ? ScraperBase.cleanText(nameEl.textContent) : null;

      if (!name) return null;

      // Price
      const priceEl = card.querySelector('.menu-item-price, .menuItemPrice, .menu-price, [class*="price"]');
      const priceText = priceEl ? priceEl.textContent : '';
      const price = ScraperBase.extractPrice(priceText);

      // Tax type
      const taxType = ScraperBase.detectTaxType(priceText);

      // Description
      const descEl = card.querySelector('.menu-item-desc, .menuItemDesc, .menu-description, [class*="caption"]');
      const description = descEl ? ScraperBase.cleanText(descEl.textContent) : '';

      // Category
      const categoryName = defaultCategory || this.findCategoryName(card) || 'メニュー';

      // Image
      let image = null;
      if (includeImages) {
        const imgUrl = ScraperBase.getImageUrl(card, '.menu-item-img img, .menuItemImg img, img');
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
        categoryName,
        order: 0,
        hidden: false
      };
    } catch (error) {
      console.warn('[Gnavi Scraper] Failed to parse menu card:', error);
      return null;
    }
  },

  /**
   * Parse a course card element
   */
  async parseCourseCard(card, includeImages) {
    try {
      // Course name
      const nameEl = card.querySelector('.course-item-name, .courseName, .course-name, [class*="title"]');
      const name = nameEl ? ScraperBase.cleanText(nameEl.textContent) : null;

      if (!name) return null;

      // Price
      const priceEl = card.querySelector('.course-item-price, .coursePrice, .course-price, [class*="price"]');
      const priceText = priceEl ? priceEl.textContent : '';
      const price = ScraperBase.extractPrice(priceText);

      // Tax type
      const taxType = ScraperBase.detectTaxType(priceText);

      // Description
      const descEl = card.querySelector('.course-item-desc, .courseDesc, .course-content');
      const description = descEl ? ScraperBase.cleanText(descEl.textContent) : '';

      // Image
      let image = null;
      if (includeImages) {
        const imgUrl = ScraperBase.getImageUrl(card, '.course-item-img img, .courseImg img, img');
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
        categoryName: 'コース',
        order: 0,
        hidden: false
      };
    } catch (error) {
      console.warn('[Gnavi Scraper] Failed to parse course card:', error);
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
      const heading = parent.querySelector('h2, h3, .category-title, .section-title');
      if (heading) {
        const text = ScraperBase.cleanText(heading.textContent);
        if (text && text.length < 30) {
          return text;
        }
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
window.GnaviScraper = GnaviScraper;

// Listen for scrape commands from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCRAPE_PAGE' && GnaviScraper.canScrape()) {
    GnaviScraper.scrape(request.options || {})
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

console.log('[Gnavi Scraper] Content script loaded');
