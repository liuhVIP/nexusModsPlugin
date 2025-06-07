/*
 * Copyright 2024 改洺_ (B站UP主改洺_)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// 常量定义
const CONTAINER_CLASS = 'nexus-direct-link-container';
// URL监听设置的本地存储键名
const STORAGE_KEYS = {
  STANDARD_URL_ENABLED: 'standardUrlEnabled',
  GAME_LIST_URL_ENABLED: 'gameListUrlEnabled',
  REQUEST_DELAY: 'requestDelay'
};

// 加载时间跟踪对象
const loadingTimeTracker = new Map(); // key: modId, value: { startTime, gameName }

// 添加CSS动画到页面
function addShimmerAnimation() {
  if (document.getElementById('nexus-shimmer-style')) return;

  const style = document.createElement('style');
  style.id = 'nexus-shimmer-style';
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// 页面加载时添加动画
addShimmerAnimation();

// 时间跟踪辅助函数
function startLoadingTimer(modId, gameName) {
  loadingTimeTracker.set(modId, {
    startTime: Date.now(),
    gameName: gameName
  });
  console.log(`开始计时模组 ${modId}`);
}

function getLoadingTime(modId) {
  const tracker = loadingTimeTracker.get(modId);
  if (!tracker) {
    return null;
  }
  const endTime = Date.now();
  const loadingTime = endTime - tracker.startTime;
  loadingTimeTracker.delete(modId); // 清理已完成的计时
  console.log(`模组 ${modId} 加载完成，耗时: ${loadingTime}ms`);
  return loadingTime;
}

// 获取当前加载时间但不删除计时器（用于预览）
function peekLoadingTime(modId) {
  const tracker = loadingTimeTracker.get(modId);
  if (!tracker) {
    return null;
  }
  const endTime = Date.now();
  const loadingTime = endTime - tracker.startTime;
  return loadingTime;
}

// 清理超时的加载时间跟踪器（防止内存泄漏）
function cleanupStaleTimers() {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5分钟超时

  loadingTimeTracker.forEach((tracker, modId) => {
    if (now - tracker.startTime > maxAge) {
      console.warn(`清理超时的计时器: 模组 ${modId}, 已运行 ${now - tracker.startTime}ms`);
      loadingTimeTracker.delete(modId);
    }
  });
}

// 调试函数：显示当前所有活跃的计时器
function debugActiveTimers() {
  console.log('当前活跃的加载时间跟踪器:');
  loadingTimeTracker.forEach((tracker, modId) => {
    const elapsed = Date.now() - tracker.startTime;
    console.log(`- 模组 ${modId}: ${elapsed}ms (游戏: ${tracker.gameName})`);
  });
}

function formatLoadingTime(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// 更新现有加载状态的函数
function updateExistingLoadingStates() {
  console.log('更新现有加载状态，当前解析状态:', isParsingEnabled ? '启用' : '暂停');

  document.querySelectorAll(`.${CONTAINER_CLASS}`).forEach(container => {
    const textContent = container.textContent;
    const isLoadingOrPausedState = textContent.includes('获取直链') ||
      textContent.includes('正在获取') ||
      textContent.includes('N网助手') ||
      textContent.includes('暂停');

    if (isLoadingOrPausedState) {
      // 完全重新创建容器内容并应用对应样式
      container.innerHTML = '';
      container.style.cssText = isParsingEnabled ? STYLES.CONTAINER_LOADING : STYLES.CONTAINER_PAUSED;

      // 添加图标
      if (isParsingEnabled) {
        const spinner = createLoadingSpinner();
        container.appendChild(spinner);
      } else {
        const pauseIcon = document.createElement('span');
        pauseIcon.textContent = '⏸️';
        pauseIcon.style.cssText = 'font-size: 14px;';
        container.appendChild(pauseIcon);
      }

      // 添加文本
      const loadingText = document.createElement('span');
      loadingText.textContent = isParsingEnabled ? '正在获取直链...' : '获取直链已暂停';
      container.appendChild(loadingText);
    }
  });
}

// 添加表格相关样式
const STYLES = {
  CONTAINER: `
    margin: 6px 0;
    padding: 10px;
    background: #ffffff;
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
    position: relative;
  `,
  CONTAINER_LOADING: `
    margin: 6px 0;
    padding: 10px;
    border-radius: 6px;
    font-size: 13px;
    transition: all 0.2s ease;
    position: relative;
    color: #6b7280;
    background: linear-gradient(90deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  CONTAINER_PAUSED: `
    margin: 6px 0;
    padding: 10px;
    border-radius: 6px;
    font-size: 13px;
    transition: all 0.2s ease;
    position: relative;
    color: #f59e0b;
    background: #fffbeb;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  CONTAINER_ERROR: `
    margin: 6px 0;
    padding: 10px;
    border-radius: 6px;
    font-size: 13px;
    transition: all 0.2s ease;
    position: relative;
    color: #dc2626;
    background: #fef2f2;
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  SUCCESS: `
    margin: 6px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-radius: 8px;
    border: 1px solid rgba(14, 165, 233, 0.1);
    transition: all 0.2s ease;
  `,
  // 加载时间显示样式 - 更简洁
  LOADING_TIME: `
    background: #e0f2fe;
    color: #0369a1;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 500;
    white-space: nowrap;
  `,
  // 标准模组页面加载状态样式 - 现代化渐变效果
  LOADING: `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    color: #6b7280;
    background: linear-gradient(90deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.3s ease;
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

// 添加全局计数器 - 重构为更可靠的状态管理
const globalCounters = {
  totalMods: 0,
  completedMods: 0,
  // 修改已处理模组ID的跟踪集合，使用gameName和modId的组合作为键
  processedModIds: new Map(), // 改用Map来存储，key为gameName，value为Set<modId>
  // 添加已完成模组ID的跟踪集合
  completedModIds: new Map(), // 改用Map来存储，key为gameName，value为Set<modId>
  // 添加当前游戏名称跟踪
  currentGameName: null,
  // 添加页面状态跟踪
  isPageInitialized: false
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
function saveDirectLinksToCache(gameName, modId, downloadUrls, fullUrl, loadingTime = null) {
  console.log("saveDirectLinksToCache", "我进来了");
  console.log("downloadUrls", downloadUrls);
  const cacheKey = getCacheKey(gameName, modId);
  parsedLinksCache.set(cacheKey, {
    downloadUrls,
    fullUrl,
    loadingTime, // 新增：缓存加载时间
    timestamp: Date.now() // 添加时间戳
  });
  saveParsedLinksCache();
  console.log(`缓存已保存: ${cacheKey}${loadingTime ? `, 加载时间: ${loadingTime}ms` : ''}`);
}

// 重置并同步进度计数器 - 修复分页问题版本（移除totalMods处理）
function resetAndSyncCounters(gameName) {
  // console.log(`重置并同步计数器，游戏: ${gameName}`);

  // 如果游戏名称发生变化，重置相关计数器
  if (globalCounters.currentGameName !== gameName) {
    console.log(`游戏名称变化: ${globalCounters.currentGameName} -> ${gameName}`);
    globalCounters.completedMods = 0;
    globalCounters.currentGameName = gameName;
    globalCounters.isPageInitialized = false;
  } else {
    // 同一游戏内的分页切换，重置页面相关状态但保留已完成的模组记录
    // console.log(`同一游戏内的分页切换，重置页面状态`);
    globalCounters.isPageInitialized = false;
    // 不重置 completedMods，让它们根据缓存重新计算
  }

  // 确保当前游戏的集合存在
  if (!globalCounters.processedModIds.has(gameName)) {
    globalCounters.processedModIds.set(gameName, new Set());
  }
  if (!globalCounters.completedModIds.has(gameName)) {
    globalCounters.completedModIds.set(gameName, new Set());
  }
}

// 同步缓存状态到计数器 - 修复版本：同步所有缓存的模组，不仅仅是当前页面
function syncCacheToCounters(gameName, modsData) {
  // console.log(`同步缓存状态到计数器，游戏: ${gameName}, 当前页面模组数量: ${modsData.length}`);

  const completedSet = globalCounters.completedModIds.get(gameName);

  // 清空现有的完成集合，重新从缓存中构建
  completedSet.clear();

  // 遍历所有缓存，找出该游戏的所有已缓存模组
  let totalCachedCount = 0;
  let currentPageCachedCount = 0;

  parsedLinksCache.forEach((value, key) => {
    if (key.startsWith(`${gameName}_`)) {
      const modId = key.split('_')[1];
      completedSet.add(modId);
      totalCachedCount++;

      // 检查是否是当前页面的模组
      if (modsData.some(mod => mod.modId === modId)) {
        currentPageCachedCount++;
      }
    }
  });

  // 重新计算完成数量
  globalCounters.completedMods = completedSet.size;

  // console.log(`同步完成，当前页面缓存模组: ${currentPageCachedCount}, 总缓存模组: ${totalCachedCount}, 完成集合大小: ${globalCounters.completedMods}`);
  return currentPageCachedCount;
}

// 统一更新进度条显示 - 修复版本：分别显示当前分页和总计进度
function updateProgressDisplay(gameName, isCompleted = false) {
  const progressContainer = document.querySelector('.nexus-progress-container');
  if (!progressContainer) {
    console.log('进度容器不存在，跳过更新');
    return;
  }

  const textContainer = progressContainer.querySelector('.nexus-progress-text');
  const spinner = progressContainer.querySelector('div[style*="border-radius: 50%"]');

  if (!textContainer) {
    console.log('进度文本容器不存在，跳过更新');
    return;
  }

  // 确保计数器状态正确
  if (!globalCounters.completedModIds.has(gameName)) {
    globalCounters.completedModIds.set(gameName, new Set());
  }

  // 获取当前页面的实际模组数量和已完成数量
  const currentPageMods = extractModIdsFromGameListPage();
  const currentPageModCount = currentPageMods.length;

  // 计算当前分页中已完成的模组数量 - 使用Set去重，避免重复统计
  const currentPageCompletedModIds = new Set();
  currentPageMods.forEach(mod => {
    const cacheKey = getCacheKey(gameName, mod.modId);
    if (parsedLinksCache.has(cacheKey)) {
      currentPageCompletedModIds.add(mod.modId);
    }
  });
  const currentPageCompletedCount = currentPageCompletedModIds.size;

  // 获取总的已完成模组数量（跨所有分页）
  const totalCompletedCount = globalCounters.completedModIds.get(gameName).size;

  // console.log(`更新进度显示: 当前分页 ${currentPageCompletedCount}/${currentPageModCount}, 总计 ${totalCompletedCount}, 强制完成: ${isCompleted}`);
  // console.log(`调试信息: 缓存大小=${parsedLinksCache.size}, 完成集合大小=${globalCounters.completedModIds.get(gameName)?.size || 0}`);
  // console.log(`当前分页已完成模组ID:`, Array.from(currentPageCompletedModIds));
  // console.log(`当前分页模组总数: ${currentPageMods.length}, 去重后完成数: ${currentPageCompletedCount}`);

  // 修复完成判断逻辑：基于当前分页是否完成
  const isCurrentPageCompleted = isCompleted ||
    (currentPageModCount > 0 && currentPageCompletedCount === currentPageModCount);

  // console.log(`完成判断: 当前页模组${currentPageModCount}, 当前页完成${currentPageCompletedCount}, 总完成${totalCompletedCount}, 当前页是否完成: ${isCurrentPageCompleted}`);

  // 构建进度显示文本：当前分页XX/40 总计XX
  let progressText = '';
  if (currentPageModCount > 0) {
    progressText = `当前分页 ${currentPageCompletedCount}/${currentPageModCount}`;
    // 总是显示总计数量
    progressText += ` 总计 ${totalCompletedCount}`;
  } else {
    progressText = `总计 ${totalCompletedCount}`;
  }

  if (isCurrentPageCompleted && currentPageModCount > 0) {
    // 当前分页已完成状态 - 优化显示文本
    if (totalCompletedCount === currentPageCompletedCount) {
      // 只有当前分页的模组，没有其他分页
      textContainer.innerHTML = `当前分页已完成: 当前分页 ${currentPageCompletedCount}/${currentPageModCount}`;
    } else {
      // 有其他分页的模组
      textContainer.innerHTML = `当前分页已完成: 当前分页 ${currentPageCompletedCount}/${currentPageModCount} 总计 ${totalCompletedCount}`;
    }
    if (spinner && spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
  } else if (!isParsingEnabled) {
    // 暂停状态
    textContainer.innerHTML = `获取直链已暂停: ${progressText}`;
    if (spinner && spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
  } else {
    // 进行中状态
    textContainer.innerHTML = `正在获取链接: ${progressText}`;
    // 如果没有加载动画且需要显示，添加一个
    if (!spinner && isParsingEnabled) {
      const progressRow = textContainer.parentNode;
      if (progressRow) {
        const newSpinner = createLoadingSpinner();
        progressRow.insertBefore(newSpinner, textContainer);
      }
    }
  }
}

// 简化页面导航处理 - 每次都重新开始
function handlePageNavigation(gameName) {
  // console.log(`处理页面导航，游戏: ${gameName}, 当前URL: ${window.location.href}`);

  // 简化逻辑：每次都重新开始，移除现有进度弹窗
  const existingProgress = document.querySelector('.nexus-progress-container');
  if (existingProgress) {
    existingProgress.remove();
    console.log('移除现有进度弹窗，准备重新开始');
  }

  // 重置状态（移除totalMods重置，因为我们现在直接使用当前页面数量）
  globalCounters.completedMods = 0;
  globalCounters.currentGameName = gameName;
  globalCounters.isPageInitialized = false;

  // 确保当前游戏的集合存在
  if (!globalCounters.processedModIds.has(gameName)) {
    globalCounters.processedModIds.set(gameName, new Set());
  }
  if (!globalCounters.completedModIds.has(gameName)) {
    globalCounters.completedModIds.set(gameName, new Set());
  }

  // console.log(`页面导航处理完成，准备重新开始处理`);
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
 * 从游戏列表页面中提取所有模组ID - 修复版本：使用Set去重，避免重复模组
 * @returns {Array} 包含所有模组ID和对应元素的数组
 */
function extractModIdsFromGameListPage() {
  const modsData = [];
  const modsGrid = document.querySelector('.mods-grid');
  const processedModIds = new Set(); // 使用Set来去重

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

        // 如果已经处理过这个模组ID，跳过
        if (processedModIds.has(modId)) {
          return;
        }

        const modTile = link.closest('.mod-tile') ||
          link.closest('[class*="mod-tile"]') ||
          link.parentElement;

        if (modTile) {
          processedModIds.add(modId); // 标记为已处理
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

  // console.log(`提取模组完成，去重前链接数: ${modLinks.length}, 去重后模组数: ${modsData.length}`);
  return modsData;
}

// 创建现代化加载动画
function createLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 14px;
    height: 14px;
    border: 2px solid rgba(107, 114, 128, 0.2);
    border-top: 2px solid #6b7280;
    border-radius: 50%;
    animation: modernSpin 1s linear infinite;
    flex-shrink: 0;
  `;

  // 确保动画样式只添加一次
  if (!document.getElementById('modern-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'modern-spinner-style';
    style.textContent = `
      @keyframes modernSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return spinner;
}

// 添加解析状态控制
let isParsingEnabled = true;
let activeRequests = new Set(); // 用于跟踪活动的请求

// 添加防重复处理机制
let isCurrentlyProcessing = false;
let lastProcessedUrl = null;

// 添加扩展上下文错误处理
function handleExtensionError(error, operation) {
  if (error.message && error.message.includes('Extension context invalidated')) {
    console.warn(`扩展上下文已失效，操作: ${operation}。请刷新页面或重新加载扩展。`);
    return true; // 表示已处理该错误
  }
  return false; // 表示不是扩展上下文错误
}

// 添加扩展上下文健康检查
function checkExtensionHealth() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: "healthCheck" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('扩展上下文健康检查失败:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          console.log('扩展上下文健康检查通过');
          resolve(true);
        }
      });
    } catch (error) {
      console.warn('扩展上下文健康检查异常:', error.message);
      resolve(false);
    }
  });
}

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
    // 如果消息包含全局状态，使用全局状态；否则切换本地状态
    if (request.globalStatus !== undefined) {
      isParsingEnabled = request.globalStatus;
      console.log(`接收到全局解析状态: ${isParsingEnabled ? '开启' : '暂停'}`);
    } else {
      isParsingEnabled = !isParsingEnabled;
      console.log(`切换解析状态: ${isParsingEnabled ? '开启' : '暂停'}`);

      // 只有本地切换时才更新全局缓存
      chrome.runtime.sendMessage({
        action: "updateParsingStatus",
        isParsingEnabled: isParsingEnabled
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('更新解析状态到全局缓存失败:', chrome.runtime.lastError.message);
        } else {
          console.log('解析状态已更新到全局缓存');
        }
      });
    }

    // 使用专门的函数更新所有加载状态
    updateExistingLoadingStates();

    // 更新进度条状态 - 这是关键的修复
    const modInfo = parseNexusUrl(window.location.href);
    if (modInfo && modInfo.isValid && modInfo.isGameListPage && globalCounters.currentGameName) {
      console.log(`更新进度条状态，游戏: ${globalCounters.currentGameName}`);
      updateProgressDisplay(globalCounters.currentGameName);
    }

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
        if (modInfo.isGameListPage) {
          // 对于游戏列表页面，重新处理模组
          console.log('重新启用解析，处理游戏列表页面');
          handleGameListPage(modInfo.gameName);
        } else {
          // 对于标准模组页面，使用原有逻辑
          handleModUrlDetected(modInfo);
        }
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
        if (response.success && response.downloadUrls.length > 0) {
          sendResponse({ downloadUrls: response.downloadUrls });
        } else {
          console.log("到这里来了1");
          sendResponse({ error: response.error || "无法获取到N网授权，请先登录N网账号！" });
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
  } else if (request.action === 'authStatusChanged') {
    // 更新页面上的授权状态显示
    const authStatusDiv = document.querySelector('.auth-status');
    if (authStatusDiv) {
      if (request.isAuthorized) {
        authStatusDiv.className = 'auth-status success';
        authStatusDiv.innerHTML = `
          <img src="static/success.png" alt="已授权" class="auth-status-icon">
          <span>已获取N网授权</span>
        `;
      } else {
        authStatusDiv.className = 'auth-status error';
        authStatusDiv.innerHTML = `
          <img src="static/error.png" alt="未授权" class="auth-status-icon">
          <span>无法获取到N网授权，请先登录</span>
        `;
      }
    }
  } else if (request.action === 'updateModTileLinks') {
    const { modId, gameName, downloadUrls, fullUrl } = request;

    // 改进的模组查找逻辑：添加重试机制和更稳定的查找方法
    const findAndUpdateModTile = (retryCount = 0) => {
      console.log(`查找模组 ${modId} 的元素，重试次数: ${retryCount}`);

      // 方法1：使用extractModIdsFromGameListPage
      let modsData = extractModIdsFromGameListPage();
      let targetMod = modsData.find(m => m.modId === modId);

      // 方法2：如果方法1失败，直接通过DOM查找
      if (!targetMod) {
        console.error(`方法1未找到模组 ${modId}，尝试直接DOM查找`);
        const modLinks = document.querySelectorAll(`a[href*="/mods/${modId}"]`);
        for (const link of modLinks) {
          const modTile = link.closest('.mod-tile') ||
            link.closest('[class*="mod-tile"]') ||
            link.parentElement;
          if (modTile) {
            targetMod = { modId, element: modTile };
            console.log(`通过直接DOM查找找到模组 ${modId}`);
            break;
          }
        }
      }

      if (targetMod) {
        // console.log(`成功找到模组 ${modId} 的元素，开始更新直链`);
        // 获取加载时间
        const loadingTime = getLoadingTime(modId);

        // 检查 downloadUrls 是否为空
        if (!downloadUrls || downloadUrls.length === 0) {
          console.log(`模组 ${modId} 的下载链接为空，显示错误信息`);
          // 获取直链失败，清除授权缓存
          chrome.runtime.sendMessage({ action: "clearAuthStatus" });
          // 显示错误信息而不是保存空的缓存
          displayErrorInModTile(targetMod.element, "无法获取到N网授权，请先登录N网账号！");
        } else {
          // 保存到缓存（包含加载时间）
          saveDirectLinksToCache(gameName, modId, downloadUrls, fullUrl, loadingTime);
          // 显示直链时传递加载时间
          displayDirectLinksInModTile(targetMod.element, downloadUrls, fullUrl, loadingTime);
        }

        // 更新进度计数器 - 使用新的统一方法，添加防重复检查
        if (!globalCounters.completedModIds.has(gameName)) {
          globalCounters.completedModIds.set(gameName, new Set());
        }

        const completedSet = globalCounters.completedModIds.get(gameName);
        if (!completedSet.has(modId)) {
          completedSet.add(modId);
          console.log(`模组 ${modId} 完成，当前完成数量: ${completedSet.size}`);
        } else {
          console.log(`模组 ${modId} 已经在完成列表中，跳过重复添加`);
        }

        // 使用统一的进度更新函数
        updateProgressDisplay(gameName);
        return true;
      } else if (retryCount < 3) {
        // 如果没找到且重试次数未达上限，等待后重试
        console.error(`未找到模组 ${modId} 的元素，${500 * (retryCount + 1)}ms后重试`);
        setTimeout(() => {
          findAndUpdateModTile(retryCount + 1);
        }, 500 * (retryCount + 1)); // 递增延迟：500ms, 1000ms, 1500ms
        return false;
      } else {
        console.error(`多次重试后仍未找到模组 ${modId} 的元素`);
        // 即使找不到元素，也要保存到缓存和更新计数器（包含加载时间）
        const loadingTime = getLoadingTime(modId);

        // 检查 downloadUrls 是否为空，只有非空时才保存到缓存
        if (downloadUrls && downloadUrls.length > 0) {
          saveDirectLinksToCache(gameName, modId, downloadUrls, fullUrl, loadingTime);
        } else {
          console.log(`模组 ${modId} 的下载链接为空，不保存到缓存`);
        }

        if (!globalCounters.completedModIds.has(gameName)) {
          globalCounters.completedModIds.set(gameName, new Set());
        }
        if (!globalCounters.completedModIds.get(gameName).has(modId)) {
          globalCounters.completedModIds.get(gameName).add(modId);
          // console.log(`模组 ${modId} 完成（未找到元素），当前完成数量: ${globalCounters.completedModIds.get(gameName).size}`);
        }
        updateProgressDisplay(gameName);
        return false;
      }
    };

    // 立即尝试查找和更新
    findAndUpdateModTile();

    sendResponse({ success: true });
    return true;
  } else if (request.action === 'updateModTileError') {
    const { modId, gameName, error } = request;

    // 改进的模组查找逻辑：与updateModTileLinks保持一致
    const findAndUpdateModTileError = (retryCount = 0) => {
      console.log(`查找模组 ${modId} 的元素以显示错误，重试次数: ${retryCount}`);

      // 方法1：使用extractModIdsFromGameListPage
      let modsData = extractModIdsFromGameListPage();
      let targetMod = modsData.find(m => m.modId === modId);

      // 方法2：如果方法1失败，直接通过DOM查找
      if (!targetMod) {
        // console.log(`方法1未找到模组 ${modId}，尝试直接DOM查找`);
        const modLinks = document.querySelectorAll(`a[href*="/mods/${modId}"]`);
        for (const link of modLinks) {
          const modTile = link.closest('.mod-tile') ||
            link.closest('[class*="mod-tile"]') ||
            link.parentElement;
          if (modTile) {
            targetMod = { modId, element: modTile };
            // console.log(`通过直接DOM查找找到模组 ${modId}`);
            break;
          }
        }
      }

      if (targetMod) {
        // console.log(`成功找到模组 ${modId} 的元素，显示错误信息`);
        displayErrorInModTile(targetMod.element, error);
        return true;
      } else if (retryCount < 3) {
        // 如果没找到且重试次数未达上限，等待后重试
        console.log(`未找到模组 ${modId} 的元素，${500 * (retryCount + 1)}ms后重试`);
        setTimeout(() => {
          findAndUpdateModTileError(retryCount + 1);
        }, 500 * (retryCount + 1));
        return false;
      } else {
        console.error(`多次重试后仍未找到模组 ${modId} 的元素，无法显示错误信息: ${error}`);
        return false;
      }
    };

    // 立即尝试查找和更新
    findAndUpdateModTileError();

    sendResponse({ success: true });
    return true;
  } else if (request.action === 'openChatRoom') {
    // 处理来自popup的聊天室打开请求
    console.log('收到来自popup的聊天室打开请求');

    // 发送消息给background script打开新窗口
    chrome.runtime.sendMessage({
      action: 'openChatRoomWindow'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送打开聊天室窗口消息失败:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: '聊天室功能暂时不可用: ' + chrome.runtime.lastError.message });
      } else if (response && response.success) {
        console.log('聊天室窗口创建成功, 窗口ID:', response.windowId);
        sendResponse({ success: true });
      } else {
        console.error('聊天室窗口创建失败:', response?.error);
        sendResponse({ success: false, error: response?.error || '聊天室窗口创建失败' });
      }
    });

    return true; // 表示异步响应
  } else if (request.action === 'versionUpdateNotification') {
    // 处理版本更新通知
    const { versionResult } = request;
    showVersionUpdateNotification(versionResult);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * 显示版本更新通知
 * @param {Object} versionResult 版本校验结果
 */
function showVersionUpdateNotification(versionResult) {
  // 检查是否已经显示过通知
  if (document.querySelector('.version-update-notification')) {
    return;
  }

  console.log('🔔 显示版本更新通知:', versionResult);

  // 创建通知容器
  const notification = document.createElement('div');
  notification.className = 'version-update-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(255, 107, 107, 0.3);
    max-width: 350px;
    animation: slideInRight 0.5s ease-out;
    cursor: pointer;
    transition: all 0.3s ease;
  `;

  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .version-update-notification:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(255, 107, 107, 0.4);
    }
  `;
  document.head.appendChild(style);

  // 创建通知内容
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <img src="${chrome.runtime.getURL('images/officialVersion.png')}" alt="版本图标" style="width: 20px; height: 20px; object-fit: contain; filter: brightness(0) invert(1);">
      <div style="font-weight: 600; font-size: 16px;">发现新版本</div>
      <div style="margin-left: auto; cursor: pointer; opacity: 0.8; font-size: 18px;" onclick="this.closest('.version-update-notification').remove()">×</div>
    </div>
    <div style="margin-bottom: 8px; opacity: 0.9;">
      当前版本: ${versionResult.currentVersion}<br>
      最新版本: ${versionResult.serverVersion}
    </div>
    <div style="font-size: 12px; opacity: 0.8; margin-bottom: 12px;">
      点击此通知获取更新信息
    </div>
  `;

  notification.appendChild(content);

  // 添加点击事件
  notification.addEventListener('click', (e) => {
    if (e.target.textContent !== '×') {
      // 如果有更新链接，打开更新页面
      if (versionResult.systemConfig?.sysUrl) {
        window.open(versionResult.systemConfig.sysUrl, '_blank');
      } else {
        // 否则打开默认更新页面
        window.open('https://space.bilibili.com/18718286?spm_id_from=333.1007.0.0', '_blank');
      }
      notification.remove();
    }
  });

  // 添加到页面
  document.body.appendChild(notification);

  // 10秒后自动消失
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideInRight 0.5s ease-out reverse';
      setTimeout(() => {
        notification.remove();
      }, 500);
    }
  }, 10000);
}

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
      if (cachedData.downloadUrls.length > 0) {
        // console.log('从缓存中获取到直链');
        displayAllDirectLinks(cachedData.downloadUrls);
        return;
      }
    }
    // 发送消息给background.js获取所有下载链接
    chrome.runtime.sendMessage({
      action: "getAllDownloadUrls",
      modId: modInfo.modId,
      gameName: modInfo.gameName,
      isGameListPage: false // 标准模组页面
    }, (response) => {
      if (response.success && response.downloadUrls.length > 0) {
        // 保存到缓存（标准页面没有加载时间跟踪）
        const fullUrl = `https://www.nexusmods.com/${modInfo.gameName}/mods/${modInfo.modId}?tab=files`;
        saveDirectLinksToCache(modInfo.gameName, modInfo.modId, response.downloadUrls, fullUrl, null);
        displayAllDirectLinks(response.downloadUrls);
      } else {
        console.log("到这里来了2");
        // 获取直链失败，清除授权缓存
        chrome.runtime.sendMessage({ action: "clearAuthStatus" });
        displayModPageError(response.error || "无法获取到N网授权，请先登录N网账号！");
      }
    });
  } catch (error) {
    // 发生错误时也清除授权缓存
    chrome.runtime.sendMessage({ action: "clearAuthStatus" });
    displayModPageError(error.message);
  }
}

/**
 * 处理游戏列表页面 - 重构版本
 * @param {string} gameName 游戏名称
 */
function handleGameListPage(gameName) {
  const currentUrl = window.location.href;
  // console.log(`开始处理游戏列表页面: ${gameName}, 当前URL: ${currentUrl}`);
  // console.log(`解析状态: ${isParsingEnabled ? '启用' : '暂停'}`);

  // 简化逻辑：移除复杂的防重复处理检查
  // 因为background.js已经处理了页面切换，这里直接处理即可

  // 设置处理状态
  isCurrentlyProcessing = true;
  lastProcessedUrl = currentUrl;

  // 设置处理完成的回调
  const finishProcessing = () => {
    setTimeout(() => {
      isCurrentlyProcessing = false;
      console.log(`页面处理完成，重置处理状态: ${currentUrl}`);
    }, 1000); // 减少到1秒，提高响应速度
  };

  // 重置并同步计数器
  resetAndSyncCounters(gameName);

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

      // 只在非暂停状态下添加加载动画
      if (isParsingEnabled) {
        const spinner = createLoadingSpinner();
        progressRow.appendChild(spinner);
      }

      const textContainer = document.createElement('span');
      textContainer.className = 'nexus-progress-text';
      // 使用新的进度显示格式，初始显示当前分页进度
      const currentPageMods = extractModIdsFromGameListPage();
      const currentPageModCount = currentPageMods.length;
      const initialProgressText = currentPageModCount > 0 ? `当前分页 0/${currentPageModCount}` : '准备中...';
      textContainer.innerHTML = isParsingEnabled ?
        `正在获取链接: ${initialProgressText}` :
        `获取直链已暂停: ${initialProgressText}`;
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
    // console.log(`processMods 被调用，重试次数: ${retryCount}, 解析状态: ${isParsingEnabled ? '启用' : '暂停'}`);

    const modsData = extractModIdsFromGameListPage();
    // console.log(`提取到 ${modsData.length} 个模组`);

    if (modsData.length === 0) {
      console.log(`未找到任何模组ID，重试次数: ${retryCount}`);
      if (retryCount < 5) { // 最多重试5次
        setTimeout(() => {
          processMods(retryCount + 1);
        }, 2000);//重试延迟2秒
      } else {
        console.error('多次重试后仍未找到模组ID');
      }
      return;
    }

    // console.log(`找到 ${modsData.length} 个模组`);

    // 标记页面已初始化，但不再设置totalMods，因为我们现在直接使用当前页面数量
    globalCounters.isPageInitialized = true;
    // console.log(`页面初始化完成，当前页面模组数: ${modsData.length}`);

    // 清空已处理模组集合，重新开始
    const processedSet = globalCounters.processedModIds.get(gameName);
    processedSet.clear();
    // console.log(`清空已处理模组集合，重新开始处理`);

    // 所有模组都需要处理（简化逻辑）
    const newMods = modsData;
    // console.log(`所有 ${newMods.length} 个模组都需要处理`);

    // 调试：打印当前页面的模组ID
    // console.log(`当前页面模组ID:`, modsData.map(m => m.modId));

    // 修复：不要将所有模组都标记为已处理，只标记有缓存的模组
    // 这样可以确保没有缓存的模组在下次处理时仍然被识别为新模组
    modsData.forEach(modData => {
      const cacheKey = getCacheKey(gameName, modData.modId);
      if (parsedLinksCache.has(cacheKey)) {
        // 只有有缓存的模组才标记为已处理
        processedSet.add(modData.modId);
      }
    });

    // console.log(`标记为已处理的模组数量: ${processedSet.size}`);

    // 同步缓存状态到计数器
    const cachedCount = syncCacheToCounters(gameName, modsData);
    // console.log(`发现 ${cachedCount} 个缓存模组`);

    // 为所有模组添加直链显示 - 改进版本，添加延迟确保DOM稳定
    const displayModLinks = (skipCompleted = false) => {
      // console.log(`开始为 ${modsData.length} 个模组显示直链状态${skipCompleted ? '（跳过已完成）' : ''}`);
      modsData.forEach((modData, index) => {
        // 添加小延迟，确保DOM元素稳定
        setTimeout(() => {
          // 如果需要跳过已完成的模组，检查是否已经有成功状态的容器
          if (skipCompleted) {
            const existingContainer = modData.element.querySelector(`.${CONTAINER_CLASS}`);
            if (existingContainer) {
              // 检查是否是成功状态（包含下载链接的容器）
              const downloadLink = existingContainer.querySelector('a[href*="http"]');
              if (downloadLink) {
                // console.log(`跳过已完成的模组 ${modData.modId}`);
                return; // 跳过已经显示成功状态的模组
              }
            }
          }

          // 检查缓存中是否已有该模组的直链
          const cacheKey = getCacheKey(gameName, modData.modId);
          if (parsedLinksCache.has(cacheKey)) {
            // 如果缓存中有，检查直链是否有效
            const cachedData = parsedLinksCache.get(cacheKey);
            if (cachedData.downloadUrls && cachedData.downloadUrls.length > 0) {
              // console.log(`显示模组 ${modData.modId} 的缓存直链${cachedData.loadingTime ? `，加载时间: ${cachedData.loadingTime}ms` : ''}`);
              displayDirectLinksInModTile(modData.element, cachedData.downloadUrls, cachedData.fullUrl, cachedData.loadingTime);
            } else {
              // 如果缓存中的直链为空，显示错误状态
              console.log(`模组 ${modData.modId} 缓存中的直链为空，显示错误状态`);
              displayErrorInModTile(modData.element, "未找到可用的下载链接");
            }
          } else {
            // 如果缓存中没有，显示加载状态
            // console.log(`显示模组 ${modData.modId} 的加载状态`);
            displayLoadingInModTile(modData.element, modData.modId, gameName);
          }
        }, index * 10); // 每个模组延迟10ms，避免同时操作大量DOM
      });
    };

    // 立即显示，然后在DOM稳定后再次确保显示（但跳过已完成的）
    displayModLinks();
    setTimeout(() => displayModLinks(true), 500); // 500ms后再次确保显示，但跳过已完成的模组

    // 获取或创建进度弹窗 - 确保在更新进度前创建
    const progressContainer = getOrCreateProgressContainer();
    // console.log('进度容器创建/获取完成:', progressContainer ? '成功' : '失败');

    // 重新计算需要后台处理的模组：所有没有缓存的模组
    const modsToProcessByBackground = modsData.filter(modData => {
      const cacheKey = getCacheKey(gameName, modData.modId);
      return !parsedLinksCache.has(cacheKey);
    });

    // console.log(`需要后台处理的模组数量: ${modsToProcessByBackground.length}`);

    // 使用统一的进度更新函数 - 确保进度容器已存在
    updateProgressDisplay(gameName);

    // 检查是否暂停状态
    if (!isParsingEnabled) {
      // console.log('获取直链已暂停，显示暂停状态但不发送到后台处理');
      updateProgressDisplay(gameName);
      finishProcessing();
      return;
    }

    if (modsToProcessByBackground.length > 0) {
      // console.log(`发送 ${modsToProcessByBackground.length} 个模组到后台处理`);

      // 先进行扩展健康检查
      checkExtensionHealth().then(isHealthy => {
        if (!isHealthy) {
          console.error("扩展上下文不健康，无法处理模组");
          // 显示错误信息给用户
          modsToProcessByBackground.forEach(modData => {
            displayErrorInModTile(modData.element, "扩展上下文失效，请刷新页面");
          });
          finishProcessing();
          return;
        }

        // 立即将这些模组标记为已处理，避免重复发送
        modsToProcessByBackground.forEach(modData => {
          processedSet.add(modData.modId);
        });
        // console.log(`已将 ${modsToProcessByBackground.length} 个模组标记为处理中`);

        // 扩展健康，继续发送消息
        // console.log("扩展健康检查通过，发送模组处理请求...");

        // 只发送需要后台处理的模组
        try {
          console.log("准备发送消息到background.js，消息内容:", {
            action: "processGameListMods",
            mods: modsToProcessByBackground.map(modData => ({
              modId: modData.modId,
              gameName: gameName
            }))
          });

          chrome.runtime.sendMessage({
            action: "processGameListMods",
            mods: modsToProcessByBackground.map(modData => ({
              modId: modData.modId,
              gameName: gameName
            })),
            currentPageUrl: window.location.href // 添加当前页面URL
          }, (response) => {
            // console.log("收到background.js的响应:", response);
            // console.log("chrome.runtime.lastError:", chrome.runtime.lastError);

            if (chrome.runtime.lastError) {
              console.error("Chrome runtime错误详情:", chrome.runtime.lastError);
              if (!handleExtensionError(chrome.runtime.lastError, "发送模组处理请求")) {
                console.error("发送模组处理请求失败:", chrome.runtime.lastError.message);
                // 如果发送失败，从已处理集合中移除这些模组
                modsToProcessByBackground.forEach(modData => {
                  processedSet.delete(modData.modId);
                });
              }
              return;
            }

            if (response && response.success) {
              // console.log("已发送未缓存模组列表到后台脚本处理。");
            } else {
              // console.error("发送未缓存模组列表到后台脚本失败:", response ? response.error : "无响应");
              // 如果后台处理失败，从已处理集合中移除这些模组
              modsToProcessByBackground.forEach(modData => {
                processedSet.delete(modData.modId);
              });
            }
          });
        } catch (error) {
          if (!handleExtensionError(error, "发送模组处理请求")) {
            // console.error("发送模组处理请求异常:", error);
            // 如果发送异常，从已处理集合中移除这些模组
            modsToProcessByBackground.forEach(modData => {
              processedSet.delete(modData.modId);
            });
          }
        }
      });
    } else {
      // 修复：不要强制标记为完成，让 updateProgressDisplay 自己判断
      // console.log("当前页面所有模组都已缓存或无新模组需要处理");
      updateProgressDisplay(gameName); // 移除 true 参数，让函数自己判断是否完成
    }

    // 处理完成后重置状态
    finishProcessing();
  };

  // 开始处理
  processMods();
}

/**
 * 在模组卡片中显示加载状态
 * @param {Element} modTile 模组卡片元素
 * @param {string} modId 模组ID（可选，用于时间跟踪）
 * @param {string} gameName 游戏名称（可选，用于时间跟踪）
 */
function displayLoadingInModTile(modTile, modId = null, gameName = null) {
  if (!modTile) return;

  // 检查是否已经存在直链容器，如果存在则更新而不是重复创建
  let container = modTile.querySelector(`.${CONTAINER_CLASS}`);
  let isExisting = !!container;

  // 尝试从模组卡片中提取模组ID（如果没有提供）
  if (!modId) {
    const modLink = modTile.querySelector('a[href*="/mods/"]');
    if (modLink) {
      const href = modLink.getAttribute('href');
      const modIdMatch = href.match(/\/mods\/(\d+)/);
      if (modIdMatch && modIdMatch[1]) {
        modId = modIdMatch[1];
      }
    }
  }

  // 开始计时（如果有模组ID和游戏名称，且不是已存在的容器）
  if (modId && gameName && !isExisting) {
    startLoadingTimer(modId, gameName);
  }

  // 如果容器不存在，创建新的
  if (!container) {
    container = document.createElement('div');
    container.className = CONTAINER_CLASS;
  }

  // 清空容器内容并应用对应的样式
  container.innerHTML = '';
  container.style.cssText = isParsingEnabled ? STYLES.CONTAINER_LOADING : STYLES.CONTAINER_PAUSED;

  // 只在非暂停状态下添加加载动画
  if (isParsingEnabled) {
    const spinner = createLoadingSpinner();
    container.appendChild(spinner);
  } else {
    // 暂停状态显示暂停图标
    const pauseIcon = document.createElement('span');
    pauseIcon.textContent = '⏸️';
    pauseIcon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
    container.appendChild(pauseIcon);
  }

  const loadingText = document.createElement('span');
  loadingText.textContent = isParsingEnabled ? '正在获取直链...' : '获取直链已暂停';
  loadingText.style.cssText = 'font-weight: 500;';
  container.appendChild(loadingText);

  // 只有在容器不存在时才插入到模组卡片中
  if (!isExisting) {
    modTile.appendChild(container);
  }
}

/**
 * 在模组卡片中显示直链
 * @param {Element} modTile 模组卡片元素
 * @param {Array} downloadUrls 下载链接数组
 * @param {string} fullUrl 完整的模组URL
 * @param {number} cachedLoadingTime 缓存的加载时间（可选）
 */
function displayDirectLinksInModTile(modTile, downloadUrls, fullUrl, cachedLoadingTime = null) {
  if (!modTile || !downloadUrls || downloadUrls.length === 0) return;

  // 尝试从模组卡片中提取模组ID和游戏名称
  let modId = null;
  let gameName = null;
  const modLink = modTile.querySelector('a[href*="/mods/"]');
  if (modLink) {
    const href = modLink.getAttribute('href');
    const modIdMatch = href.match(/\/mods\/(\d+)/);
    if (modIdMatch && modIdMatch[1]) {
      modId = modIdMatch[1];
    }
    // 从URL中提取游戏名称
    const gameNameMatch = href.match(/\/([^\/]+)\/mods\//);
    if (gameNameMatch && gameNameMatch[1]) {
      gameName = gameNameMatch[1];
    }
  }

  // 获取加载时间：优先使用传入的缓存时间，其次从缓存获取
  let loadingTime = cachedLoadingTime;
  if (!loadingTime && modId && gameName) {
    // 从缓存中获取加载时间
    const cachedData = getDirectLinksFromCache(gameName, modId);
    if (cachedData && cachedData.loadingTime) {
      loadingTime = cachedData.loadingTime;
      console.log(`从缓存获取模组 ${modId} 的加载时间: ${loadingTime}ms`);
    }
  }

  // 移除现有的容器
  const existingContainer = modTile.querySelector(`.${CONTAINER_CLASS}`);
  if (existingContainer) {
    existingContainer.remove();
  }

  // 创建容器，直接使用SUCCESS样式
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.SUCCESS;

  // 左侧：下载链接
  const linkElement = document.createElement('a');
  linkElement.href = downloadUrls[0].url;
  linkElement.target = '_blank';
  linkElement.style.cssText = `
    flex: 1;
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    font-size: 13px;
    transition: color 0.2s ease;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  linkElement.textContent = '点击下载';

  // 添加悬停效果
  linkElement.addEventListener('mouseenter', () => {
    linkElement.style.color = '#2563eb';
  });
  linkElement.addEventListener('mouseleave', () => {
    linkElement.style.color = '#3b82f6';
  });

  container.appendChild(linkElement);

  // 右侧信息组
  const rightInfo = document.createElement('div');
  rightInfo.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  `;

  // 文件数量（总是显示，即使只有1个文件）
  const fileCount = document.createElement('span');
  fileCount.style.cssText = `
    font-size: 11px;
    color: #64748b;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  `;
  fileCount.innerHTML = `📁 ${downloadUrls.length}个文件`;

  // 添加悬停事件，显示文件详情弹窗
  let hoverTimeout;
  let tooltip = null;
  let isMouseOverTooltip = false;

  fileCount.addEventListener('mouseenter', () => {
    // 添加悬停背景效果
    fileCount.style.backgroundColor = '#e2e8f0';
    // 清除之前的定时器
    clearTimeout(hoverTimeout);

    hoverTimeout = setTimeout(() => {
      // 如果悬浮窗已存在，不重复创建
      if (tooltip) return;

      // 创建悬浮窗
      tooltip = document.createElement('div');
      tooltip.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        font-size: 12px;
        line-height: 1.4;
      `;

      // 为悬浮窗添加鼠标事件
      tooltip.addEventListener('mouseenter', () => {
        isMouseOverTooltip = true;
      });

      tooltip.addEventListener('mouseleave', () => {
        isMouseOverTooltip = false;
        // 延迟隐藏，给用户时间移回触发元素
        setTimeout(() => {
          if (!isMouseOverTooltip && tooltip) {
            tooltip.remove();
            tooltip = null;
          }
        }, 100);
      });

      // 添加标题行（包含标题和全部复制按钮）
      const titleRow = document.createElement('div');
      titleRow.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 4px;
      `;

      // 标题文本
      const title = document.createElement('div');
      title.style.cssText = `
        font-weight: 600;
        color: #333;
      `;
      title.textContent = `文件列表 (${downloadUrls.length}个)`;

      titleRow.appendChild(title);

      // 全部复制按钮（如果有多个文件）
      if (downloadUrls.length > 1) {
        const copyAllBtn = document.createElement('img');
        copyAllBtn.src = chrome.runtime.getURL('static/copy-all.png');
        copyAllBtn.alt = '全部复制';
        copyAllBtn.title = `复制全部 ${downloadUrls.length} 个文件链接`;
        copyAllBtn.style.cssText = `
          width: 16px;
          height: 16px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s ease;
        `;

        // 悬停效果
        copyAllBtn.addEventListener('mouseenter', () => {
          copyAllBtn.style.opacity = '1';
        });
        copyAllBtn.addEventListener('mouseleave', () => {
          copyAllBtn.style.opacity = '0.7';
        });

        // 点击事件
        copyAllBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // 将所有URL用换行符连接
          const allUrls = downloadUrls.map(item => item.url).join('\n');

          navigator.clipboard.writeText(allUrls).then(() => {
            // 显示复制成功提示
            const originalSrc = copyAllBtn.src;
            copyAllBtn.src = chrome.runtime.getURL('static/success.png');
            copyAllBtn.title = '已复制全部文件链接!';

            setTimeout(() => {
              copyAllBtn.src = originalSrc;
              copyAllBtn.title = `复制全部 ${downloadUrls.length} 个文件链接`;
            }, 1500);
          }).catch(() => {
            // 复制失败提示
            const originalSrc = copyAllBtn.src;
            copyAllBtn.src = chrome.runtime.getURL('static/error.png');
            copyAllBtn.title = '复制失败';

            setTimeout(() => {
              copyAllBtn.src = originalSrc;
              copyAllBtn.title = `复制全部 ${downloadUrls.length} 个文件链接`;
            }, 1500);
          });
        });

        titleRow.appendChild(copyAllBtn);
      }

      tooltip.appendChild(titleRow);

      // 添加文件列表
      downloadUrls.forEach((downloadUrl, index) => {
        const fileItem = document.createElement('div');
        fileItem.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          border-bottom: ${index < downloadUrls.length - 1 ? '1px solid #f5f5f5' : 'none'};
        `;

        // 文件名（可点击下载）
        const fileName = document.createElement('a');
        fileName.href = downloadUrl.url;
        fileName.target = '_blank';
        fileName.style.cssText = `
          flex: 1;
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
          cursor: pointer;
          word-break: break-all;
        `;
        fileName.textContent = getFilenameFromUrl(downloadUrl.url);
        fileName.addEventListener('mouseenter', () => {
          fileName.style.color = '#2563eb';
          fileName.style.textDecoration = 'underline';
        });
        fileName.addEventListener('mouseleave', () => {
          fileName.style.color = '#3b82f6';
          fileName.style.textDecoration = 'none';
        });

        // 复制按钮
        const copyBtn = document.createElement('img');
        copyBtn.src = chrome.runtime.getURL('static/copy.png');
        copyBtn.alt = '复制';
        copyBtn.style.cssText = `
          width: 16px;
          height: 16px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s ease;
        `;
        copyBtn.addEventListener('mouseenter', () => {
          copyBtn.style.opacity = '1';
        });
        copyBtn.addEventListener('mouseleave', () => {
          copyBtn.style.opacity = '0.7';
        });
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(downloadUrl.url).then(() => {
            // 显示复制成功提示
            const originalSrc = copyBtn.src;
            copyBtn.src = chrome.runtime.getURL('static/success.png');
            setTimeout(() => {
              copyBtn.src = originalSrc;
            }, 1000);
          }).catch(() => {
            // 复制失败提示
            const originalSrc = copyBtn.src;
            copyBtn.src = chrome.runtime.getURL('static/error.png');
            setTimeout(() => {
              copyBtn.src = originalSrc;
            }, 1000);
          });
        });

        fileItem.appendChild(fileName);
        fileItem.appendChild(copyBtn);
        tooltip.appendChild(fileItem);
      });



      // 计算位置
      const rect = fileCount.getBoundingClientRect();
      const tooltipLeft = Math.min(rect.left, window.innerWidth - 420); // 确保不超出右边界
      const tooltipTop = rect.bottom + 5; // 在元素下方5px

      tooltip.style.left = tooltipLeft + 'px';
      tooltip.style.top = tooltipTop + 'px';

      document.body.appendChild(tooltip);
    }, 200); // 减少延迟到200ms
  });

  fileCount.addEventListener('mouseleave', () => {
    // 恢复背景色
    fileCount.style.backgroundColor = '#f1f5f9';
    // 清除定时器
    clearTimeout(hoverTimeout);

    // 延迟隐藏悬浮窗，给用户时间移动到悬浮窗上
    setTimeout(() => {
      if (!isMouseOverTooltip && tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    }, 200); // 200ms延迟隐藏
  });

  rightInfo.appendChild(fileCount);

  // 加载时间
  if (loadingTime !== null) {
    // console.log(`显示模组 ${modId} 的加载时间: ${loadingTime}ms`);
    const loadingTimeElement = document.createElement('span');
    loadingTimeElement.style.cssText = STYLES.LOADING_TIME + `
      display: flex;
      align-items: center;
      gap: 2px;
    `;
    loadingTimeElement.innerHTML = `⚡ ${formatLoadingTime(loadingTime)}`;
    rightInfo.appendChild(loadingTimeElement);
  } else {
    // console.log(`模组 ${modId} 没有加载时间数据`);
  }

  // 复制按钮
  const copyButton = document.createElement('button');
  copyButton.textContent = '复制';
  copyButton.style.cssText = `
    padding: 4px 8px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: background 0.2s ease;
  `;
  // 添加复制按钮悬停效果
  copyButton.addEventListener('mouseenter', () => {
    copyButton.style.background = '#059669';
  });
  copyButton.addEventListener('mouseleave', () => {
    copyButton.style.background = '#10b981';
  });

  copyButton.onclick = () => {
    navigator.clipboard.writeText(downloadUrls[0].url).then(() => {
      // 保存原始文本和样式
      const originalText = copyButton.textContent;
      const originalBg = copyButton.style.background;

      // 显示成功状态
      copyButton.textContent = '已复制';
      copyButton.style.background = '#059669';

      // 1.5秒后恢复原始状态
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.background = originalBg;
      }, 1500);
    }).catch(() => {
      // 复制失败时的处理
      const originalText = copyButton.textContent;
      const originalBg = copyButton.style.background;

      copyButton.textContent = '失败';
      copyButton.style.background = '#dc2626';

      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.background = originalBg;
      }, 1500);
    });
  };

  rightInfo.appendChild(copyButton);
  container.appendChild(rightInfo);

  // 插入到模组卡片中
  modTile.appendChild(container);
}

/**
 * 在模组卡片中显示现代化错误信息
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
  container.style.cssText = STYLES.CONTAINER_ERROR;

  // 添加错误图标
  const errorIcon = document.createElement('span');
  errorIcon.textContent = '⚠️';
  errorIcon.style.cssText = 'font-size: 14px; flex-shrink: 0;';

  // 添加错误文本
  const errorText = document.createElement('span');
  errorText.textContent = message;
  errorText.style.cssText = 'font-weight: 500;';

  container.appendChild(errorIcon);
  container.appendChild(errorText);

  // 插入到模组卡片中
  modTile.appendChild(container);
}

/**
 * 在页面上显示所有文件的直链 - 现代化简洁版本
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

    // 创建容器，直接使用SUCCESS样式
    const container = document.createElement('div');
    container.className = CONTAINER_CLASS;
    container.style.cssText = STYLES.SUCCESS;

    // 提取文件名
    const filename = getFilenameFromUrl(item.url);

    // 创建文件名链接
    const linkElement = document.createElement('a');
    linkElement.href = item.url;
    linkElement.target = '_blank';
    linkElement.title = `点击下载: ${filename}`;
    linkElement.style.cssText = `
      flex: 1;
      color: #1a73e8;
      text-decoration: none;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
      font-weight: 500;
      background: rgba(26, 115, 232, 0.05);
      border: 1px solid rgba(26, 115, 232, 0.1);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    linkElement.textContent = filename;

    // 添加悬停效果
    linkElement.onmouseenter = () => {
      linkElement.style.background = 'rgba(26, 115, 232, 0.1)';
      linkElement.style.borderColor = 'rgba(26, 115, 232, 0.2)';
      linkElement.style.transform = 'translateY(-1px)';
    };
    linkElement.onmouseleave = () => {
      linkElement.style.background = 'rgba(26, 115, 232, 0.05)';
      linkElement.style.borderColor = 'rgba(26, 115, 232, 0.1)';
      linkElement.style.transform = 'translateY(0)';
    };
    container.appendChild(linkElement);

    // 创建复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制';
    copyButton.style.cssText = `
      padding: 6px 12px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
      flex-shrink: 0;
    `;

    // 添加悬停效果
    copyButton.onmouseenter = () => {
      copyButton.style.transform = 'translateY(-1px)';
      copyButton.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
      copyButton.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    };
    copyButton.onmouseleave = () => {
      copyButton.style.transform = 'translateY(0)';
      copyButton.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
      copyButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    };
    // 复制按钮点击事件
    copyButton.onclick = () => {
      navigator.clipboard.writeText(item.url).then(() => {
        // 保存原始状态
        const originalText = copyButton.textContent;

        // 显示成功状态
        copyButton.textContent = '✓ 已复制';
        copyButton.style.transform = 'scale(1.05)';

        // 1.5秒后恢复
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.style.transform = 'translateY(0)';
        }, 1500);
      }).catch(() => {
        // 复制失败处理
        const originalText = copyButton.textContent;
        const originalBg = copyButton.style.background;

        copyButton.textContent = '✗ 失败';
        copyButton.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.style.background = originalBg;
        }, 1500);
      });
    };

    container.appendChild(copyButton);

    // 插入到预览按钮后面
    previewButton.parentNode.insertBefore(container, previewButton.nextSibling);
  });
}

/**
 * 显示现代化加载状态
 * @param {string} fileId 文件ID
 */
function displayLoading(fileId) {
  const previewButton = document.querySelector(`[data-id="${fileId}"] .btn-ajax-content-preview`);
  if (!previewButton) return;

  // 移除已存在的容器
  const existingContainer = previewButton.parentNode.querySelector(`.${CONTAINER_CLASS}`);
  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;

  const loadingContent = document.createElement('div');
  loadingContent.style.cssText = STYLES.LOADING;

  // 只在非暂停状态下添加加载动画
  if (isParsingEnabled) {
    const spinner = createLoadingSpinner();
    loadingContent.appendChild(spinner);

    // 添加加载文本
    const loadingText = document.createElement('span');
    loadingText.textContent = '正在获取直链...';
    loadingText.style.cssText = 'font-weight: 500;';
    loadingContent.appendChild(loadingText);
  } else {
    // 暂停状态显示暂停图标
    const pauseIcon = document.createElement('span');
    pauseIcon.textContent = '⏸️';
    pauseIcon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
    loadingContent.appendChild(pauseIcon);

    // 添加暂停文本
    const pauseText = document.createElement('span');
    pauseText.textContent = '获取直链已暂停';
    pauseText.style.cssText = 'font-weight: 500; color: #f59e0b;';
    loadingContent.appendChild(pauseText);

    // 暂停状态使用不同的背景色
    loadingContent.style.background = '#fffbeb';
    loadingContent.style.color = '#f59e0b';
    loadingContent.style.animation = 'none';
  }

  container.appendChild(loadingContent);

  // 插入到预览按钮后面
  previewButton.parentNode.insertBefore(container, previewButton.nextSibling);
}

/**
 * 在页面上显示现代化错误信息
 * @param {string} message 错误信息
 * @param {string} fileId 文件ID
 */
function displayDirectLinkError(message, fileId) {
  const fileElement = document.querySelector(`[data-id="${fileId}"]`);
  if (!fileElement) return;

  // 移除已存在的容器
  const existingContainer = fileElement.parentNode.querySelector(`.${CONTAINER_CLASS}`);
  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  container.style.cssText = STYLES.CONTAINER;

  const errorContent = document.createElement('div');
  errorContent.style.cssText = STYLES.CONTAINER_ERROR;

  // 添加错误图标
  const errorIcon = document.createElement('span');
  errorIcon.textContent = '⚠️';
  errorIcon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
  errorContent.appendChild(errorIcon);

  // 添加错误文本
  const errorText = document.createElement('span');
  errorText.textContent = message;
  errorText.style.cssText = 'font-weight: 500;';
  errorContent.appendChild(errorText);

  container.appendChild(errorContent);

  // 插入到文件元素后面
  fileElement.parentNode.insertBefore(container, fileElement.nextSibling);
}

/**
 * 为所有文件元素显示错误信息（用于标准模组页面）
 * @param {string} message 错误信息
 */
function displayDirectLinkErrorForAllFiles(message) {
  // 获取所有文件元素
  const fileElements = document.querySelectorAll('[data-id]');

  if (fileElements.length === 0) {
    console.log('未找到文件元素，无法显示错误信息');
    return;
  }

  // 为每个文件元素显示错误信息
  fileElements.forEach(fileElement => {
    const fileId = fileElement.dataset.id;
    if (fileId) {
      // 移除已存在的容器（包括加载状态容器）
      const existingContainer = fileElement.parentNode.querySelector(`.${CONTAINER_CLASS}`);
      if (existingContainer) {
        existingContainer.remove();
      }

      const container = document.createElement('div');
      container.className = CONTAINER_CLASS;
      container.style.cssText = STYLES.CONTAINER;

      const errorContent = document.createElement('div');
      errorContent.style.cssText = STYLES.CONTAINER_ERROR;

      // 添加错误图标
      const errorIcon = document.createElement('span');
      errorIcon.textContent = '⚠️';
      errorIcon.style.cssText = 'font-size: 14px; flex-shrink: 0;';
      errorContent.appendChild(errorIcon);

      // 添加错误文本
      const errorText = document.createElement('span');
      errorText.textContent = message;
      errorText.style.cssText = 'font-weight: 500;';
      errorContent.appendChild(errorText);

      container.appendChild(errorContent);

      // 插入到文件元素后面
      fileElement.parentNode.insertBefore(container, fileElement.nextSibling);
    }
  });
}

/**
 * 在模组页面显示错误信息（用于单个模组页面，不是文件页面）
 * @param {string} message 错误信息
 */
function displayModPageError(message) {
  // 在页面顶部显示错误提示
  const existingError = document.querySelector('.nexus-mod-error-container');
  if (existingError) {
    existingError.remove();
  }

  const errorContainer = document.createElement('div');
  errorContainer.className = 'nexus-mod-error-container';
  errorContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #fee2e2;
    color: #dc2626;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 9999;
    font-size: 14px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #fecaca;
    max-width: 500px;
    text-align: center;
  `;

  // 添加错误图标
  const errorIcon = document.createElement('span');
  errorIcon.textContent = '⚠️';
  errorIcon.style.cssText = 'font-size: 16px; flex-shrink: 0;';
  errorContainer.appendChild(errorIcon);

  // 添加错误文本
  const errorText = document.createElement('span');
  errorText.textContent = message;
  errorContainer.appendChild(errorText);

  // 添加关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: #dc2626;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    margin-left: 8px;
    line-height: 1;
  `;
  closeButton.onclick = () => errorContainer.remove();
  errorContainer.appendChild(closeButton);

  document.body.appendChild(errorContainer);

  // 3秒后自动消失
  setTimeout(() => {
    if (errorContainer.parentNode) {
      errorContainer.remove();
    }
  }, 3000);
}

// 添加GraphQL请求监听
let isProcessing = false;

// 监听GraphQL请求
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);

  // 检查是否是目标GraphQL请求
  if (args[0] === 'https://api-router.nexusmods.com/graphql') {
    console.log('检测到GraphQL请求，当前URL:', window.location.href);
    // 检查当前是否是游戏列表页面
    const modInfo = parseNexusUrl(window.location.href);
    console.log('URL解析结果:', modInfo);
    if (modInfo && modInfo.isValid && modInfo.isGameListPage) {
      console.log(`确认是游戏列表页面，游戏: ${modInfo.gameName}`);
      // 克隆响应以便我们可以读取它
      const clone = response.clone();
      try {
        const data = await clone.json();
        console.log('GraphQL响应数据:', data);
        // 简化逻辑：如果请求成功且有数据返回，直接处理
        if (data && !isProcessing) {
          // console.log(`开始处理游戏列表页面: ${modInfo.gameName}`);
          // 设置标志位，防止重复处理
          isProcessing = true;

          // 简化处理：直接处理，不等待特定元素
          setTimeout(() => {
            // 先获取用户的URL监听设置
            chrome.storage.local.get([
              STORAGE_KEYS.GAME_LIST_URL_ENABLED
            ], (result) => {
              const gameListUrlEnabled = result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] !== undefined ? result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] : false;

              // 只在游戏列表监听开启时处理
              if (gameListUrlEnabled) {
                console.log('游戏列表监听已开启，开始处理');
                // 处理页面导航状态重置
                handlePageNavigation(modInfo.gameName);
                // 处理游戏列表页面
                handleGameListPage(modInfo.gameName);
              } else {
                console.log('游戏列表监听未开启');
              }
              // 处理完成后重置标志位
              setTimeout(() => {
                isProcessing = false;
                console.log('处理完成，重置处理状态');
              }, 1000);
            });
          }, 500); // 简单延迟500ms等待DOM更新
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
          // 处理页面导航状态重置
          handlePageNavigation(modInfo.gameName);
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
  // 每5分钟清理一次超时的计时器
  setInterval(cleanupStaleTimers, 5 * 60 * 1000);

  // 从全局缓存同步解析状态
  chrome.runtime.sendMessage({
    action: "getParsingStatus"
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('获取全局解析状态失败:', chrome.runtime.lastError.message);
    } else if (response && response.isParsingEnabled !== undefined) {
      isParsingEnabled = response.isParsingEnabled;
      // console.log('已同步全局解析状态:', isParsingEnabled ? '启用' : '暂停');
    }
  });

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
        // 处理页面导航状态重置
        handlePageNavigation(modInfo.gameName);
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

// 修改清除缓存的函数，重置计数器 - 使用新的重置逻辑
function clearParsedLinksCache() {
  parsedLinksCache.clear();
  chrome.storage.local.remove(CACHE_STORAGE_KEY);
  console.log('直链缓存已清除');

  // 重置计数器和已处理模组ID集合（移除totalMods重置）
  globalCounters.completedMods = 0;
  globalCounters.processedModIds.clear(); // 清空整个Map
  globalCounters.completedModIds.clear(); // 清空已完成模组ID集合
  globalCounters.currentGameName = null; // 重置当前游戏名称
  globalCounters.isPageInitialized = false; // 重置页面初始化状态

  // 移除现有的进度弹窗
  const existingProgress = document.querySelector('.nexus-progress-container');
  if (existingProgress) {
    existingProgress.remove();
  }

  // 如果当前是游戏列表页面，重新处理所有模组
  const modInfo = parseNexusUrl(window.location.href);
  if (modInfo && modInfo.isValid && modInfo.isGameListPage) {
    console.log('重新处理游戏列表页面');
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
          // console.log('找到文件元素，开始处理直链');
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
        if (cachedData.downloadUrls && cachedData.downloadUrls.length > 0) {
          console.log('从缓存中获取到直链');
          console.log("cachedData", cachedData);
          displayAllDirectLinks(cachedData.downloadUrls);
          return;
        }
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
        gameName: modInfo.gameName,
        isGameListPage: false // 标准模组页面
      }, (response) => {
        if (response.success && response.downloadUrls.length > 0) {
          // 保存到缓存（标准页面没有加载时间跟踪）
          const fullUrl = `https://www.nexusmods.com/${modInfo.gameName}/mods/${modInfo.modId}?tab=files`;
          saveDirectLinksToCache(modInfo.gameName, modInfo.modId, response.downloadUrls, fullUrl, null);
          displayAllDirectLinks(response.downloadUrls);
        } else {
          console.log("到这里来了3");
          // 获取直链失败，清除授权缓存
          chrome.runtime.sendMessage({ action: "clearAuthStatus" });
          // 为所有文件元素显示错误信息
          displayDirectLinkErrorForAllFiles(response.error || "无法获取到N网授权，请先登录N网账号！");
        }
      });
    } catch (error) {
      console.error('处理直链时出错:', error);
      // 发生错误时也清除授权缓存
      chrome.runtime.sendMessage({ action: "clearAuthStatus" });
      // 为所有文件元素显示错误信息
      displayDirectLinkErrorForAllFiles(error.message);
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
  headers.forEach((headerText) => {
    const th = document.createElement('th');
    th.style.cssText = STYLES.TABLE_HEADER;

    // 在操作列添加一键复制按钮
    if (headerText === '操作') {
      const headerContainer = document.createElement('div');
      headerContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      `;

      const headerText = document.createElement('span');
      headerText.textContent = '操作';
      headerContainer.appendChild(headerText);

      // 一键复制所有链接按钮
      const copyAllBtn = document.createElement('button');
      copyAllBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      `;
      copyAllBtn.title = '复制当前游戏所有缓存文件链接';

      const copyAllIcon = createIcon('static/copy-all.png', '复制所有链接');
      copyAllBtn.appendChild(copyAllIcon);

      // 悬停效果
      copyAllBtn.addEventListener('mouseenter', () => {
        copyAllBtn.style.opacity = '1';
      });
      copyAllBtn.addEventListener('mouseleave', () => {
        copyAllBtn.style.opacity = '0.7';
      });

      // 点击复制所有链接
      copyAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 收集当前游戏的所有文件链接
        const allUrls = [];
        Array.from(parsedLinksCache.entries())
          .filter(([key]) => key.startsWith(`${gameName}_`))
          .forEach(([, value]) => {
            (value.downloadUrls || []).forEach(downloadUrl => {
              allUrls.push(downloadUrl.url);
            });
          });

        if (allUrls.length === 0) {
          // 没有链接时的提示
          copyAllIcon.src = chrome.runtime.getURL('static/error.png');
          copyAllBtn.title = '没有可复制的链接';
          setTimeout(() => {
            copyAllIcon.src = chrome.runtime.getURL('static/copy-all.png');
            copyAllBtn.title = '复制当前游戏所有缓存文件链接';
          }, 1500);
          return;
        }

        // 复制所有链接（用换行符分隔）
        const allUrlsText = allUrls.join('\n');
        navigator.clipboard.writeText(allUrlsText).then(() => {
          // 成功反馈
          const originalSrc = copyAllIcon.src;
          copyAllIcon.src = chrome.runtime.getURL('static/success.png');
          copyAllBtn.title = `已复制 ${allUrls.length} 个文件链接!`;

          setTimeout(() => {
            copyAllIcon.src = originalSrc;
            copyAllBtn.title = '复制当前游戏所有缓存文件链接';
          }, 2000);
        }).catch(() => {
          // 失败反馈
          const originalSrc = copyAllIcon.src;
          copyAllIcon.src = chrome.runtime.getURL('static/error.png');
          copyAllBtn.title = '复制失败';

          setTimeout(() => {
            copyAllIcon.src = originalSrc;
            copyAllBtn.title = '复制当前游戏所有缓存文件链接';
          }, 1500);
        });
      });

      headerContainer.appendChild(copyAllBtn);
      th.appendChild(headerContainer);
    } else {
      th.textContent = headerText;
    }

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

// 添加AI分析模组相关的常量 - 专业深色系
const AI_ANALYZER = {
  BUTTON_ID: 'ai-analyze-button',
  BUTTON_TEXT: 'AI分析模组',
  BUTTON_STYLE: `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #141725 0%, #323772 100%);
        color: #ffffff;
        border: 1px solid rgba(50, 55, 114, 0.3);
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        margin-left: 10px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(20, 23, 37, 0.6), 0 2px 8px rgba(50, 55, 114, 0.2);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform: translateY(0);
        min-width: 140px;
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

// ==================== 聊天室功能初始化 ====================

// 创建聊天室图标按钮（直接在content.js中创建，避免Chrome API限制）
function createChatRoomIcon() {
  console.log('开始创建聊天室图标...');

  // 检查是否已存在
  if (document.querySelector('.nexus-chatroom-icon-btn')) {
    console.log('聊天室图标已存在，跳过创建');
    return;
  }

  // 创建聊天图标按钮
  const chatIconBtn = document.createElement('button');
  chatIconBtn.className = 'nexus-chatroom-icon-btn';

  // 创建图标图片元素
  const iconImg = document.createElement('img');
  iconImg.src = chrome.runtime.getURL('images/chatRoom.png');
  iconImg.alt = '聊天室';
  iconImg.style.cssText = `
        width: 36px;
        height: 36px;
        object-fit: contain;
        transition: all 0.3s ease;
    `;

  chatIconBtn.appendChild(iconImg);
  chatIconBtn.title = '打开聊天室';
  chatIconBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #7289da;
        color: white;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        z-index: 999998;
        border: none;
        transition: all 0.3s ease;
    `;

  // 添加悬停效果
  chatIconBtn.addEventListener('mouseenter', function () {
    this.style.backgroundColor = '#677bc4';
    this.style.transform = 'scale(1.1)';
    // 图标悬停效果
    const img = this.querySelector('img');
    if (img) {
      img.style.transform = 'scale(1.1)';
    }
  });

  chatIconBtn.addEventListener('mouseleave', function () {
    this.style.backgroundColor = '#7289da';
    this.style.transform = 'scale(1)';
    // 恢复图标大小
    const img = this.querySelector('img');
    if (img) {
      img.style.transform = 'scale(1)';
    }
  });

  // 点击事件：发送消息给background script打开新窗口
  chatIconBtn.addEventListener('click', () => {
    console.log('聊天室图标被点击，发送消息给background script');

    // 发送消息给background script打开聊天室窗口
    chrome.runtime.sendMessage({
      action: 'openChatRoomWindow'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送打开聊天室窗口消息失败:', chrome.runtime.lastError.message);
      } else if (response && response.success) {
        console.log('聊天室窗口创建成功, 窗口ID:', response.windowId);
      } else {
        console.error('聊天室窗口创建失败:', response?.error);
      }
    });
  });

  document.body.appendChild(chatIconBtn);
  console.log('✅ 聊天室图标创建成功');
}

// 初始化聊天室功能
window.initChatRoom = function initChatRoom() {
  console.log('开始初始化聊天室功能...');

  // 检查是否在Nexus Mods网站
  if (!window.location.hostname.includes('nexusmods.com')) {
    console.log('不在Nexus Mods网站，跳过聊天室初始化');
    return;
  }

  // 防止重复初始化
  if (window.nexusChatRoomInitialized) {
    console.log('聊天室已初始化，跳过重复执行');
    return;
  }

  try {
    // 直接在content.js中创建聊天图标（有Chrome API访问权限）
    createChatRoomIcon();
    window.nexusChatRoomInitialized = true;
    console.log('✅ 聊天室初始化完成');
  } catch (error) {
    console.error('聊天室初始化失败:', error);
  }
};

// 在页面加载完成后初始化聊天室
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initChatRoom);
} else {
  // DOM已经加载完成，直接初始化
  window.initChatRoom();
}

// 注意：不再需要监听popup的聊天室消息，因为我们直接在content.js中处理聊天图标点击
