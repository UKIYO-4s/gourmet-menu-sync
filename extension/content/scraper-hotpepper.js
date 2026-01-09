/**
 * HotPepper Scraper
 * Menu Simulator Extension
 *
 * Scrapes menu/course data from HotPepper restaurant pages
 */

const HotPepperScraper = {
  platform: 'hotpepper',
  platformName: 'ホットペッパー',

  /**
   * Check if current page is a scrapeable HotPepper page
   */
  canScrape() {
    const url = window.location.href;
    // Match menu/course pages
    return /hotpepper\.jp\/str[A-Z0-9]+\/(course|food|drink|menu)/.test(url);
  },

  /**
   * Get shop name from page
   */
  getShopName() {
    const selectors = [
      '.shopNameTitle',
      '.shopName h1',
      '.detailShopName',
      'h1.shopName'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return ScraperBase.cleanText(el.textContent);
      }
    }

    return document.title.split('｜')[0] || 'Unknown Shop';
  },

  /**
   * Scrape course/menu cards from page
   */
  async scrape(options = {}) {
    const { includeImages = true } = options;

    ScraperBase.showIndicator('ホットペッパーからメニューを取得中...');

    try {
      const items = [];
      const categories = new Map();

      // Scrape course list
      const courseItems = await this.scrapeCourseList(includeImages);
      if (courseItems.length > 0) {
        items.push(...courseItems);
      }

      // Scrape food menu
      const foodItems = await this.scrapeFoodList(includeImages);
      if (foodItems.length > 0) {
        items.push(...foodItems);
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
      console.error('[HotPepper Scraper] Error:', error);
      ScraperBase.showError('取得に失敗しました');
      throw error;
    }
  },

  /**
   * Scrape course list
   */
  async scrapeCourseList(includeImages) {
    const items = [];

    // Course cards selector - based on actual HotPepper structure
    const courseCards = document.querySelectorAll('.courseListWrap .courseList, .courseMenu .courseItem, .crsBox');

    for (const card of courseCards) {
      const item = await this.parseCourseCard(card, includeImages);
      if (item) {
        items.push(item);
      }
    }

    return items;
  },

  /**
   * Scrape food/drink menu list
   */
  async scrapeFoodList(includeImages) {
    const items = [];

    // Menu items selector
    const menuCards = document.querySelectorAll('.foodMenu .menuItem, .drinkMenu .menuItem, .menuListItem');

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
      // Course name
      const nameEl = card.querySelector('.courseListTitle a, .courseName, .crsName a');
      const name = nameEl ? ScraperBase.cleanText(nameEl.textContent) : null;

      if (!name) return null;

      // Price
      const priceEl = card.querySelector('.courseListPrice, .coursePrice, .crsPrice');
      const priceText = priceEl ? priceEl.textContent : '';
      const price = ScraperBase.extractPrice(priceText);

      // Tax type
      const taxType = ScraperBase.detectTaxType(priceText);

      // Description
      const descEl = card.querySelector('.courseListEx, .courseDesc, .crsTxt');
      const description = descEl ? ScraperBase.cleanText(descEl.textContent) : '';

      // Category (look for section heading)
      const categoryName = this.findCategoryName(card);

      // Image
      let image = null;
      if (includeImages) {
        const imgUrl = ScraperBase.getImageUrl(card, '.courseListImg img, .courseImg img, .crsImg img');
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
      console.warn('[HotPepper Scraper] Failed to parse course card:', error);
      return null;
    }
  },

  /**
   * Parse a menu card element
   */
  async parseMenuCard(card, includeImages) {
    try {
      // Menu name
      const nameEl = card.querySelector('.menuName, .foodName, .drinkName');
      const name = nameEl ? ScraperBase.cleanText(nameEl.textContent) : null;

      if (!name) return null;

      // Price
      const priceEl = card.querySelector('.menuPrice, .foodPrice, .drinkPrice');
      const priceText = priceEl ? priceEl.textContent : '';
      const price = ScraperBase.extractPrice(priceText);

      // Tax type
      const taxType = ScraperBase.detectTaxType(priceText);

      // Description
      const descEl = card.querySelector('.menuEx, .foodEx, .drinkEx');
      const description = descEl ? ScraperBase.cleanText(descEl.textContent) : '';

      // Category
      const categoryName = this.findCategoryName(card);

      // Image
      let image = null;
      if (includeImages) {
        const imgUrl = ScraperBase.getImageUrl(card, '.menuImg img, .foodImg img, .drinkImg img');
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
      console.warn('[HotPepper Scraper] Failed to parse menu card:', error);
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
      const heading = parent.querySelector('.categoryTitle, .menuCategoryTitle, h2, h3');
      if (heading) {
        const text = ScraperBase.cleanText(heading.textContent);
        // Filter out generic titles
        if (text && !text.includes('一覧') && text.length < 30) {
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
window.HotPepperScraper = HotPepperScraper;

// Listen for scrape commands from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCRAPE_PAGE' && HotPepperScraper.canScrape()) {
    HotPepperScraper.scrape(request.options || {})
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

console.log('[HotPepper Scraper] Content script loaded');
