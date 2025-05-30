// 常量定义
const STATUS_MESSAGES = {
  LOADING: '正在获取直链...',
  SUCCESS: '直链已生成：',
  ERROR_NOT_MOD_PAGE: '请访问 Nexus Mods 模组详情页',
  ERROR_CANNOT_GET_LINK: '无法获取直链，请确保在模组详情页'
};

// URL监听设置的本地存储键名
const STORAGE_KEYS = {
  STANDARD_URL_ENABLED: 'standardUrlEnabled',
  GAME_LIST_URL_ENABLED: 'gameListUrlEnabled',
  REQUEST_DELAY: 'requestDelay', //模组间的请求间隔时间（默认5000毫秒）
  FILE_REQUEST_DELAY: 'fileRequestDelay'//模组内文件间的请求间隔时间
};

// 页面类型常量和提示文本常量
const PAGE_TYPE = {
  DETAIL: 'detail',
  GAME_LIST: 'game_list',
  OTHER: 'other',
};
const PAGE_TIPS = {
  [PAGE_TYPE.DETAIL]: STATUS_MESSAGES.ERROR_NOT_MOD_PAGE,
  [PAGE_TYPE.GAME_LIST]: '请在游戏列表页面选择需要操作的模组',
  [PAGE_TYPE.OTHER]: '',
};

// 添加授权相关的常量
const AUTH = {
  TEST_MOD_ID: '107',
  TEST_FILE_ID: '99133',
  GAME_NAME: "cyberpunk2077",// 使用固定的游戏名称
  CACHE_KEY: 'nexusAuthStatus',
  CACHE_EXPIRATION: 30 * 60 * 1000 // 30分钟的毫秒数
};

// 刷新当前标签页
function reloadCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

// 获取 Nexus Mods 的 cookies（用 url 而不是 domain）
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

// 检查是否已登录 Nexus Mods
async function checkNexusLogin() {
  const cookies = await getNexusCookies();
  if (!cookies) return false;
  // 检查 nexusmods_session 是否存在且有值
  const sessionCookie = cookies.find(cookie => cookie.name === "nexusmods_session" && cookie.value);
  return !!sessionCookie;
}

// 保存URL监听设置到本地存储
function saveUrlSettings(standardUrlEnabled, gameListUrlEnabled) {
  chrome.storage.local.set({
    [STORAGE_KEYS.STANDARD_URL_ENABLED]: standardUrlEnabled,
    [STORAGE_KEYS.GAME_LIST_URL_ENABLED]: gameListUrlEnabled
  }, () => {
    console.log('URL监听设置已保存:', { standardUrlEnabled, gameListUrlEnabled });
    // 通知background.js更新URL监听设置
    chrome.runtime.sendMessage({
      action: "updateUrlSettings",
      settings: {
        standardUrlEnabled,
        gameListUrlEnabled
      }
    });
  });
}

// 保存高级设置到本地存储
function saveAdvancedSettings(requestDelay, fileRequestDelay) {
  chrome.storage.local.set({
    [STORAGE_KEYS.REQUEST_DELAY]: requestDelay,
    [STORAGE_KEYS.FILE_REQUEST_DELAY]: fileRequestDelay
  }, () => {
    console.log('高级设置已保存:', { requestDelay, fileRequestDelay });
  });
}

// 从本地存储加载URL监听设置
function loadUrlSettings() {
  chrome.storage.local.get([
    STORAGE_KEYS.STANDARD_URL_ENABLED,
    STORAGE_KEYS.GAME_LIST_URL_ENABLED
  ], (result) => {
    // 默认标准URL监听开启，游戏列表URL监听关闭
    const standardUrlEnabled = result[STORAGE_KEYS.STANDARD_URL_ENABLED] !== undefined
      ? result[STORAGE_KEYS.STANDARD_URL_ENABLED]
      : true;
    const gameListUrlEnabled = result[STORAGE_KEYS.GAME_LIST_URL_ENABLED] !== undefined
      ? result[STORAGE_KEYS.GAME_LIST_URL_ENABLED]
      : false;

    // 更新UI
    document.getElementById('standardUrlSwitch').checked = standardUrlEnabled;
    document.getElementById('gameListUrlSwitch').checked = gameListUrlEnabled;
  });
}

// 从本地存储加载高级设置
function loadAdvancedSettings() {
  chrome.storage.local.get([
    STORAGE_KEYS.REQUEST_DELAY,
    STORAGE_KEYS.FILE_REQUEST_DELAY
  ], (result) => {
    // 默认值：5000毫秒间隔，2000毫秒文件请求间隔
    const requestDelay = result[STORAGE_KEYS.REQUEST_DELAY] !== undefined
      ? result[STORAGE_KEYS.REQUEST_DELAY]
      : 5000;
    const fileRequestDelay = result[STORAGE_KEYS.FILE_REQUEST_DELAY] !== undefined
      ? result[STORAGE_KEYS.FILE_REQUEST_DELAY]
      : 2000;

    // 更新UI
    document.getElementById('requestDelay').value = requestDelay;
    document.getElementById('fileRequestDelay').value = fileRequestDelay;
  });
}

// 添加授权状态检查函数
async function checkAuthStatus() {
  const authStatusDiv = document.getElementById('authStatus');

  // 先检查缓存中的授权状态
  const cachedAuth = await getCachedAuthStatus();
  if (cachedAuth) {
    updateAuthStatusDisplay(authStatusDiv, true);
    return;
  }

  // 如果没有缓存或缓存已过期，进行新的授权检查
  try {
    // 发送消息给background.js获取测试下载链接
    chrome.runtime.sendMessage({
      action: "getAllDownloadUrls",
      modId: AUTH.TEST_MOD_ID,
      gameName: AUTH.GAME_NAME
    }, (response) => {
      if (response.success && response.downloadUrls && response.downloadUrls.length > 0) {
        // 授权成功，更新缓存
        saveAuthStatusToCache(true);
        updateAuthStatusDisplay(authStatusDiv, true);
      } else {
        // 授权失败，清除缓存
        clearAuthStatusCache();
        updateAuthStatusDisplay(authStatusDiv, false);
      }
    });
  } catch (error) {
    clearAuthStatusCache();
    updateAuthStatusDisplay(authStatusDiv, false);
  }
}

// 获取缓存的授权状态
function getCachedAuthStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH.CACHE_KEY], (result) => {
      if (result[AUTH.CACHE_KEY]) {
        const { isAuthorized, timestamp } = result[AUTH.CACHE_KEY];
        const now = Date.now();

        // 检查缓存是否过期
        if (now - timestamp < AUTH.CACHE_EXPIRATION) {
          resolve(isAuthorized);
        } else {
          // 缓存已过期，清除它
          clearAuthStatusCache();
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

// 保存授权状态到缓存
function saveAuthStatusToCache(isAuthorized) {
  chrome.storage.local.set({
    [AUTH.CACHE_KEY]: {
      isAuthorized,
      timestamp: Date.now()
    }
  });
}

// 清除授权状态缓存
function clearAuthStatusCache() {
  chrome.storage.local.remove(AUTH.CACHE_KEY);
}

// 更新授权状态显示
function updateAuthStatusDisplay(authStatusDiv, isAuthorized) {
  if (isAuthorized) {
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

// 页面类型判断函数
function getCurrentPageType(url) {
  if (!url || typeof url !== 'string') return PAGE_TYPE.OTHER;
  if (url.includes('nexusmods.com') && url.includes('/mods/')) {
    return PAGE_TYPE.DETAIL;
  } else if (url.includes('nexusmods.com') && url.includes('/games/')) {
    return PAGE_TYPE.GAME_LIST;
  }
  return PAGE_TYPE.OTHER;
}

// 渲染提示内容函数
function renderStatusTip(pageType, statusDiv, directLinkDiv) {
  if (pageType === PAGE_TYPE.GAME_LIST) {
    statusDiv.style.display = '';
    statusDiv.textContent = PAGE_TIPS[PAGE_TYPE.GAME_LIST];
    statusDiv.className = 'status-loading';
    if (directLinkDiv) directLinkDiv.textContent = '';
    return true;
  }
  statusDiv.style.display = 'none';
  return false;
}

// 动态插入样式
const style = document.createElement('style');
style.textContent = `
#copyAllBtnContainer {
  margin-bottom: 10px;
  text-align: right;
}
`;
document.head.appendChild(style);

// 常量定义
const API_URLS = {
  ONLINE_COUNT: 'http://117.72.89.99:7003/api/ips/count'
};

// 获取在线人数
async function getOnlineCount() {
  try {
    const response = await fetch(API_URLS.ONLINE_COUNT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (data.code === 200) {
      return data.data || 0;
    }
    return 0;
  } catch (error) {
    console.error('获取在线人数失败:', error);
    return 0;
  }
}

// 更新在线人数显示
async function updateOnlineCount() {
  const countElement = document.getElementById('onlineCount');
  if (!countElement) return;

  try {
    const count = await getOnlineCount();
    countElement.textContent = count;
  } catch (error) {
    countElement.textContent = '获取失败';
  }
}

// 定期更新在线人数
function startOnlineCountUpdate() {
  // 立即更新一次
  updateOnlineCount();

  // 每30秒更新一次
  setInterval(updateOnlineCount, 30000);
}

// 图片查看功能
function showFullImage(src) {
  const fullscreenDiv = document.querySelector('.fullscreen-image');
  const fullscreenImg = fullscreenDiv.querySelector('img');
  fullscreenImg.src = src;
  fullscreenDiv.style.display = 'flex';
}

// 初始化图片查看功能
document.addEventListener('DOMContentLoaded', function() {
  // 处理图片点击事件
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (target.classList.contains('sponsor-img') && target.dataset.action === 'show-full-image') {
      showFullImage(target.src);
    }
  });

  // 处理全屏图片点击关闭
  const fullscreenDiv = document.querySelector('.fullscreen-image');
  if (fullscreenDiv) {
    fullscreenDiv.addEventListener('click', function() {
      this.style.display = 'none';
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // 检查授权状态
  checkAuthStatus();

  // 加载URL监听设置
  loadUrlSettings();

  // 加载高级设置
  loadAdvancedSettings();

  // 添加URL监听开关事件监听
  document.getElementById('standardUrlSwitch').addEventListener('change', (e) => {
    const standardUrlEnabled = e.target.checked;
    const gameListUrlEnabled = document.getElementById('gameListUrlSwitch').checked;
    saveUrlSettings(standardUrlEnabled, gameListUrlEnabled);

    // 刷新当前标签页
    reloadCurrentTab();
  });

  document.getElementById('gameListUrlSwitch').addEventListener('change', (e) => {
    const gameListUrlEnabled = e.target.checked;

    // 如果用户尝试开启游戏列表监听，显示风险确认对话框
    if (gameListUrlEnabled) {
      const confirmed = confirm('提示：游戏列表监听功能已优化，将使用限流机制获取模组链接（默认单线程，间隔2.5秒），降低触发网站防护机制的风险。您可以在高级设置中调整参数。是否继续？');

      // 如果用户取消，则恢复开关状态并返回
      if (!confirmed) {
        e.target.checked = false;
        return;
      }
    }

    const standardUrlEnabled = document.getElementById('standardUrlSwitch').checked;
    saveUrlSettings(standardUrlEnabled, e.target.checked);

    // 刷新当前标签页
    reloadCurrentTab();
  });

  // 添加高级设置事件监听
  document.getElementById('requestDelay').addEventListener('change', (e) => {
    const requestDelay = parseInt(e.target.value);
    const fileRequestDelay = parseInt(document.getElementById('fileRequestDelay').value);
    saveAdvancedSettings(requestDelay, fileRequestDelay);
  });

  document.getElementById('fileRequestDelay').addEventListener('change', (e) => {
    const fileRequestDelay = parseInt(e.target.value);
    const requestDelay = parseInt(document.getElementById('requestDelay').value);
    saveAdvancedSettings(requestDelay, fileRequestDelay);
  });

  // 添加清除缓存按钮的点击事件
  document.getElementById('clearCacheBtn').addEventListener('click', () => {
    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 发送清除缓存消息到content script
        chrome.tabs.sendMessage(tabs[0].id, { action: "clearCache" }, (response) => {
          if (response && response.success) {
            // 显示成功提示
            const button = document.getElementById('clearCacheBtn');
            const originalText = button.textContent;
            button.textContent = '缓存已清除！';
            button.style.backgroundColor = '#28a745';
            setTimeout(() => {
              button.textContent = originalText;
              button.style.backgroundColor = '#dc3545';
            }, 2000);
          }
        });
      }
    });
  });

  const statusDiv = document.getElementById('status');
  const directLinkDiv = document.getElementById('directLink');

  // 获取当前标签页，判断页面类型
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url : '';
    const pageType = getCurrentPageType(url);
    // 如果是游戏列表页面，显示专属提示并返回
    if (renderStatusTip(pageType, statusDiv, directLinkDiv)) return;
    // 详情页逻辑不变
    if (pageType === PAGE_TYPE.DETAIL) {
      // 显示加载状态
      statusDiv.textContent = STATUS_MESSAGES.LOADING;
      statusDiv.className = 'status-loading';
      chrome.tabs.sendMessage(tabs[0].id, { action: "getDirectLink" }, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = STATUS_MESSAGES.ERROR_CANNOT_GET_LINK;
          statusDiv.className = 'status-error';
          if (directLinkDiv) directLinkDiv.textContent = '';
          return;
        }
        if (response && response.downloadUrls && response.downloadUrls.length > 0) {
          statusDiv.textContent = STATUS_MESSAGES.SUCCESS;
          statusDiv.className = 'status-success';



        } else {
          statusDiv.textContent = STATUS_MESSAGES.ERROR_CANNOT_GET_LINK;
          statusDiv.className = 'status-error';
          if (directLinkDiv) directLinkDiv.textContent = '';
        }
      });
    } else {
      // 其他页面类型
      statusDiv.textContent = PAGE_TIPS[PAGE_TYPE.OTHER];
      statusDiv.className = 'status-loading';
      if (directLinkDiv) directLinkDiv.textContent = '';
    }
  });

  // 启动在线人数更新
  startOnlineCountUpdate();

  // 添加打开AI浏览器聊天窗口的功能
  document.getElementById('openAIChatBtn').addEventListener('click', () => {
    chrome.windows.create({
      url: 'chat.html',
      type: 'popup',
      width: 1250,
      height: 1050,
      focused: true
    });
  });

  // 监听来自chat-window.js的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'closeChatWindow') {
      // 关闭发送消息的窗口
      chrome.windows.remove(sender.tab.windowId);
    }
  });
});