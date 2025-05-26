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
  MAX_CONCURRENT_REQUESTS: 'maxConcurrentRequests',
  REQUEST_DELAY: 'requestDelay'
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
function saveAdvancedSettings(maxConcurrentRequests, requestDelay) {
  chrome.storage.local.set({
    [STORAGE_KEYS.MAX_CONCURRENT_REQUESTS]: maxConcurrentRequests,
    [STORAGE_KEYS.REQUEST_DELAY]: requestDelay
  }, () => {
    console.log('高级设置已保存:', { maxConcurrentRequests, requestDelay });
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
    STORAGE_KEYS.MAX_CONCURRENT_REQUESTS, 
    STORAGE_KEYS.REQUEST_DELAY
  ], (result) => {
    // 默认值：1个并发请求，2500毫秒间隔
    const maxConcurrentRequests = result[STORAGE_KEYS.MAX_CONCURRENT_REQUESTS] !== undefined 
      ? result[STORAGE_KEYS.MAX_CONCURRENT_REQUESTS] 
      : 1;
    const requestDelay = result[STORAGE_KEYS.REQUEST_DELAY] !== undefined 
      ? result[STORAGE_KEYS.REQUEST_DELAY] 
      : 2500;
    
    // 更新UI
    document.getElementById('maxConcurrentRequests').value = maxConcurrentRequests;
    document.getElementById('requestDelay').value = requestDelay;
  });
}

// 检查授权状态
async function checkAuthStatus() {
  const authStatusDiv = document.getElementById('authStatus');
  // 获取当前激活标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url : '';
    const pageType = getCurrentPageType(url);
    if (pageType !== PAGE_TYPE.DETAIL) {
      // 非详情页，隐藏或清空授权状态区域
      authStatusDiv.className = 'auth-status';
      authStatusDiv.innerHTML = '';
      return;
    }
    // 详情页才检查授权
    if (tabs[0] && url.includes('nexusmods.com') && url.includes('/mods/')) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length < 3 || pathParts[1] !== 'mods') {
          throw new Error('URL 结构不正确');
        }
        const gameName = pathParts[0];
        const modId = pathParts[2];
        chrome.runtime.sendMessage({
          action: "getAllDownloadUrls",
          modId,
          gameName
        }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success || !response.downloadUrls || response.downloadUrls.length === 0) {
            authStatusDiv.className = 'auth-status error';
            authStatusDiv.innerHTML = `
              <img src="static/error.png" alt="未授权" class="auth-status-icon">
              <span>无法获取到N网授权，请先登录</span>
            `;
          } else {
            authStatusDiv.className = 'auth-status success';
            authStatusDiv.innerHTML = `
              <img src="static/success.png" alt="已授权" class="auth-status-icon">
              <span>已获取N网授权</span>
            `;
          }
        });
      } catch (e) {
        authStatusDiv.className = 'auth-status error';
        authStatusDiv.innerHTML = `
          <img src="static/error.png" alt="未授权" class="auth-status-icon">
          <span>无法获取到N网授权，请先登录</span>
        `;
      }
    }
  });
}

// 复制文本到剪贴板
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
};

// 只生成tbody内容
const createLinksTableBody = (downloadUrls) => {
  const fragment = document.createDocumentFragment();
  downloadUrls.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="link-cell" data-full-url="${item.url}">${item.url}</td>
      <td>
        <button class="action-button copy-button" data-url="${item.url}" title="复制链接">
          <img src="static/copy.png" alt="复制">
        </button>
        <a href="${item.url}" target="_blank" class="action-button download-button" title="下载">
          <img src="static/download.png" alt="下载">
        </a>
      </td>
    `;
    fragment.appendChild(tr);
  });
  return fragment;
};

// 创建复制全部按钮
const createCopyAllButton = (downloadUrls) => {
  const button = document.createElement('button');
  button.className = 'copy-all-button';
  button.innerHTML = `
    <img src="static/copy-all.png" alt="复制全部">
    复制全部链接
  `;
  
  button.addEventListener('click', async () => {
    const allUrls = downloadUrls.map(item => item.url).join('\n');
    const success = await copyToClipboard(allUrls);
    if (success) {
      const originalText = button.innerHTML;
      button.innerHTML = `
        <img src="static/success.png" alt="已复制">
        已复制全部
      `;
      button.style.backgroundColor = '#4caf50';
      button.style.color = 'white';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
        button.style.color = '';
      }, 1500);
    }
  });
  
  const container = document.getElementById('copyAllBtnContainer');
  if (container) {
    container.innerHTML = '';
    container.appendChild(button);
  }
};

// 创建表格
const createLinksTable = (downloadUrls) => {
  const table = document.createElement('table');
  table.className = 'links-table';
  
  // 创建表头
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="width: 25px">序号</th>
      <th>链接</th>
      <th style="width: 120px">操作</th>
    </tr>
  `;
  table.appendChild(thead);

  // 创建表体
  const tbody = document.createElement('tbody');
  downloadUrls.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="link-cell" data-full-url="${item.url}">${item.url}</td>
      <td>
        <button class="action-button copy-button" data-url="${item.url}" title="复制链接">
          <img src="static/copy.png" alt="复制">
        </button>
        <a href="${item.url}" target="_blank" class="action-button download-button" title="下载">
          <img src="static/download.png" alt="下载">
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  // 添加复制按钮事件监听
  table.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', async (e) => {
      const url = e.target.closest('.copy-button').dataset.url;
      const success = await copyToClipboard(url);
      if (success) {
        const img = e.target.closest('.copy-button').querySelector('img');
        const originalSrc = img.src;
        img.src = 'static/success.png';
        setTimeout(() => {
          img.src = originalSrc;
        }, 1500);
      }
    });
  });

  return table;
};

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
  document.getElementById('maxConcurrentRequests').addEventListener('change', (e) => {
    const maxConcurrentRequests = parseInt(e.target.value);
    const requestDelay = parseInt(document.getElementById('requestDelay').value);
    saveAdvancedSettings(maxConcurrentRequests, requestDelay);
  });
  
  document.getElementById('requestDelay').addEventListener('change', (e) => {
    const requestDelay = parseInt(e.target.value);
    const maxConcurrentRequests = parseInt(document.getElementById('maxConcurrentRequests').value);
    saveAdvancedSettings(maxConcurrentRequests, requestDelay);
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

          // 修改开始：按钮和表格都插入 directLink，按钮在上表格在下
          const directLinkContainer = document.getElementById('directLink');
          if (directLinkContainer) {
            directLinkContainer.innerHTML = '';
            // 创建并插入按钮容器
            const copyAllBtnContainer = document.createElement('div');
            copyAllBtnContainer.id = 'copyAllBtnContainer';
            directLinkContainer.appendChild(copyAllBtnContainer);
            createCopyAllButton(response.downloadUrls); // 这会把按钮插入到 copyAllBtnContainer
            // 创建并插入表格
            const tableElement = createLinksTable(response.downloadUrls);
            directLinkContainer.appendChild(tableElement);
          } else {
            console.error("无法找到ID为 'directLink' 的容器来展示表格。");
          }
          // 修改结束

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