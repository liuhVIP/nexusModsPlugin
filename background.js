// 常量定义
const API_URL = "https://www.nexusmods.com/Core/Libs/Common/Managers/Downloads?GenerateDownloadUrl";
const NEXUS_BASE_URL = "https://www.nexusmods.com";

// URL监听设置的本地存储键名
const STORAGE_KEYS = {
  STANDARD_URL_ENABLED: 'standardUrlEnabled',
  GAME_LIST_URL_ENABLED: 'gameListUrlEnabled'
};

// URL监听设置默认值
let urlSettings = {
  standardUrlEnabled: true,  // 默认开启标准模组页面监听
  gameListUrlEnabled: false  // 默认关闭游戏列表页面监听
};

// 添加AI分析模组相关的常量
const AI_ANALYZER = {
    CHAT_WINDOW_URL: chrome.runtime.getURL('chat.html'),
    CHAT_WINDOW_ID: 'ai-chat-window'
};

// 跟踪聊天窗口状态
let chatWindowId = null;
let isCreatingWindow = false;

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

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

  // 解析URL获取mod信息
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
      if (pathParts.length >= 3 && pathParts[0] === 'games') {
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

  // 获取所有文件的下载链接
  async function getAllDownloadUrls(modId, gameName, cookies) {
    try {
      const url = `${NEXUS_BASE_URL}/${gameName}/mods/${modId}?tab=files`;
      const response = await fetch(url, {
        headers: {
          'Cookie': cookies
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP错误! 状态码: ${response.status}`);
      }

      const html = await response.text();
      
      // 解析game_id
      const gameIdMatch = html.match(/game_id=(\d+)/);
      if (!gameIdMatch) {
        throw new Error('无法获取game_id');
      }
      const gameId = gameIdMatch[1];

      // 获取所有文件ID
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

      // 获取每个文件的下载链接
      const downloadUrls = [];
      for (const fileId of fileIds) {
        try {
          const data = new URLSearchParams();
          data.append('fid', fileId);
          data.append('game_id', gameId);

          const downloadResponse = await fetch(API_URL, {
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
            downloadUrls.push({
              fileId,
              url: downloadData.url
            });
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

  // 监听标签页更新
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

  // 监听来自content script的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAllDownloadUrls") {
      const { modId, gameName } = request;
      
      // 使用动态获取的 cookies
      getNexusCookies().then(cookies => {
        const cookieString = formatCookies(cookies);
        getAllDownloadUrls(modId, gameName, cookieString)
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

    if (request.action === 'openAIChat') {
      // 如果正在创建窗口，直接返回
      if (isCreatingWindow) {
        console.log('正在创建窗口，请稍候...');
        sendResponse({ success: false, message: '正在创建窗口，请稍候...' });
        return true;
      }

      // 如果已经有聊天窗口，直接激活它
      if (chatWindowId) {
        chrome.windows.get(chatWindowId, (window) => {
          if (chrome.runtime.lastError) {
            // 如果窗口不存在，重置chatWindowId并创建新窗口
            chatWindowId = null;
            createNewChatWindow(request.modData);
          } else {
            // 激活现有窗口
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
        // 创建新窗口
        createNewChatWindow(request.modData);
      }
      sendResponse({ success: true });
      return true; // 保持消息通道开放
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
      // 获取当前激活的标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes('nexusmods.com')) {
          // 向content script发送切换解析状态的消息
          chrome.tabs.sendMessage(tabs[0].id, { action: "toggleParsing" });
        }
      });
    }
  });
});

// 创建新聊天窗口的函数
function createNewChatWindow(modData) {
  // 设置创建标志
  isCreatingWindow = true;

  // 先检查是否已经存在聊天窗口
  chrome.windows.getAll({ populate: true }, (windows) => {
    let existingWindow = null;
    
    // 查找已存在的聊天窗口
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
        // 向聊天窗口发送初始化消息
        chrome.tabs.query({ windowId: existingWindow.id }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'initAIChat',
              modData: modData
            });
          }
        });
      });
    } else {
      // 创建新窗口
      chrome.windows.create({
        url: AI_ANALYZER.CHAT_WINDOW_URL,
        type: 'popup',
        width: 1250,
        height: 1050,
        focused: true
      }, (window) => {
        chatWindowId = window.id;
        // 等待窗口创建完成后发送初始化消息
        setTimeout(() => {
          chrome.tabs.query({ windowId: window.id }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'initAIChat',
                modData: modData
              });
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