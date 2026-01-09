/**
 * Background Service Worker
 * Menu Simulator Assistant
 *
 * Handles external messages from web app and internal messages from content scripts
 */

const VERSION = '2.0.0';

// State management
let state = {
  lastConnectedAt: null,
  connectedWebApps: [],
  lastScrapedData: null,
  scrapedDataHistory: []
};

// Platform detection patterns
const PLATFORM_PATTERNS = {
  tabelog: /tabelog\.com/,
  hotpepper: /hotpepper\.jp/,
  gnavi: /gnavi\.co\.jp/
};

/**
 * Detect platform from URL
 */
function detectPlatform(url) {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) {
      return platform;
    }
  }
  return null;
}

/**
 * Handle external messages from web app
 * Uses chrome.runtime.onMessageExternal for cross-origin communication
 */
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('[Background] External message received:', request);
    console.log('[Background] Sender:', sender);

    const { action, requestId, payload } = request;

    // Update connection state
    state.lastConnectedAt = new Date().toISOString();
    if (sender.origin && !state.connectedWebApps.includes(sender.origin)) {
      state.connectedWebApps.push(sender.origin);
    }

    // Handle actions
    switch (action) {
      case 'PING':
        sendResponse({
          success: true,
          data: { pong: true, timestamp: Date.now(), version: VERSION },
          requestId
        });
        break;

      case 'GET_VERSION':
        sendResponse({
          success: true,
          data: { version: VERSION },
          requestId
        });
        break;

      case 'GET_EXTENSION_ID':
        sendResponse({
          success: true,
          data: { extensionId: chrome.runtime.id },
          requestId
        });
        break;

      case 'GET_CURRENT_TAB':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            const platform = detectPlatform(tabs[0].url);
            sendResponse({
              success: true,
              data: {
                url: tabs[0].url,
                title: tabs[0].title,
                id: tabs[0].id,
                platform: platform,
                canScrape: platform !== null
              },
              requestId
            });
          } else {
            sendResponse({
              success: false,
              error: 'No active tab found',
              requestId
            });
          }
        });
        return true; // Keep channel open for async response

      case 'GET_STATE':
        sendResponse({
          success: true,
          data: {
            ...state,
            scrapedDataCount: state.scrapedDataHistory.length
          },
          requestId
        });
        break;

      case 'SEND_MENU_DATA':
        // Receive menu data from web app and store it
        console.log('[Background] Menu data received:', payload);
        chrome.storage.local.set({ lastMenuData: payload }, () => {
          sendResponse({
            success: true,
            data: { received: true, itemCount: payload?.items?.length || 0 },
            requestId
          });
        });
        return true; // Keep channel open for async response

      case 'SCRAPE_CURRENT_TAB':
        // Scrape data from current active tab
        scrapeCurrentTab(payload?.options || {})
          .then(data => {
            sendResponse({
              success: true,
              data: data,
              requestId
            });
          })
          .catch(error => {
            sendResponse({
              success: false,
              error: error.message,
              requestId
            });
          });
        return true; // Keep channel open for async response

      case 'GET_SCRAPED_DATA':
        // Return last scraped data
        sendResponse({
          success: true,
          data: state.lastScrapedData,
          requestId
        });
        break;

      case 'GET_SCRAPED_HISTORY':
        // Return scraped data history
        sendResponse({
          success: true,
          data: state.scrapedDataHistory,
          requestId
        });
        break;

      case 'CLEAR_SCRAPED_DATA':
        // Clear scraped data
        state.lastScrapedData = null;
        state.scrapedDataHistory = [];
        sendResponse({
          success: true,
          data: { cleared: true },
          requestId
        });
        break;

      default:
        sendResponse({
          success: false,
          error: `Unknown action: ${action}`,
          requestId
        });
    }

    return false; // Synchronous response (except for async cases above)
  }
);

/**
 * Handle internal messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    console.log('[Background] Internal message received:', request);

    const { action, payload } = request;

    switch (action) {
      case 'GET_STATE':
        sendResponse({ success: true, data: state });
        break;

      case 'GET_EXTENSION_ID':
        sendResponse({ success: true, data: { extensionId: chrome.runtime.id } });
        break;

      case 'SCRAPED_DATA':
        // Receive scraped data from content script
        if (payload) {
          state.lastScrapedData = payload;
          state.scrapedDataHistory.push({
            ...payload,
            receivedAt: new Date().toISOString()
          });
          // Keep only last 10 scrapes
          if (state.scrapedDataHistory.length > 10) {
            state.scrapedDataHistory.shift();
          }
          console.log('[Background] Scraped data stored:', payload.items?.length || 0, 'items');
        }
        sendResponse({ success: true, data: { stored: true } });
        break;

      case 'SCRAPE_PAGE':
        // Forward scrape request to content script in active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'SCRAPE_PAGE',
              options: payload?.options || {}
            }, (response) => {
              if (chrome.runtime.lastError) {
                sendResponse({
                  success: false,
                  error: chrome.runtime.lastError.message
                });
              } else {
                sendResponse(response);
              }
            });
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
        });
        return true; // Keep channel open

      default:
        sendResponse({ success: false, error: `Unknown action: ${action}` });
    }

    return false;
  }
);

/**
 * Scrape data from current active tab
 */
async function scrapeCurrentTab(options = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs[0]) {
        reject(new Error('No active tab found'));
        return;
      }

      const tab = tabs[0];
      const platform = detectPlatform(tab.url);

      if (!platform) {
        reject(new Error('Current page is not a supported gourmet site'));
        return;
      }

      try {
        // Send scrape command to content script
        chrome.tabs.sendMessage(tab.id, {
          action: 'SCRAPE_PAGE',
          options: options
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response && response.success) {
            // Store scraped data
            state.lastScrapedData = response.data;
            state.scrapedDataHistory.push({
              ...response.data,
              receivedAt: new Date().toISOString()
            });

            // Keep only last 10 scrapes
            if (state.scrapedDataHistory.length > 10) {
              state.scrapedDataHistory.shift();
            }

            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Scraping failed'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Service Worker installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First installation
    chrome.storage.local.set({
      settings: {
        autoFetch: false,
        fetchImages: true,
        developerMode: false
      }
    });
  }
});

/**
 * Service Worker activation
 */
self.addEventListener('activate', (event) => {
  console.log('[Background] Service Worker activated');
});

console.log('[Background] Service Worker started. Extension ID:', chrome.runtime.id);
