// 常量定义
const CONTAINER_CLASS = 'nexus-direct-link-container';
// URL监听设置的本地存储键名
const STORAGE_KEYS = {
  STANDARD_URL_ENABLED: 'standardUrlEnabled',
  GAME_LIST_URL_ENABLED: 'gameListUrlEnabled',
  MAX_CONCURRENT_REQUESTS: 'maxConcurrentRequests',
  REQUEST_DELAY: 'requestDelay'
};

// 添加表格相关样式
const STYLES = {
  CONTAINER: `
    margin: 10px 0;
    padding: 8px;
    background-color: #f8f9fa;
    border-radius: 8px;
    font-size: 14px;
  `,
  LOADING: `
    color: #666;
    font-size: 14px;
    padding: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  SUCCESS: `
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  ERROR: `
    color: #d32f2f;
    font-size: 14px;
    padding: 8px;
  `,
  // 添加表格相关样式
  TABLE_CONTAINER: `
    margin-top: 10px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  `,
  TABLE_SCROLL: `
    max-height: 400px;
    overflow-y: auto;
    width: 100%;
    background: white;
  `,
  TABLE: `
    width: 100%;
    border-collapse: collapse;
    background-color: white;
  `,
  TABLE_HEADER: `
    background-color: #f5f5f5;
    font-weight: 500;
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid #e0e0e0;
    position: sticky;
    top: 0;
    z-index: 1;
  `,
  TABLE_CELL: `
    padding: 12px;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: middle;
  `,
  EXPAND_BUTTON: `
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #1a73e8;
  `,
  COPY_ALL_BUTTON: `
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  `,
  ACTION_BUTTON: `
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    margin-right: 4px;
  `,
  ICON: `
    width: 16px;
    height: 16px;
  `
};

// 添加缓存对象
const parsedLinksCache = new Map();

// 缓存持久化相关
const CACHE_STORAGE_KEY = 'parsedLinksCache';
const CACHE_EXPIRATION_TIME = 12 * 60 * 60 * 1000; // 12小时的毫秒数

// 添加全局计数器
const globalCounters = {
  totalMods: 0,
  completedMods: 0,
  // 修改已处理模组ID的跟踪集合，使用gameName和modId的组合作为键
  processedModIds: new Map() // 改用Map来存储，key为gameName，value为Set<modId>
};

// 添加检查函数
function isChromeExtension() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

// 安全的存储操作函数
function safeStorageOperation(operation) {
  if (!isChromeExtension()) {
    console.warn('不在Chrome扩展环境中运行，存储操作将被跳过');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    operation(resolve);
  });
}

// 从本地存储恢复缓存
function restoreParsedLinksCache() {
  if (!isChromeExtension()) {
    console.warn('不在Chrome扩展环境中运行，缓存恢复将被跳过');
    return;
  }

  safeStorageOperation((resolve) => {
    chrome.storage.local.get([CACHE_STORAGE_KEY], (result) => {
      if (result && result[CACHE_STORAGE_KEY]) {
        try {
          const obj = JSON.parse(result[CACHE_STORAGE_KEY]);
          const now = Date.now();
          
          // 清理过期的缓存
          Object.entries(obj).forEach(([key, value]) => {
            if (value.timestamp && (now - value.timestamp < CACHE_EXPIRATION_TIME)) {
              parsedLinksCache.set(key, value);
            }
          });
          
          // 如果有过期的缓存，保存更新后的缓存
          if (Object.keys(obj).length !== parsedLinksCache.size) {
            saveParsedLinksCache();
          }
          
          console.log('直链缓存已恢复');
        } catch (e) {
          console.warn('直链缓存恢复失败', e);
        }
      }
      resolve();
    });
  });
}

// 保存缓存到本地存储
function saveParsedLinksCache() {
  if (!isChromeExtension()) {
    console.warn('不在Chrome扩展环境中运行，缓存保存将被跳过');
    return;
  }

  const obj = {};
  parsedLinksCache.forEach((value, key) => {
    obj[key] = value;
  });
  
  safeStorageOperation((resolve) => {
    chrome.storage.local.set({ [CACHE_STORAGE_KEY]: JSON.stringify(obj) }, resolve);
  });
}

// 获取缓存键
function getCacheKey(gameName, modId) {
  return `${gameName}_${modId}`;
}

// 从缓存获取直链
function getDirectLinksFromCache(gameName, modId) {
  const cacheKey = getCacheKey(gameName, modId);
  const cachedData = parsedLinksCache.get(cacheKey);
  
  if (!cachedData) return null;
  
  // 检查缓存是否过期
  const now = Date.now();
  if (cachedData.timestamp && (now - cachedData.timestamp >= CACHE_EXPIRATION_TIME)) {
    // 缓存已过期，删除它
    parsedLinksCache.delete(cacheKey);
    saveParsedLinksCache();
    return null;
  }
  
  return cachedData;
}

// 保存直链到缓存
function saveDirectLinksToCache(gameName, modId, downloadUrls, fullUrl) {
  const cacheKey = getCacheKey(gameName, modId);
  parsedLinksCache.set(cacheKey, {
    downloadUrls,
    fullUrl,
    timestamp: Date.now() // 添加时间戳
  });
  saveParsedLinksCache();
}

/**
 * 解析URL获取mod信息
 * @param {string} url 当前页面的URL
 * @returns {Object|null} 包含mod信息的对象，如果不是有效的mod页面则返回null
 */
function parseNexusUrl(url) {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('nexusmods.com')) {
      return null;
    }

    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // 处理标准mod页面URL格式
    if (pathParts.length >= 3 && pathParts[1] === 'mods') {
      const gameName = pathParts[0];
      const modId = pathParts[2];

      return {
        gameName,
        modId,
        isValid: true,
        isStandardModPage: true
      };
    }
    
    // 处理游戏列表页面URL格式
    if (pathParts.length >= 2 && pathParts[0] === 'games') {
      return {
        gameName: pathParts[1],
        isGameListPage: true,
        isValid: true
      };
    }

    return null;
  } catch (error) {
    console.error('URL解析错误:', error);
    return null;
  }
}

/**
 * 从游戏列表页面中提取所有模组ID
 * @returns {Array} 包含所有模组ID和对应元素的数组
 */
function extractModIdsFromGameListPage() {
  const modsData = [];
  const modsGrid = document.querySelector('.mods-grid');
  
  if (!modsGrid) {
    console.error('未找到模组网格元素');
    return modsData;
  }
  
  const modLinks = modsGrid.querySelectorAll('a[href*="/mods/"]');
  
  modLinks.forEach(link => {
    try {
      const href = link.getAttribute('href');
      const modIdMatch = href.match(/\/mods\/(\d+)/);
      
      if (modIdMatch && modIdMatch[1]) {
        const modId = modIdMatch[1];
        const modTile = link.closest('.mod-tile') || 
                        link.closest('[class*="mod-tile"]') || 
                        link.parentElement;
        
        if (modTile) {
          modsData.push({
            modId,
            element: modTile
          });
        }
      }
    } catch (error) {
      console.error('提取模组ID时出错:', error);
    }
  });
  
  return modsData;
}

// 创建加载动画
function createLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 12px;
    height: 12px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  return spinner;
}

// 添加解析状态控制
let isParsingEnabled = true;
let activeRequests = new Set(); // 用于跟踪活动的请求

// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isChromeExtension()) {
    console.warn('不在Chrome扩展环境中运行，消息监听将被跳过');
    return;
  }

  if (request.action === "modUrlDetected") {
    const { modInfo } = request;
    if (isParsingEnabled) {
      handleModUrlDetected(modInfo);
    }
  } else if (request.action === "toggleParsing") {
    isParsingEnabled = !isParsingEnabled;
    
    // 更新所有加载状态的显示，使用更精确的选择器
    document.querySelectorAll(`.${CONTAINER_CLASS}`).forEach(container => {
      // 查找加载中的内容 - 通过查找具有LOADING样式特征的元素
      const loadingContent = container.querySelector('div[style*="display: flex"][style*="align-items: center"][style*="gap: 8px"]');
      if (loadingContent) {
        // 确认是加载状态而不是已完成状态
        const isLoadingState = loadingContent.textContent.includes('获取直链') || 
                              loadingContent.textContent.includes('N网助手');
        
        if (isLoadingState) {
          // 移除现有的加载动画
          const existingSpinner = loadingContent.querySelector('div');
          if (existingSpinner) {
            existingSpinner.remove();
          }
          
          // 更新文本
          const loadingText = loadingContent.querySelector('span');
          if (loadingText) {
            loadingText.textContent = isParsingEnabled ? 'N网助手正在获取直链....' : '获取直链已暂停';
            
            // 如果恢复解析，添加加载动画
            if (isParsingEnabled) {
              const spinner = createLoadingSpinner();
              loadingContent.insertBefore(spinner, loadingText);
            }
          }
        }
      }
    });
    
    // 显示状态提示
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      transition: opacity 0.3s;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    // 添加图标
    const icon = document.createElement('span');
    icon.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${isParsingEnabled ? '#4CAF50' : '#FFA726'};
    `;
    statusContainer.appendChild(icon);
    
    // 添加文本
    const statusText = document.createElement('span');
    statusText.textContent = isParsingEnabled ? '已开启自动解析' : '已暂停自动解析';
    statusContainer.appendChild(statusText);
    
    document.body.appendChild(statusContainer);
    
    // 3秒后淡出
    setTimeout(() => {
      statusContainer.style.opacity = '0';
      setTimeout(() => statusContainer.remove(), 300);
    }, 3000);
    
    // 如果重新启用解析，立即处理当前页面
    if (isParsingEnabled) {
      const modInfo = parseNexusUrl(window.location.href);
      if (modInfo && modInfo.isValid) {
        handleModUrlDetected(modInfo);
      }
    }
  } else if (request.action === "getDirectLink") {
    const modInfo = parseNexusUrl(window.location.href);
    if (modInfo && modInfo.isValid) {
      // 发送消息给background.js获取所有下载链接
      chrome.runtime.sendMessage({
        action: "getAllDownloadUrls",
        modId: modInfo.modId,
        gameName: modInfo.gameName
      }, (response) => {
        if (response.success && response.downloadUrls) {
          sendResponse({ downloadUrls: response.downloadUrls });
        } else {
          sendResponse({ error: response.error || "获取下载链接失败" });
        }
      });
      return true; // 表示异步响应
    } else {
      sendResponse({ error: "不是有效的模组页面" });
    }
  } else if (request.action === "clearCache") {
    clearParsedLinksCache();
    sendResponse({ success: true });
  } else if (request.action === "aiAnalyzerInjected") {
    // 处理 AI 分析器注入成功的消息
    console.log('收到 AI 分析器注入成功的消息');
    if (isModDescriptionPage(window.location.href)) {
      initAIAnalyzer();
    }
  }
});

/**
 * 处理检测到的mod URL
 * @param {Object} modInfo 包含mod信息的对象
 */
async function handleModUrlDetected(modInfo) {
  try {
    // 如果是游戏列表页面，处理所有模组
    if (modInfo.isGameListPage) {
      handleGameListPage(modInfo.gameName);
      return;
    }
    
    // 检查缓存中是否已有该模组的直链
    const cachedData = getDirectLinksFromCache(modInfo.gameName, modInfo.modId);
    if (cachedData) {
      // console.log('从缓存中获取到直链');
      displayAllDirectLinks(cachedData.downloadUrls);
      return;
    }
    
    // 发送消息给background.js获取所有下载链接
    chrome.runtime.sendMessage({
      action: "getAllDownloadUrls",
      modId: modInfo.modId,
      gameName: modInfo.gameName
    }, (response) => {
      if (response.success && response.downloadUrls) {
        // 保存到缓存
        const fullUrl = `https://www.nexusmods.com/${modInfo.gameName}/mods/${modInfo.modId}?tab=files`;
        saveDirectLinksToCache(modInfo.gameName, modInfo.modId, response.downloadUrls, fullUrl);
        displayAllDirectLinks(response.downloadUrls);
      } else {
        displayDirectLinkError(response.error || "获取下载链接失败");
      }
    });
  } catch (error) {
    displayDirectLinkError(error.message);
  }
}

/**
 * 处理游戏列表页面
 * @param {string} gameName 游戏名称
 */
function handleGameListPage(gameName) {
  // 添加一个函数来获取或创建进度弹窗
  const getOrCreateProgressContainer = () => {
    // 查找已存在的进度弹窗
    let progressContainer = document.querySelector('.nexus-progress-container');
    
    if (!progressContainer) {
      // 如果不存在，创建新的进度弹窗
      progressContainer = document.createElement('div');
      progressContainer.className = 'nexus-progress-container';
      progressContainer.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.95);
        color: #333;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 9999;
        font-size: 14px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: opacity 0.3s;
      `;
      
      // 添加加载动画和文本容器
      const progressRow = document.createElement('div');
      progressRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      
      const spinner = createLoadingSpinner();
      progressRow.appendChild(spinner);
      
      const textContainer = document.createElement('span');
      textContainer.className = 'nexus-progress-text';
      textContainer.innerHTML = `正在获取链接: ${globalCounters.completedMods}/${globalCounters.totalMods}`;
      progressRow.appendChild(textContainer);
      
      // 添加展开按钮到同一行
      const expandButton = createExpandButton(progressContainer, gameName);
      progressRow.appendChild(expandButton);
      
      progressContainer.appendChild(progressRow);
      document.body.appendChild(progressContainer);
    }
    
    return progressContainer;
  };

  const processMods = (retryCount = 0) => {
    const modsData = extractModIdsFromGameListPage();
    
    if (modsData.length === 0) {
      console.log(`未找到任何模组ID，重试次数: ${retryCount}`);
      if (retryCount < 5) { // 最多重试5次
        setTimeout(() => {
          processMods(retryCount + 1);
        }, 1000);
      } else {
        console.error('多次重试后仍未找到模组ID');
      }
      return;
    }
    
    console.log(`找到 ${modsData.length} 个模组`);
    
    // 确保当前游戏的processedModIds集合存在
    if (!globalCounters.processedModIds.has(gameName)) {
      globalCounters.processedModIds.set(gameName, new Set());
    }
    
    // 过滤出未处理过的模组
    const newMods = modsData.filter(modData => !globalCounters.processedModIds.get(gameName).has(modData.modId));
    console.log(`其中 ${newMods.length} 个是新模组`);
    
    // 更新总模组数量，只计算新模组
    globalCounters.totalMods += newMods.length;
    
    // 将所有模组ID添加到已处理集合中
    modsData.forEach(modData => {
      globalCounters.processedModIds.get(gameName).add(modData.modId);
    });
    
    // 统计缓存中的模组数量
    let cachedModsCount = 0;
    modsData.forEach(modData => {
      const cacheKey = getCacheKey(gameName, modData.modId);
      if (parsedLinksCache.has(cacheKey)) {
        cachedModsCount++;
        // 只有新发现的缓存模组才增加完成计数
        if (newMods.some(newMod => newMod.modId === modData.modId)) {
          globalCounters.completedMods++;
        }
      }
    });
    
    // 为每个模组添加加载状态
    modsData.forEach(modData => {
      // 检查缓存中是否已有该模组的直链
      const cacheKey = getCacheKey(gameName, modData.modId);
      if (parsedLinksCache.has(cacheKey)) {
        // 如果缓存中有，直接显示缓存的直链
        const cachedData = parsedLinksCache.get(cacheKey);
        displayDirectLinksInModTile(modData.element, cachedData.downloadUrls, cachedData.fullUrl);
      } else {
        // 如果缓存中没有，显示加载状态
        displayLoadingInModTile(modData.element);
      }
    });
    
    // 从本地存储获取高级设置
    chrome.storage.local.get([
      STORAGE_KEYS.MAX_CONCURRENT_REQUESTS, 
      STORAGE_KEYS.REQUEST_DELAY
    ], (result) => {
      // 默认值：1个并发请求，2500毫秒间隔
      const MAX_CONCURRENT_REQUESTS = result[STORAGE_KEYS.MAX_CONCURRENT_REQUESTS] !== undefined 
        ? result[STORAGE_KEYS.MAX_CONCURRENT_REQUESTS] 
        : 1;
      const DELAY_BETWEEN_REQUESTS = result[STORAGE_KEYS.REQUEST_DELAY] !== undefined 
        ? result[STORAGE_KEYS.REQUEST_DELAY] 
        : 2500;
      
      console.log('使用请求设置:', { MAX_CONCURRENT_REQUESTS, DELAY_BETWEEN_REQUESTS });
      
      // 创建一个队列处理函数
      const processQueue = async (queue) => {
        // 获取或创建进度弹窗
        const progressContainer = getOrCreateProgressContainer();
        const textContainer = progressContainer.querySelector('.nexus-progress-text');
        const spinner = progressContainer.querySelector('div[style*="border-radius: 50%"]');
        
        // 确保文本容器存在
        if (!textContainer) {
          console.error('未找到进度文本容器');
          return;
        }
        
        // 处理队列
        let activeRequests = 0;
        let index = 0;
        
        return new Promise(resolve => {
          const runNext = () => {
            // 如果解析已暂停，不继续处理
            if (!isParsingEnabled) {
              textContainer.innerHTML = `获取链接已暂停: ${globalCounters.completedMods}/${globalCounters.totalMods}`;
              // 移除加载动画
              if (spinner && spinner.parentNode) {
                spinner.parentNode.removeChild(spinner);
              }
              return;
            }
            
            if (index >= queue.length) {
              if (activeRequests === 0) {
                // 所有请求完成，更新文本
                textContainer.innerHTML = `已完成: ${globalCounters.completedMods}/${globalCounters.totalMods}`;
                // 移除加载动画
                if (spinner && spinner.parentNode) {
                  spinner.parentNode.removeChild(spinner);
                }
                resolve();
              }
              return;
            }
            
            if (activeRequests < MAX_CONCURRENT_REQUESTS) {
              const currentModData = queue[index++];
              const cacheKey = getCacheKey(gameName, currentModData.modId);
              
              // 如果缓存中已有该模组的直链，跳过请求
              if (parsedLinksCache.has(cacheKey)) {
                runNext();
                return;
              }
              
              activeRequests++;
              
              // 构建完整的URL
              const fullUrl = `https://www.nexusmods.com/${gameName}/mods/${currentModData.modId}?tab=files`;
              
              // 发送消息给background.js获取下载链接
              setTimeout(() => {
                // 如果解析已暂停，不发送请求
                if (!isParsingEnabled) {
                  activeRequests--;
                  runNext();
                  return;
                }
                
                chrome.runtime.sendMessage({
                  action: "getAllDownloadUrls",
                  modId: currentModData.modId,
                  gameName: gameName
                }, (response) => {
                  activeRequests--;
                  
                  if (response.success && response.downloadUrls) {
                    // 将解析结果存入缓存
                    saveDirectLinksToCache(gameName, currentModData.modId, response.downloadUrls, fullUrl);
                    displayDirectLinksInModTile(currentModData.element, response.downloadUrls, fullUrl);
                    // 更新完成计数，只有未处理过的模组才增加计数
                    globalCounters.completedMods++;
                    // 更新进度显示
                    textContainer.innerHTML = `正在获取链接: ${globalCounters.completedMods}/${globalCounters.totalMods}`;
                  } else {
                    displayErrorInModTile(currentModData.element, response.error || "获取下载链接失败");
                  }
                  
                  // 继续处理队列
                  runNext();
                });
              }, DELAY_BETWEEN_REQUESTS);
            }
          };
          
          // 开始处理队列，初始启动几个请求
          for (let i = 0; i < Math.min(MAX_CONCURRENT_REQUESTS, queue.length); i++) {
            runNext();
          }
        });
      };
      
      // 开始处理队列
      processQueue(modsData);
    });
  };

  // 开始处理
  processMods();
}

/**
 * 在模组卡片中显示加载状态
 * @param {Element} modTile 模组卡片元素
 */
function displayLoadingInModTile(modTile) {
  if (!modTile) return;
  
  // 检查是否已经存在直链容器
  if (modTile.querySelector(`.${CONTAINER_CLASS}`)) return;
  
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;
  
  const loadingContent = document.createElement('div');
  loadingContent.style.cssText = STYLES.LOADING;
  
  // 只在非暂停状态下添加加载动画
  if (isParsingEnabled) {
    const spinner = createLoadingSpinner();
    loadingContent.appendChild(spinner);
  }
  
  const loadingText = document.createElement('span');
  loadingText.textContent = isParsingEnabled ? 'N网助手正在获取直链....' : '获取直链已暂停';
  loadingContent.appendChild(loadingText);
  
  container.appendChild(loadingContent);
  
  // 插入到模组卡片中
  modTile.appendChild(container);
}

/**
 * 在模组卡片中显示直链
 * @param {Element} modTile 模组卡片元素
 * @param {Array} downloadUrls 下载链接数组
 * @param {string} fullUrl 完整的模组URL
 */
function displayDirectLinksInModTile(modTile, downloadUrls, fullUrl) {
  if (!modTile || !downloadUrls || downloadUrls.length === 0) return;
  
  // 移除现有的容器
  const existingContainer = modTile.querySelector(`.${CONTAINER_CLASS}`);
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 创建新容器
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;
  
  // 创建顶部信息行（查看模组页面 + 文件数量提示）
  const topInfoRow = document.createElement('div');
  topInfoRow.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  `;
  
  // 添加模组页面链接
  const modPageLink = document.createElement('a');
  modPageLink.href = fullUrl;
  modPageLink.target = '_blank';
  modPageLink.style.cssText = `
    color: #1a73e8;
    text-decoration: none;
    font-weight: bold;
  `;
  modPageLink.textContent = '查看模组页面';
  topInfoRow.appendChild(modPageLink);
  
  // 添加文件数量提示 - 无论是否暂停解析，只要有多个文件都显示
  if (downloadUrls.length > 1) {
    const fileCountInfo = document.createElement('div');
    fileCountInfo.style.cssText = `
      font-size: 12px;
      color: #666;
      padding: 2px 6px;
      background-color: #f5f5f5;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    
    const fileCountText = document.createElement('span');
    fileCountText.textContent = `模组有 ${downloadUrls.length} 个文件`;
    fileCountInfo.appendChild(fileCountText);
    
    topInfoRow.appendChild(fileCountInfo);
  }
  
  container.appendChild(topInfoRow);
  
  // 显示第一个直链和复制按钮
  if (downloadUrls.length > 0) {
    const directLinkRow = document.createElement('div');
    directLinkRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    const linkElement = document.createElement('a');
    linkElement.href = downloadUrls[0].url;
    linkElement.target = '_blank';
    linkElement.style.cssText = `
      flex: 1;
      word-break: break-all;
      color: #1a73e8;
      text-decoration: none;
    `;
    linkElement.textContent = '点击下载直链'; // 修改文本为"点击下载直链"
    directLinkRow.appendChild(linkElement);

    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制链接';
    copyButton.style.cssText = `
      padding: 4px 8px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    `;
    copyButton.onclick = () => {
      navigator.clipboard.writeText(downloadUrls[0].url).then(() => {
        // 保存原始图标
        const originalIcon = copyButton.cloneNode(true);
        // 创建成功图标
        const successIcon = createIcon('static/success.png', '已复制!');
        // 替换图标
        copyButton.replaceChild(successIcon, copyButton.childNodes[0]);
        // 2秒后恢复原始图标
        setTimeout(() => {
          copyButton.replaceChild(originalIcon, successIcon);
        }, 2000);
      });
    };
    directLinkRow.appendChild(copyButton);
    
    container.appendChild(directLinkRow);
  }
  
  // 插入到模组卡片中
  modTile.appendChild(container);
}

/**
 * 在模组卡片中显示错误信息
 * @param {Element} modTile 模组卡片元素
 * @param {string} message 错误信息
 */
function displayErrorInModTile(modTile, message) {
  if (!modTile) return;
  
  // 移除现有的容器
  const existingContainer = modTile.querySelector(`.${CONTAINER_CLASS}`);
  if (existingContainer) {
    existingContainer.remove();
  }
  
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;
  
  const errorMessage = document.createElement('div');
  errorMessage.textContent = message;
  errorMessage.style.cssText = STYLES.ERROR;
  container.appendChild(errorMessage);
  
  // 插入到模组卡片中
  modTile.appendChild(container);
}

/**
 * 在页面上显示所有文件的直链
 * @param {Array} downloadUrls 包含所有文件下载链接的数组
 */
function displayAllDirectLinks(downloadUrls) {
  // 移除所有现有的容器
  document.querySelectorAll(`.${CONTAINER_CLASS}`).forEach(container => container.remove());

  // 为每个文件创建单独的容器
  downloadUrls.forEach((item) => {
    // 查找对应的预览按钮元素
    const previewButton = document.querySelector(`[data-id="${item.fileId}"] .btn-ajax-content-preview`);
    if (!previewButton) return;

    // 创建容器
    const container = document.createElement('div');
    container.className = CONTAINER_CLASS;
    container.style.cssText = STYLES.CONTAINER;

    const content = document.createElement('div');
    content.style.cssText = STYLES.SUCCESS;

    const linkElement = document.createElement('a');
    linkElement.href = item.url;
    linkElement.target = '_blank';
    linkElement.style.cssText = `
      flex: 1;
      word-break: break-all;
      color: #1a73e8;
      text-decoration: none;
    `;
    linkElement.textContent = item.url;
    content.appendChild(linkElement);

    const copyButton = document.createElement('button');
    copyButton.textContent = '复制链接';
    copyButton.style.cssText = `
      padding: 4px 8px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    `;
    copyButton.onclick = () => {
      navigator.clipboard.writeText(item.url).then(() => {
        // 保存原始图标
        const originalIcon = copyButton.cloneNode(true);
        // 创建成功图标
        const successIcon = createIcon('static/success.png', '已复制!');
        // 替换图标
        copyButton.replaceChild(successIcon, copyButton.childNodes[0]);
        // 2秒后恢复原始图标
        setTimeout(() => {
          copyButton.replaceChild(originalIcon, successIcon);
        }, 2000);
      });
    };
    content.appendChild(copyButton);

    container.appendChild(content);

    // 插入到预览按钮后面
    previewButton.parentNode.insertBefore(container, previewButton.nextSibling);
  });
}

/**
 * 显示加载状态
 * @param {string} fileId 文件ID
 */
function displayLoading(fileId) {
  const previewButton = document.querySelector(`[data-id="${fileId}"] .btn-ajax-content-preview`);
  if (!previewButton) return;

  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;

  const loadingContent = document.createElement('div');
  loadingContent.style.cssText = STYLES.LOADING;
  
  // 只在非暂停状态下添加加载动画
  if (isParsingEnabled) {
    const spinner = createLoadingSpinner();
    loadingContent.appendChild(spinner);
  }
  
  const loadingText = document.createElement('span');
  loadingText.textContent = isParsingEnabled ? 'N网助手正在获取直链....' : '获取直链已暂停';
  loadingContent.appendChild(loadingText);
  
  container.appendChild(loadingContent);

  // 插入到预览按钮后面
  previewButton.parentNode.insertBefore(container, previewButton.nextSibling);
}

/**
 * 在页面上显示错误信息
 * @param {string} message 错误信息
 * @param {string} fileId 文件ID
 */
function displayDirectLinkError(message, fileId) {
  const fileElement = document.querySelector(`[data-id="${fileId}"]`);
  if (!fileElement) return;

  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;

  const errorMessage = document.createElement('div');
  errorMessage.textContent = message;
  errorMessage.style.cssText = STYLES.ERROR;
  container.appendChild(errorMessage);

  // 插入到文件元素后面
  fileElement.parentNode.insertBefore(container, fileElement.nextSibling);
}

// 添加GraphQL请求监听
let isProcessing = false;

// 监听GraphQL请求
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  
  // 检查是否是目标GraphQL请求
  if (args[0] === 'https://api-router.nexusmods.com/graphql') {
    console.log('检测到GraphQL请求');
    // 检查当前是否是游戏列表页面
    const modInfo = parseNexusUrl(window.location.href);
    if (modInfo && modInfo.isValid && modInfo.isGameListPage) {
      console.log('确认是游戏列表页面');
      // 克隆响应以便我们可以读取它
      const clone = response.clone();
      try {
        const data = await clone.json();
        console.log('GraphQL响应数据:', data);
        // 如果请求成功且有数据返回
        if (data && !isProcessing) {
          console.log('开始处理游戏列表页面');
          // 设置标志位，防止重复处理
          isProcessing = true;
          
          // 等待页面元素加载完成
          const waitForElements = () => {
            return new Promise((resolve) => {
              const checkElements = () => {
                const modsGrid = document.querySelector('.mods-grid');
                if (modsGrid) {
                  console.log('找到模组网格元素');
                  resolve();
                } else {
                  console.log('等待模组网格元素加载...');
                  setTimeout(checkElements, 500);
                }
              };
              checkElements();
            });
          };

          // 等待元素加载完成后再处理
          waitForElements().then(() => {
            // 先获取用户的URL监听设置
            chrome.storage.local.get([
              STORAGE_KEYS.STANDARD_URL_ENABLED, 
              STORAGE_KEYS.GAME_LIST_URL_ENABLED
            ], (result) => {
              const gameListUrlEnabled = result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] !== undefined ? result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] : false;
              
              // 只在游戏列表监听开启时处理
              if (gameListUrlEnabled) {
                console.log('游戏列表监听已开启，开始处理');
                // 处理游戏列表页面
                handleGameListPage(modInfo.gameName);
              } else {
                console.log('游戏列表监听未开启');
              }
              // 处理完成后重置标志位
              setTimeout(() => {
                isProcessing = false;
                console.log('处理完成，重置处理状态');
              }, 1000); // 添加延迟，避免过快重置导致重复处理
            });
          });
        } else {
          console.log('GraphQL响应无效或正在处理中');
        }
      } catch (error) {
        console.error('处理GraphQL响应时出错:', error);
        // 出错时也要重置处理状态
        isProcessing = false;
      }
    } else {
      console.log('不是游戏列表页面或URL无效');
    }
  }
  
  return response;
};

// 添加防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 修改DOM变化监听
const domChangeObserver = new MutationObserver(
    debounce((mutations) => {
        // 只在files标签页时处理
        if (!window.location.href.includes('tab=files')) {
            return;
        }

        // 检查是否有新的文件元素被添加
        const hasNewFileElements = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                // 检查是否是元素节点
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return false;
                }
                // 检查是否包含data-id属性
                return node.hasAttribute('data-id') || 
                       node.querySelector('[data-id]') !== null;
            });
        });

        if (hasNewFileElements) {
            console.log('检测到新的文件元素，重新初始化直链显示');
            handleControlPanelTable();
        }
    }, 500) // 500ms的防抖时间
);

// 开始观察整个文档的变化，但只在files标签页时观察
function startObserving() {
    if (window.location.href.includes('tab=files')) {
        console.log('开始观察DOM变化');
        domChangeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        console.log('停止观察DOM变化');
        domChangeObserver.disconnect();
    }
}

// 修改URL变化监听逻辑
let lastUrl = window.location.href;
const urlChangeObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        console.log('URL发生变化:', currentUrl);
        lastUrl = currentUrl;
        
        // 更新DOM观察状态
        startObserving();
        
        // 解析当前URL
        const modInfo = parseNexusUrl(currentUrl);
        if (modInfo && modInfo.isValid) {
            // 获取用户的URL监听设置
            chrome.storage.local.get([
                STORAGE_KEYS.STANDARD_URL_ENABLED, 
                STORAGE_KEYS.GAME_LIST_URL_ENABLED
            ], (result) => {
                const standardUrlEnabled = result[STORAGE_KEYS.STANDARD_URL_ENABLED] !== undefined ? result[STORAGE_KEYS.STANDARD_URL_ENABLED] : true;
                const gameListUrlEnabled = result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] !== undefined ? result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] : false;
                
                // 根据URL类型和用户设置决定是否处理
                if (modInfo.isGameListPage && gameListUrlEnabled) {
                    console.log('检测到游戏列表页面，开始处理');
                    handleGameListPage(modInfo.gameName);
                } else if (!modInfo.isGameListPage && standardUrlEnabled) {
                    console.log('检测到标准模组页面，开始处理');
                    
                    // 检查是否是files标签页
                    const isFilesTab = currentUrl.includes('tab=files');
                    
                    // 如果是files标签页，使用handleControlPanelTable
                    if (isFilesTab) {
                        console.log('检测到files标签页，使用handleControlPanelTable处理');
                        handleControlPanelTable();
                    } else {
                        // 其他标签页使用handleModUrlDetected
                        handleModUrlDetected(modInfo);
                    }
                    
                    // 如果是描述页面，初始化AI分析器
                    if (isModDescriptionPage(currentUrl)) {
                        console.log('检测到模组描述页面，初始化AI分析器');
                        initAIAnalyzer();
                    }
                }
            });
        }
    }
});

// 开始观察
urlChangeObserver.observe(document, { subtree: true, childList: true });

// 初始化时检查是否需要开始观察
startObserving();

// 修改页面加载完成后的初始化逻辑
window.addEventListener('load', () => {
  restoreParsedLinksCache();
  // 每小时检查一次过期缓存
  setInterval(cleanupExpiredCache, 60 * 60 * 1000);
  
  // 解析当前URL
  const modInfo = parseNexusUrl(window.location.href);
  if (modInfo && modInfo.isValid) {
    chrome.storage.local.get([
      STORAGE_KEYS.STANDARD_URL_ENABLED, 
      STORAGE_KEYS.GAME_LIST_URL_ENABLED
    ], (result) => {
      const standardUrlEnabled = result[STORAGE_KEYS.STANDARD_URL_ENABLED] !== undefined ? result[STORAGE_KEYS.STANDARD_URL_ENABLED] : true;
      const gameListUrlEnabled = result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] !== undefined ? result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] : false;
      
      // 根据URL类型和用户设置决定是否处理
      if (modInfo.isGameListPage && gameListUrlEnabled) {
        console.log('页面加载完成：检测到游戏列表页面，开始处理');
        handleGameListPage(modInfo.gameName);
      } else if (!modInfo.isGameListPage && standardUrlEnabled) {
        console.log('页面加载完成：检测到标准模组页面，开始处理');
        
        // 检查是否是files标签页
        const isFilesTab = window.location.href.includes('tab=files');
        
        // 如果是files标签页，使用handleControlPanelTable
        if (isFilesTab) {
          console.log('页面加载完成：检测到files标签页，使用handleControlPanelTable处理');
          handleControlPanelTable();
        } else {
          // 其他标签页使用handleModUrlDetected
          handleModUrlDetected(modInfo);
        }
        
        // 如果是描述页面，初始化AI分析器
        if (isModDescriptionPage(window.location.href)) {
          console.log('页面加载完成：检测到模组描述页面，初始化AI分析器');
          initAIAnalyzer();
        }
      }
    });
  }
});

// 修改清除缓存的函数，重置计数器
function clearParsedLinksCache() {
  parsedLinksCache.clear();
  chrome.storage.local.remove(CACHE_STORAGE_KEY);
  console.log('直链缓存已清除');
  
  // 重置计数器和已处理模组ID集合
  globalCounters.totalMods = 0;
  globalCounters.completedMods = 0;
  globalCounters.processedModIds.clear(); // 清空整个Map
  
  // 如果当前是游戏列表页面，重新处理所有模组
  const modInfo = parseNexusUrl(window.location.href);
  if (modInfo && modInfo.isValid && modInfo.isGameListPage) {
    handleGameListPage(modInfo.gameName);
  }
}

// 修改handleControlPanelTable函数
function handleControlPanelTable() {
    console.log('开始处理直链显示...');
    
    // 获取当前页面的mod信息
    const modInfo = parseNexusUrl(window.location.href);
    if (!modInfo || !modInfo.isValid || modInfo.isGameListPage) {
        console.log('无效的mod信息或游戏列表页面，跳过处理');
        return;
    }

    // 等待页面元素加载完成
    const waitForElements = () => {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10; // 最多尝试10次
            
            const checkElements = () => {
                const fileElements = document.querySelectorAll('[data-id]');
                if (fileElements.length > 0) {
                    console.log('找到文件元素，开始处理直链');
                    resolve(fileElements);
                } else if (attempts < maxAttempts) {
                    console.log(`等待文件元素加载... (尝试 ${attempts + 1}/${maxAttempts})`);
                    attempts++;
                    setTimeout(checkElements, 500);
                } else {
                    console.log('达到最大尝试次数，放弃等待');
                    resolve(null);
                }
            };
            checkElements();
        });
    };

    // 使用异步函数处理
    const processDirectLinks = async () => {
        try {
            // 等待元素加载
            const fileElements = await waitForElements();
            if (!fileElements) {
                console.log('未找到文件元素，无法处理直链');
                return;
            }

            // 检查缓存中是否已有该模组的直链
            const cachedData = getDirectLinksFromCache(modInfo.gameName, modInfo.modId);
            if (cachedData) {
                console.log('从缓存中获取到直链');
                displayAllDirectLinks(cachedData.downloadUrls);
                return;
            }

            // 如果没有缓存，显示加载状态
            fileElements.forEach(element => {
                if (!element.querySelector(`.${CONTAINER_CLASS}`)) {
                    displayLoading(element.dataset.id);
                }
            });

            // 发送消息给background.js获取所有下载链接
            chrome.runtime.sendMessage({
                action: "getAllDownloadUrls",
                modId: modInfo.modId,
                gameName: modInfo.gameName
            }, (response) => {
                if (response.success && response.downloadUrls) {
                    // 保存到缓存
                    const fullUrl = `https://www.nexusmods.com/${modInfo.gameName}/mods/${modInfo.modId}?tab=files`;
                    saveDirectLinksToCache(modInfo.gameName, modInfo.modId, response.downloadUrls, fullUrl);
                    displayAllDirectLinks(response.downloadUrls);
                } else {
                    displayDirectLinkError(response.error || "获取下载链接失败");
                }
            });
        } catch (error) {
            console.error('处理直链时出错:', error);
            displayDirectLinkError(error.message);
        }
    };

    // 开始处理
    processDirectLinks();
}

// 添加定期清理过期缓存的函数
function cleanupExpiredCache() {
  const now = Date.now();
  let hasExpired = false;
  
  parsedLinksCache.forEach((value, key) => {
    if (value.timestamp && (now - value.timestamp >= CACHE_EXPIRATION_TIME)) {
      parsedLinksCache.delete(key);
      hasExpired = true;
    }
  });
  
  if (hasExpired) {
    saveParsedLinksCache();
    console.log('已清理过期缓存');
  }
}

/**
 * 从下载链接中提取文件名
 * @param {string} url 下载链接URL字符串
 * @returns {string} 文件名（如果成功解析）或"直链下载"（如果解析失败）
 */
function getFilenameFromUrl(url) {
  try {
    // 首先分割URL，获取问号前的部分
    const baseUrl = url.split('?')[0];

    // 从路径中获取最后一个斜杠后的部分
    const filename = baseUrl.split('/').pop();

    // URL解码（处理%20等编码字符）
    const decodedFilename = decodeURIComponent(filename);

    // 验证文件扩展名
    const validExtensions = ['.rar', '.zip', '.7z', '.exe', '.7zip'];
    if (validExtensions.some(ext => decodedFilename.toLowerCase().endsWith(ext))) {
      return decodedFilename;
    }

    return "直链下载";
  } catch (e) {
    console.error("解析文件名时出错:", e);
    return "直链下载";
  }
}

/**
 * 创建图标元素
 * @param {string} src 图标路径
 * @param {string} title 提示文本
 * @returns {HTMLImageElement} 图标元素
 */
function createIcon(src, title) {
  const icon = document.createElement('img');
  icon.style.cssText = STYLES.ICON;
  icon.title = title;
  
  // 添加错误处理
  icon.onerror = () => {
    // 创建一个默认的占位图标
    icon.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjY2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxsaW5lIHgxPSIxMiIgeTE9IjgiIHgyPSIxMiIgeTI9IjE2Ii8+PGxpbmUgeDE9IjgiIHkxPSIxMiIgeDI9IjE2IiB5Mj0iMTIiLz48L3N2Zz4=';
  };
  
  // 设置图标源
  icon.src = chrome.runtime.getURL(src);
  
  return icon;
}

/**
 * 创建缓存文件表格
 * @param {string} gameName 游戏名称
 * @returns {HTMLElement} 表格容器元素
 */
function createCacheTable(gameName) {
  // 创建外层容器
  const outerContainer = document.createElement('div');
  outerContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  // 创建表格容器
  const container = document.createElement('div');
  container.style.cssText = STYLES.TABLE_CONTAINER;

  // 滚动包裹层
  const scrollDiv = document.createElement('div');
  scrollDiv.style.cssText = STYLES.TABLE_SCROLL;

  // 创建表格头部
  const table = document.createElement('table');
  table.style.cssText = STYLES.TABLE;

  // 创建表头
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['序号', 'Mod ID', '文件名称/数量', '直链链接', '操作', '展开'];
  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.style.cssText = STYLES.TABLE_HEADER;
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 创建表格主体
  const tbody = document.createElement('tbody');

  // 1. 拍平所有文件并分组
  const grouped = {};
  Array.from(parsedLinksCache.entries())
    .filter(([key]) => key.startsWith(`${gameName}_`))
    .forEach(([key, value]) => {
      const modId = key.split('_')[1];
      (value.downloadUrls || []).forEach(downloadUrl => {
        if (!grouped[modId]) grouped[modId] = [];
        grouped[modId].push(downloadUrl);
      });
    });

  // 2. 渲染
  let rowIndex = 1;
  Object.entries(grouped).forEach(([modId, files]) => {
    if (files.length === 1) {
      // 只有一个文件，直接平铺展示
      const row = document.createElement('tr');
      // 序号
      const indexCell = document.createElement('td');
      indexCell.style.cssText = STYLES.TABLE_CELL;
      indexCell.textContent = rowIndex++;
      row.appendChild(indexCell);
      // Mod ID
      const modIdCell = document.createElement('td');
      modIdCell.style.cssText = STYLES.TABLE_CELL;
      modIdCell.textContent = modId;
      row.appendChild(modIdCell);
      // 文件名称/数量
      const filenameCell = document.createElement('td');
      filenameCell.style.cssText = STYLES.TABLE_CELL;
      const filename = getFilenameFromUrl(files[0].url);
      filenameCell.textContent = filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
      filenameCell.title = filename;
      row.appendChild(filenameCell);
      // 直链链接
      const linkCell = document.createElement('td');
      linkCell.style.cssText = STYLES.TABLE_CELL;
      const link = document.createElement('a');
      link.href = files[0].url;
      link.target = '_blank';
      const shortUrl = files[0].url.length > 50 
        ? files[0].url.substring(0, 47) + '...'
        : files[0].url;
      link.textContent = shortUrl;
      link.title = files[0].url;
      link.style.cssText = 'color: #1a73e8; text-decoration: none; word-break: break-all;';
      linkCell.appendChild(link);
      row.appendChild(linkCell);
      // 操作
      const actionCell = document.createElement('td');
      actionCell.style.cssText = STYLES.TABLE_CELL;
      // 复制按钮
      const copyButton = document.createElement('button');
      copyButton.style.cssText = STYLES.ACTION_BUTTON;
      const copyIcon = createIcon('static/copy.png', '复制链接');
      copyButton.appendChild(copyIcon);
      copyButton.onclick = () => {
        navigator.clipboard.writeText(files[0].url).then(() => {
          // 保存原始图标
          const originalIcon = copyIcon.cloneNode(true);
          // 创建成功图标
          const successIcon = createIcon('static/success.png', '已复制!');
          // 替换图标
          copyButton.replaceChild(successIcon, copyIcon);
          // 2秒后恢复原始图标
          setTimeout(() => {
            copyButton.replaceChild(originalIcon, successIcon);
          }, 2000);
        });
      };
      actionCell.appendChild(copyButton);
      // 下载按钮
      const downloadButton = document.createElement('button');
      downloadButton.style.cssText = STYLES.ACTION_BUTTON;
      const downloadIcon = createIcon('static/download.png', '下载');
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        window.open(files[0].url, '_blank');
      };
      actionCell.appendChild(downloadButton);
      row.appendChild(actionCell);
      // 展开列（空）
      const expandCell = document.createElement('td');
      expandCell.style.cssText = STYLES.TABLE_CELL;
      row.appendChild(expandCell);
      tbody.appendChild(row);
    } else {
      // 多文件，分组折叠
      const mainRow = document.createElement('tr');
      // 序号
      const indexCell = document.createElement('td');
      indexCell.style.cssText = STYLES.TABLE_CELL;
      indexCell.textContent = rowIndex++;
      mainRow.appendChild(indexCell);
      // Mod ID
      const modIdCell = document.createElement('td');
      modIdCell.style.cssText = STYLES.TABLE_CELL;
      modIdCell.textContent = modId;
      mainRow.appendChild(modIdCell);
      // 文件数量
      const countCell = document.createElement('td');
      countCell.style.cssText = STYLES.TABLE_CELL;
      countCell.textContent = files.length;
      mainRow.appendChild(countCell);
      // 直链链接（空）
      const linkCell = document.createElement('td');
      linkCell.style.cssText = STYLES.TABLE_CELL;
      mainRow.appendChild(linkCell);
      // 操作（全部复制）
      const actionCell = document.createElement('td');
      actionCell.style.cssText = STYLES.TABLE_CELL;
      const copyAllButton = document.createElement('button');
      copyAllButton.style.cssText = STYLES.ACTION_BUTTON;
      const copyAllIcon = createIcon('static/copy-all.png', '复制该Mod所有链接');
      copyAllButton.appendChild(copyAllIcon);
      copyAllButton.onclick = () => {
        const urls = files.map(f => f.url).join('\n');
        navigator.clipboard.writeText(urls).then(() => {
          // 保存原始图标
          const originalIcon = copyAllIcon.cloneNode(true);
          // 创建成功图标
          const successIcon = createIcon('static/success.png', '已复制全部!');
          // 替换图标
          copyAllButton.replaceChild(successIcon, copyAllIcon);
          // 2秒后恢复原始图标
          setTimeout(() => {
            copyAllButton.replaceChild(originalIcon, successIcon);
          }, 2000);
        });
      };
      actionCell.appendChild(copyAllButton);
      mainRow.appendChild(actionCell);
      // 展开/折叠按钮
      const expandCell = document.createElement('td');
      expandCell.style.cssText = STYLES.TABLE_CELL + 'text-align:center;';
      const expandBtn = document.createElement('button');
      expandBtn.style.cssText = STYLES.ACTION_BUTTON;
      let expanded = false;
      const unfoldIcon = createIcon('images/unfold.png', '展开');
      const collapseIcon = createIcon('images/Collapse.png', '收起');
      expandBtn.appendChild(unfoldIcon);
      expandCell.appendChild(expandBtn);
      mainRow.appendChild(expandCell);
      tbody.appendChild(mainRow);
      // 子表格（初始隐藏）
      let subTableRow = null;
      expandBtn.onclick = () => {
        if (!expanded) {
          // 展开
          subTableRow = document.createElement('tr');
          const subCell = document.createElement('td');
          subCell.colSpan = 6;
          subCell.style.cssText = 'padding:0;background:#fafbfc;';
          // 子表格内容
          const subTable = document.createElement('table');
          subTable.style.cssText = 'width:100%;background:#fafbfc;';
          // 子表头
          const subThead = document.createElement('thead');
          const subHeaderRow = document.createElement('tr');
          ['文件名称', '直链链接', '操作'].forEach(h => {
            const th = document.createElement('th');
            th.style.cssText = STYLES.TABLE_HEADER;
            th.textContent = h;
            subHeaderRow.appendChild(th);
          });
          subThead.appendChild(subHeaderRow);
          subTable.appendChild(subThead);
          // 子表体
          const subTbody = document.createElement('tbody');
          files.forEach(downloadUrl => {
            const row = document.createElement('tr');
            // 文件名称
            const filenameCell = document.createElement('td');
            filenameCell.style.cssText = STYLES.TABLE_CELL;
            const filename = getFilenameFromUrl(downloadUrl.url);
            filenameCell.textContent = filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
            filenameCell.title = filename;
            row.appendChild(filenameCell);
            // 直链链接
            const linkCell = document.createElement('td');
            linkCell.style.cssText = STYLES.TABLE_CELL;
            const link = document.createElement('a');
            link.href = downloadUrl.url;
            link.target = '_blank';
            const shortUrl = downloadUrl.url.length > 50 
              ? downloadUrl.url.substring(0, 47) + '...'
              : downloadUrl.url;
            link.textContent = shortUrl;
            link.title = downloadUrl.url;
            link.style.cssText = 'color: #1a73e8; text-decoration: none; word-break: break-all;';
            linkCell.appendChild(link);
            row.appendChild(linkCell);
            // 操作
            const actionCell = document.createElement('td');
            actionCell.style.cssText = STYLES.TABLE_CELL;
            // 复制按钮
            const copyButton = document.createElement('button');
            copyButton.style.cssText = STYLES.ACTION_BUTTON;
            const copyIcon = createIcon('static/copy.png', '复制链接');
            copyButton.appendChild(copyIcon);
            copyButton.onclick = () => {
              navigator.clipboard.writeText(downloadUrl.url).then(() => {
                // 保存原始图标
                const originalIcon = copyIcon.cloneNode(true);
                // 创建成功图标
                const successIcon = createIcon('static/success.png', '已复制!');
                // 替换图标
                copyButton.replaceChild(successIcon, copyIcon);
                // 2秒后恢复原始图标
                setTimeout(() => {
                  copyButton.replaceChild(originalIcon, successIcon);
                }, 2000);
              });
            };
            actionCell.appendChild(copyButton);
            // 下载按钮
            const downloadButton = document.createElement('button');
            downloadButton.style.cssText = STYLES.ACTION_BUTTON;
            const downloadIcon = createIcon('static/download.png', '下载');
            downloadButton.appendChild(downloadIcon);
            downloadButton.onclick = () => {
              window.open(downloadUrl.url, '_blank');
            };
            actionCell.appendChild(downloadButton);
            row.appendChild(actionCell);
            subTbody.appendChild(row);
          });
          subTable.appendChild(subTbody);
          subCell.appendChild(subTable);
          subTableRow.appendChild(subCell);
          // 插入到主行后面
          mainRow.parentNode.insertBefore(subTableRow, mainRow.nextSibling);
          // 切换图标
          expandBtn.removeChild(unfoldIcon);
          expandBtn.appendChild(collapseIcon);
          expanded = true;
        } else {
          // 收起
          if (subTableRow) subTableRow.remove();
          expandBtn.removeChild(collapseIcon);
          expandBtn.appendChild(unfoldIcon);
          expanded = false;
        }
      };
    }
  });

  table.appendChild(tbody);
  scrollDiv.appendChild(table);
  container.appendChild(scrollDiv);

  // 将表格容器添加到外层容器
  outerContainer.appendChild(container);

  return outerContainer;
}

/**
 * 创建展开/收起按钮
 * @param {HTMLElement} container 容器元素
 * @param {string} gameName 游戏名称
 * @returns {HTMLElement} 按钮元素
 */
function createExpandButton(container, gameName) {
  const button = document.createElement('button');
  button.style.cssText = STYLES.EXPAND_BUTTON;
  
  const icon = createIcon('images/unfold.png', '展开缓存文件列表');
  button.appendChild(icon);
  
  let isExpanded = false;
  let tableContainer = null;
  
  button.onclick = () => {
    if (!isExpanded) {
      // 创建表格
      tableContainer = createCacheTable(gameName);
      // 只插入表格，不再插入顶部全部复制按钮
      container.appendChild(tableContainer);
      // 更新按钮状态
      icon.src = chrome.runtime.getURL('images/Collapse.png');
    } else {
      // 移除表格
      if (tableContainer) {
        tableContainer.remove();
      }
      // 不再查找和移除顶部全部复制按钮
      // 更新按钮状态
      icon.src = chrome.runtime.getURL('images/unfold.png');
    }
    isExpanded = !isExpanded;
  };
  
  return button;
}

// 添加AI分析模组相关的常量
const AI_ANALYZER = {
    BUTTON_ID: 'ai-analyze-button',
    BUTTON_TEXT: 'AI分析模组',
    BUTTON_STYLE: `
        padding: 8px 16px;
        margin-left: 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    `
};

// 初始化AI模组分析器
let aiModAnalyzer = null;

// 检查是否是模组描述页面
function isModDescriptionPage(url) {
    return url.includes('nexusmods.com') && url.includes('/mods/');
}

// 初始化AI分析功能
function initAIAnalyzer() {
    if (!aiModAnalyzer) {
        console.log('开始初始化AI分析器...');
        
        // 使用 chrome.scripting.executeScript 注入脚本
        chrome.runtime.sendMessage({ action: 'injectAIAnalyzer' }, (response) => {
            if (response && response.success) {
                console.log('AI分析器脚本注入成功');
                // 等待一小段时间确保脚本加载完成
                setTimeout(() => {
                    if (window.AIModAnalyzer) {
                        // console.log('创建AI分析器实例');
                        aiModAnalyzer = new AIModAnalyzer();
                        aiModAnalyzer.init();
                    } else {
                        console.error('AIModAnalyzer 类未找到');
                    }
                }, 100);
            } else {
                console.error('AI分析器脚本注入失败:', response?.error);
            }
        });
    }
}

// 监听URL变化
function observeUrlChanges() {
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            console.log('URL发生变化:', currentUrl);
            lastUrl = currentUrl;
            if (isModDescriptionPage(currentUrl)) {
                console.log('检测到模组描述页面，初始化AI分析器');
                initAIAnalyzer();
            }
        }
    }).observe(document, { subtree: true, childList: true });
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，检查是否需要初始化AI分析器');
    if (isModDescriptionPage(location.href)) {
        console.log('当前是模组描述页面，初始化AI分析器');
        initAIAnalyzer();
    }
    observeUrlChanges();
});

// 立即检查当前页面
if (isModDescriptionPage(location.href)) {
    console.log('当前是模组描述页面，立即初始化AI分析器');
    initAIAnalyzer();
}