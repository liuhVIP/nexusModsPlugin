// 常量定义
const API_URL = "https://www.nexusmods.com/Core/Libs/Common/Managers/Downloads?GenerateDownloadUrl";
const NEXUS_BASE_URL = "https://www.nexusmods.com";
const REQUEST_TIMEOUT = 10000; // 请求超时时间 10秒

// URL监听设置的本地存储键名
const STORAGE_KEYS = {
  STANDARD_URL_ENABLED: 'standardUrlEnabled',
  GAME_LIST_URL_ENABLED: 'gameListUrlEnabled',
  REQUEST_DELAY: 'requestDelay',
  FILE_REQUEST_DELAY: 'fileRequestDelay'
};

// URL监听设置默认值
let urlSettings = {
  standardUrlEnabled: true,  // 默认开启标准模组页面监听
  gameListUrlEnabled: false  // 默认关闭游戏列表页面监听
};

// 添加AI分析模组相关的常量
const AI_ANALYZER = {
    CHAT_WINDOW_URL: chrome.runtime.getURL('unified-chat.html'),
    CHAT_WINDOW_ID: 'unified-chat-window'
};

// 跟踪聊天窗口状态
let chatWindowId = null;
let isCreatingWindow = false;

// 定义模组处理队列和状态
const modProcessingQueue = [];
let isProcessingModQueue = false;
let currentProcessingContext = null; // 当前处理的上下文 {tabId, gameName, pageUrl}

// 添加结果缓存机制 - 用于存储无法立即发送的处理结果
const pendingResults = new Map(); // key: `${tabId}_${gameName}_${modId}`, value: result data

// 全局解析状态缓存 - 全局统一状态
let globalParsingStatus = {
    isParsingEnabled: true,
    lastUpdate: Date.now()
};

// 设置全局解析状态
function setGlobalParsingStatus(isParsingEnabled) {
    globalParsingStatus = {
        isParsingEnabled: isParsingEnabled,
        lastUpdate: Date.now()
    };
    console.log(`设置全局解析状态: ${isParsingEnabled ? '启用' : '暂停'}`);
}

// 获取全局解析状态
function getGlobalParsingStatus() {
    console.log(`获取全局解析状态: ${globalParsingStatus.isParsingEnabled ? '启用' : '暂停'}`);
    return globalParsingStatus.isParsingEnabled;
}

// 清理无效的队列项 - 修复版本：只清理真正无效的项
async function cleanupInvalidQueueItems() {
    const validItems = [];
    for (const item of modProcessingQueue) {
        try {
            const tab = await chrome.tabs.get(item.tabId);
            if (tab) {
                // 只要标签页存在就保留，不检查当前URL
                // 因为用户可能在不同分页间切换，但都是有效的处理请求
                validItems.push(item);
            } else {
                console.log(`清理无效队列项: 模组 ${item.modId}, 标签页不存在`);
            }
        } catch (error) {
            console.log(`清理无效队列项: 模组 ${item.modId}, 标签页检查失败`);
        }
    }

    // 清空队列并添加有效项
    modProcessingQueue.length = 0;
    modProcessingQueue.push(...validItems);

    console.log(`队列清理完成，剩余有效项: ${validItems.length}`);
}

// 添加到队列并启动处理函数 - 重新设计
function addModsToQueueAndProcess(mods) {
    console.log(`addModsToQueueAndProcess 被调用，模组数量: ${mods.length}`);
    if (mods.length === 0) {
        console.log('模组数量为0，直接返回');
        return;
    }

    // 获取新请求的上下文信息
    const newContext = {
        tabId: mods[0].tabId,
        gameName: mods[0].gameName,
        pageUrl: mods[0].pageUrl // 使用传入的页面URL
    };
    console.log(`新上下文:`, newContext);
    console.log(`当前处理状态: isProcessingModQueue=${isProcessingModQueue}`);
    console.log(`当前处理上下文:`, currentProcessingContext);

    // 简化逻辑：只要URL变化了，就全部重新开始
    if (isProcessingModQueue && currentProcessingContext) {
        const isPageChanged = currentProcessingContext.pageUrl !== newContext.pageUrl;

        console.log(`检查页面是否切换: ${isPageChanged}`);
        console.log(`旧页面URL: ${currentProcessingContext.pageUrl}`);
        console.log(`新页面URL: ${newContext.pageUrl}`);

        if (isPageChanged) {
            console.log(`检测到页面切换，全部重新开始`);
            // 清空队列并重置所有状态
            modProcessingQueue.length = 0;
            isProcessingModQueue = false;
            currentProcessingContext = null;
            console.log(`已清空队列并重置状态，队列长度: ${modProcessingQueue.length}`);
        }
    }

    // 更新当前处理上下文
    currentProcessingContext = newContext;
    console.log(`更新当前处理上下文:`, currentProcessingContext);

    // 添加新模组到队列
    modProcessingQueue.push(...mods);
    console.log(`添加 ${mods.length} 个模组到队列，当前队列长度: ${modProcessingQueue.length}`);

    if (!isProcessingModQueue) {
        console.log(`开始处理队列，调用 processNextModInQueue()`);
        processNextModInQueue();
    } else {
        console.log(`队列正在处理中，等待当前处理完成`);
    }
}

// 处理队列中的下一个模组
async function processNextModInQueue() {
    console.log(`processNextModInQueue 被调用，当前队列长度: ${modProcessingQueue.length}`);

    // 在处理前清理无效的队列项
    await cleanupInvalidQueueItems();

    if (modProcessingQueue.length === 0) {
        isProcessingModQueue = false;
        currentProcessingContext = null;
        console.log("所有游戏列表模组处理完毕。");
        return;
    }

    isProcessingModQueue = true;
    const currentMod = modProcessingQueue.shift(); // 取出队列中的第一个模组
    console.log(`开始处理队列中的模组: ${currentMod.modId}, 游戏: ${currentMod.gameName}, 标签页: ${currentMod.tabId}`);

    // 简化验证：只检查标签页是否还存在
    try {
        const tab = await chrome.tabs.get(currentMod.tabId);
        if (!tab) {
            console.log(`标签页不存在，停止处理队列`);
            modProcessingQueue.length = 0;
            isProcessingModQueue = false;
            currentProcessingContext = null;
            return;
        }
        console.log(`标签页存在，继续处理模组 ${currentMod.modId}`);
    } catch (error) {
        console.log(`标签页检查失败，停止处理队列:`, error.message);
        modProcessingQueue.length = 0;
        isProcessingModQueue = false;
        currentProcessingContext = null;
        return;
    }

    console.log(`开始处理模组: ${currentMod.modId}`);

    // 检查全局暂停状态
    const isParsingEnabled = getGlobalParsingStatus();
    if (!isParsingEnabled) {
        console.log(`模组 ${currentMod.modId} 处理被全局暂停，跳过处理`);
        // 继续处理下一个模组
        setTimeout(() => processNextModInQueue(), 1000);
        return;
    }

    // 从本地存储获取高级设置
    const settings = await new Promise(resolve => {
        chrome.storage.local.get([
            STORAGE_KEYS.REQUEST_DELAY,
            STORAGE_KEYS.FILE_REQUEST_DELAY
        ], resolve);
    });
    // 模组内文件间的延迟 (DELAY_BETWEEN_MOD_FILES)：在获取一个模组的多个文件下载链接时，每个文件链接的获取之间也会等待 FILE_REQUEST_DELAY（默认2秒）。
    const DELAY_BETWEEN_MOD_FILES = settings[STORAGE_KEYS.FILE_REQUEST_DELAY] !== undefined ?
        settings[STORAGE_KEYS.FILE_REQUEST_DELAY] : 2000;
    // 模组间的延迟 (DELAY_BETWEEN_MODS)：在处理完一个模组后，会等待 REQUEST_DELAY（默认5秒）再处理下一个模组。
    const DELAY_BETWEEN_MODS = settings[STORAGE_KEYS.REQUEST_DELAY] !== undefined ?
        settings[STORAGE_KEYS.REQUEST_DELAY] : 5000;

    try {
        const cookies = await getNexusCookies();
        const cookieString = formatCookies(cookies);

        // 获取下载链接
        const downloadUrls = await getAllDownloadUrls(
            currentMod.modId,
            currentMod.gameName,
            cookieString,
            true, // 强制视为游戏列表页
            DELAY_BETWEEN_MOD_FILES
        );

        // 将结果发送回 content.js - 改进的消息发送逻辑
        const sendMessage = async (retryCount = 0) => {
            try {
                // 首先检查标签页是否仍然存在
                const tab = await chrome.tabs.get(currentMod.tabId);
                if (!tab) {
                    console.log(`标签页 ${currentMod.tabId} 不存在，跳过模组 ${currentMod.modId}`);
                    return;
                }

                chrome.tabs.sendMessage(currentMod.tabId, {
                    action: 'updateModTileLinks',
                    modId: currentMod.modId,
                    gameName: currentMod.gameName,
                    downloadUrls: downloadUrls,
                    fullUrl: `https://www.nexusmods.com/${currentMod.gameName}/mods/${currentMod.modId}?tab=files`
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(`发送更新消息失败 (尝试 ${retryCount + 1}):`, chrome.runtime.lastError.message);
                        // 如果是连接错误，说明当前页面可能不是目标页面，但不要放弃
                        if (retryCount < 2 && chrome.runtime.lastError.message.includes('Could not establish connection')) {
                            // 延长重试间隔，给用户切换回正确页面的时间
                            setTimeout(() => sendMessage(retryCount + 1), 3000);
                        } else {
                            console.log(`模组 ${currentMod.modId} 消息发送最终失败，可能页面已切换`);
                            // 不再保存到缓存，因为我们只处理当前页面
                        }
                    } else {
                        console.log(`模组 ${currentMod.modId} 更新消息发送成功`);
                    }
                });
            } catch (error) {
                console.log(`标签页 ${currentMod.tabId} 检查失败，可能已关闭:`, error.message);
                return;
            }
        };
        await sendMessage();

    } catch (error) {
        console.error(`处理模组 ${currentMod.modId} 失败:`, error);
        // 发送错误消息回 content.js - 添加标签页检查和错误处理
        const sendErrorMessage = async (retryCount = 0) => {
            try {
                // 首先检查标签页是否仍然存在
                const tab = await chrome.tabs.get(currentMod.tabId);
                if (!tab) {
                    console.log(`标签页 ${currentMod.tabId} 不存在，跳过错误消息发送`);
                    return;
                }

                // 不再检查URL，直接发送错误消息
                // 因为我们已经在addModsToQueueAndProcess中处理了页面切换

                chrome.tabs.sendMessage(currentMod.tabId, {
                    action: 'updateModTileError',
                    modId: currentMod.modId,
                    gameName: currentMod.gameName,
                    error: error.message
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(`发送错误消息失败 (尝试 ${retryCount + 1}):`, chrome.runtime.lastError.message);
                        // 如果是连接错误且重试次数少于3次，则重试
                        if (retryCount < 2 && chrome.runtime.lastError.message.includes('Could not establish connection')) {
                            setTimeout(() => sendErrorMessage(retryCount + 1), 1000);
                        } else {
                            console.log(`模组 ${currentMod.modId} 错误消息发送最终失败，可能页面已切换`);
                        }
                    } else {
                        console.log(`模组 ${currentMod.modId} 错误消息发送成功`);
                    }
                });
            } catch (error) {
                console.log(`标签页 ${currentMod.tabId} 检查失败，可能已关闭:`, error.message);
                return;
            }
        };
        await sendErrorMessage();
    } finally {
        // 等待一定时间再处理下一个模组
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MODS));
        // 继续处理队列中的下一个模组
        processNextModInQueue();
    }
}

// 带超时控制的fetch请求工具函数
async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`请求超时（${timeout}ms）`);
    }
    throw error;
  }
}

// 初始化加载URL监听设置
function loadUrlSettings() {
  chrome.storage.local.get([
    STORAGE_KEYS.STANDARD_URL_ENABLED,
    STORAGE_KEYS.GAME_LIST_URL_ENABLED
  ], (result) => {
    urlSettings.standardUrlEnabled = result[STORAGE_KEYS.STANDARD_URL_ENABLED] !== undefined
      ? result[STORAGE_KEYS.STANDARD_URL_ENABLED]
      : true;
    urlSettings.gameListUrlEnabled = result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] !== undefined
      ? result[STORAGE_KEYS.GAME_LIST_URL_ENABLED]
      : false;
    console.log('已加载URL监听设置:', urlSettings);
  });
}

// 初始化时加载设置
loadUrlSettings();

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes[STORAGE_KEYS.STANDARD_URL_ENABLED]) {
      urlSettings.standardUrlEnabled = changes[STORAGE_KEYS.STANDARD_URL_ENABLED].newValue;
    }
    if (changes[STORAGE_KEYS.GAME_LIST_URL_ENABLED]) {
      urlSettings.gameListUrlEnabled = changes[STORAGE_KEYS.GAME_LIST_URL_ENABLED].newValue;
    }
    console.log('URL监听设置已更新:', urlSettings);
  }
});

// 获取 Nexus Mods 的 cookies
async function getNexusCookies() {
  try {
    const cookies = await chrome.cookies.getAll({
      url: "https://www.nexusmods.com"
    });
    return cookies;
  } catch (error) {
    console.error("获取 cookies 失败:", error);
    return null;
  }
}

// 将 cookies 对象转换为字符串
function formatCookies(cookies) {
  if (!cookies) return '';
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// 检查是否已登录 Nexus Mods
async function checkNexusLogin() {
  const cookies = await getNexusCookies();
  if (!cookies) return false;

  // 检查 nexusmods_session 是否存在且有值
  const sessionCookie = cookies.find(cookie => cookie.name === "nexusmods_session" && cookie.value);
  return !!sessionCookie;
}

// 将 getAllDownloadUrls 函数移到消息监听器外部，但在其他函数之前
async function getAllDownloadUrls(modId, gameName, cookies, isGameListPage = false, fileDelay = 0) {
  console.log(`正在获取游戏 ${gameName} 模组 ${modId} 的下载链接...`);
    try {
        const url = `${NEXUS_BASE_URL}/${gameName}/mods/${modId}?tab=files`;
        const response = await fetchWithTimeout(url, {
            headers: { 'Cookie': cookies }
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const html = await response.text();
        const gameIdMatch = html.match(/game_id=(\d+)/);
        if (!gameIdMatch) {
            throw new Error('无法获取game_id');
        }
        const gameId = gameIdMatch[1];

        const fileIds = [];
        const fileElements = html.match(/data-id="(\d+)"/g) || [];
        for (const element of fileElements) {
            const fileId = element.match(/data-id="(\d+)"/)[1];
            if (!fileIds.includes(fileId)) {
                fileIds.push(fileId);
            }
        }

        if (fileIds.length === 0) {
            throw new Error('未找到任何文件ID');
        }

        const downloadUrls = [];
        for (const fileId of fileIds) {
            try {
                // 如果设置了文件延迟，在这里等待
                if (fileDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, fileDelay));
                }

                const data = new URLSearchParams();
                data.append('fid', fileId);
                data.append('game_id', gameId);

                const downloadResponse = await fetchWithTimeout(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cookie': cookies
                    },
                    body: data
                });

                if (!downloadResponse.ok) {
                    console.error(`获取文件 ${fileId} 的下载链接失败: ${downloadResponse.status}`);
                    continue;
                }

                const downloadData = await downloadResponse.json();
                if (downloadData && downloadData.url) {
                    downloadUrls.push({ fileId, url: downloadData.url });
                }
            } catch (error) {
                console.error(`处理文件 ${fileId} 时发生错误:`, error);
            }
        }

        return downloadUrls;
    } catch (error) {
        console.error('获取下载链接时发生错误:', error);
        throw error;
    }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理聊天室窗口打开请求
  if (request.action === 'openChatRoomWindow') {
    console.log('收到打开聊天室窗口的请求');

    // 检查是否已经有统一聊天窗口
    if (chatWindowId) {
      chrome.windows.get(chatWindowId, (window) => {
        if (chrome.runtime.lastError) {
          // 如果窗口不存在，重置chatWindowId并创建新窗口
          chatWindowId = null;
          createUnifiedChatWindow('chatroom');
        } else {
          // 激活现有窗口并切换到聊天室标签
          chrome.windows.update(chatWindowId, { focused: true }, () => {
            chrome.tabs.query({ windowId: chatWindowId }, (tabs) => {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'switchToChatroom'
                });
              }
            });
          });
          sendResponse({ success: true, windowId: chatWindowId });
        }
      });
    } else {
      // 创建新的统一聊天窗口，默认显示聊天室
      createUnifiedChatWindow('chatroom');
      sendResponse({ success: true, windowId: null }); // 窗口ID将在创建后设置
    }

    return true; // 表示异步响应
  }

  if (request.action === "checkLogin") {
    checkNexusLogin().then(isLoggedIn => {
      sendResponse({ isLoggedIn });
    });
    return true; // 保持消息通道开放
  }

  // 处理URL监听设置更新
  if (request.action === "updateUrlSettings") {
    urlSettings = request.settings;
    console.log('URL监听设置已更新:', urlSettings);
    sendResponse({ success: true });
    return true;
  }

  // 处理 getAllDownloadUrls 请求
  if (request.action === "getAllDownloadUrls") {
    const { modId, gameName, isGameListPage } = request;

    // 使用动态获取的 cookies
    getNexusCookies().then(cookies => {
      const cookieString = formatCookies(cookies);
      getAllDownloadUrls(modId, gameName, cookieString, isGameListPage)
        .then(downloadUrls => {
          sendResponse({ success: true, downloadUrls });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    }).catch(error => {
      sendResponse({ success: false, error: "获取 cookies 失败" });
    });

    return true; // 表示异步响应
  }

  // 处理 AI 分析器脚本注入请求
  if (request.action === 'injectAIAnalyzer') {
    // 注入 AI 分析器脚本
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ['ai-mod-analyzer.js']
    }).then(() => {
      // console.log('AI分析器脚本注入成功');
      // 通知 content script 脚本已注入
      chrome.tabs.sendMessage(sender.tab.id, { action: 'aiAnalyzerInjected' });
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('AI分析器脚本注入失败:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  }



  // 处理 AI 聊天相关消息
  if (request.action === 'openAIChat') {
    // 如果正在创建窗口，直接返回
    if (isCreatingWindow) {
      console.log('正在创建窗口，请稍候...');
      sendResponse({ success: false, message: '正在创建窗口，请稍候...' });
      return true;
    }

    // 如果已经有统一聊天窗口，直接激活它
    if (chatWindowId) {
      chrome.windows.get(chatWindowId, (window) => {
        if (chrome.runtime.lastError) {
          // 如果窗口不存在，重置chatWindowId并创建新窗口
          chatWindowId = null;
          createUnifiedChatWindow('ai-chat', request.modData);
        } else {
          // 激活现有窗口并切换到AI聊天标签
          chrome.windows.update(chatWindowId, { focused: true }, () => {
            // 向聊天窗口发送初始化消息
            chrome.tabs.query({ windowId: chatWindowId }, (tabs) => {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'initAIChat',
                  modData: request.modData
                });
              }
            });
          });
        }
      });
    } else {
      // 创建新的统一聊天窗口，默认显示AI聊天
      createUnifiedChatWindow('ai-chat', request.modData);
    }
    sendResponse({ success: true });
    return true; // 保持消息通道开放
  }

  // 处理清除授权状态
  if (request.action === "clearAuthStatus") {
    chrome.storage.local.remove('nexusAuthStatus');
    sendResponse({ success: true });
    return true;
  }

  // 处理测试消息
  if (request.action === "test") {
    console.log('收到测试消息，发送方标签页ID:', sender.tab.id);
    sendResponse({ success: true, message: "测试消息收到" });
    return true;
  }

  // 处理健康检查消息
  if (request.action === "healthCheck") {
    console.log('收到健康检查消息，发送方标签页ID:', sender.tab ? sender.tab.id : '未知');
    sendResponse({ success: true, message: "扩展健康" });
    return true;
  }

  // 处理解析状态更新消息
  if (request.action === "updateParsingStatus") {
    setGlobalParsingStatus(request.isParsingEnabled);
    sendResponse({ success: true });
    return true;
  }

  // 处理获取解析状态消息
  if (request.action === "getParsingStatus") {
    sendResponse({ isParsingEnabled: getGlobalParsingStatus() });
    return true;
  }

  // 处理游戏列表模组处理请求 - 这是关键的修复
  if (request.action === "processGameListMods") {
    console.log('收到游戏列表模组处理请求，模组数量:', request.mods.length);
    console.log('发送方标签页ID:', sender.tab.id);
    console.log('当前页面URL:', request.currentPageUrl);
    console.log('模组列表:', request.mods);
    // 需要记录发送请求的tabId和页面URL
    const modsWithTabId = request.mods.map(mod => ({
      ...mod,
      tabId: sender.tab.id,
      pageUrl: request.currentPageUrl // 添加页面URL
    }));
    console.log('添加标签页ID和页面URL后的模组列表:', modsWithTabId);
    addModsToQueueAndProcess(modsWithTabId);
    sendResponse({ success: true });
    return true;
  }


});

// 解析URL获取mod信息 - 移到全局作用域
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

    // 处理游戏列表页面URL格式 - 修复：与content.js保持一致
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

// 监听标签页更新 - 移到全局作用域
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const modInfo = parseNexusUrl(tab.url);
    if (modInfo && modInfo.isValid) {
      // 根据URL类型和用户设置决定是否发送消息
      let shouldSendMessage = false;

      if (modInfo.isStandardModPage && urlSettings.standardUrlEnabled) {
        shouldSendMessage = true;
      } else if (modInfo.isGameListPage && urlSettings.gameListUrlEnabled) {
        shouldSendMessage = true;
      }

      if (shouldSendMessage) {
        // 发送消息到content script
        chrome.tabs.sendMessage(tabId, {
          action: 'modUrlDetected',
          modInfo: modInfo
        });
      }
    }
  }
});

// 监听窗口关闭事件
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === chatWindowId) {
    chatWindowId = null;
    // 通知所有标签页窗口已关闭
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'chatWindowClosed' }).catch(() => {
          // 忽略发送失败的错误（可能标签页没有我们的content script）
        });
      });
    });
  }
});

// 添加快捷键处理
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-parsing") {
    // 切换全局解析状态
    const newStatus = !globalParsingStatus.isParsingEnabled;
    setGlobalParsingStatus(newStatus);

    // 向所有Nexus标签页广播状态变化
    chrome.tabs.query({ url: "*://*.nexusmods.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "toggleParsing",
          globalStatus: newStatus
        }, (response) => {
          // 忽略错误，因为有些标签页可能没有content script
          if (chrome.runtime.lastError) {
            console.log(`向标签页 ${tab.id} 发送状态更新失败:`, chrome.runtime.lastError.message);
          }
        });
      });
    });
  }
});

// 全局状态不需要清理逻辑

// 添加网络请求监听器
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // 检查是否是退出登录的URL
    if (details.url === 'https://users.nexusmods.com/auth/sign_out') {
      console.log('检测到用户退出登录');
      // 清除授权缓存
      chrome.storage.local.remove('nexusAuthStatus');

      // 通知所有打开的标签页更新授权状态
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url.includes('nexusmods.com')) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'authStatusChanged',
              isAuthorized: false
            }).catch(() => {
              // 忽略发送失败的错误（可能标签页没有我们的content script）
            });
          }
        });
      });
    }
  },
  {
    urls: ['https://users.nexusmods.com/auth/sign_out']
  }
);

// 创建新的统一聊天窗口的函数
function createUnifiedChatWindow(defaultTab = 'ai-chat', modData = null) {
  // 设置创建标志
  isCreatingWindow = true;

  // 先检查是否已经存在统一聊天窗口
  chrome.windows.getAll({ populate: true }, (windows) => {
    let existingWindow = null;

    // 查找已存在的统一聊天窗口
    for (const window of windows) {
      for (const tab of window.tabs) {
        if (tab.url === AI_ANALYZER.CHAT_WINDOW_URL) {
          existingWindow = window;
          break;
        }
      }
      if (existingWindow) break;
    }

    if (existingWindow) {
      // 如果找到已存在的窗口，激活它
      chatWindowId = existingWindow.id;
      chrome.windows.update(existingWindow.id, { focused: true }, () => {
        // 向统一聊天窗口发送消息
        chrome.tabs.query({ windowId: existingWindow.id }, (tabs) => {
          if (tabs[0]) {
            if (defaultTab === 'ai-chat' && modData) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'initAIChat',
                modData: modData
              });
            } else if (defaultTab === 'chatroom') {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'switchToChatroom'
              });
            }
          }
        });
      });
    } else {
      // 创建新的统一聊天窗口
      chrome.windows.create({
        url: AI_ANALYZER.CHAT_WINDOW_URL,
        type: 'popup',
        width: 1250,
        height: 1150,
        focused: true
      }, (window) => {
        chatWindowId = window.id;
        // 等待窗口创建完成后发送初始化消息
        setTimeout(() => {
          chrome.tabs.query({ windowId: window.id }, (tabs) => {
            if (tabs[0]) {
              if (defaultTab === 'ai-chat' && modData) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'initAIChat',
                  modData: modData
                });
              } else if (defaultTab === 'chatroom') {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'switchToChatroom'
                });
              }
            }
          });
        }, 1000); // 等待1秒确保页面加载完成
      });
    }

    // 重置创建标志
    setTimeout(() => {
      isCreatingWindow = false;
    }, 2000); // 给足够的时间完成窗口创建
  });
}