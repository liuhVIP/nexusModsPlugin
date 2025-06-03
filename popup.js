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
  FILE_REQUEST_DELAY: 'fileRequestDelay',//模组内文件间的请求间隔时间
  // 版本校验相关设置
  VERSION_CHECK_CACHE: 'versionCheckCache',
  VERSION_CHECK_LAST_TIME: 'versionCheckLastTime',
  VERSION_MISMATCH_NOTIFIED: 'versionMismatchNotified'
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

// 动态插入样式 - 优化复制按钮容器样式
const style = document.createElement('style');
style.textContent = `
#copyAllBtnContainer {
  margin-bottom: 12px;
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

  // 检查版本状态
  checkVersionStatus();

  // 加载URL监听设置
  loadUrlSettings();

  // 加载高级设置
  loadAdvancedSettings();

  // 加载自动投票评分设置
  loadAutoVoteEndorseSettings();

  // 加载自动投票评分统计
  loadAutoVoteEndorseStats();

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
      const confirmed = confirm('提示：开启此项功能后，会监听N网游戏列表页，并自动获取mod直链，请谨慎开启，太多的请求会导致N网风控，虽然我已经做了非常非常多的优化了(大概率不会了)，但是如果还是频繁被封请关闭此项功能，或者自己挂电脑代理');

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

  // 添加自动投票评分开关事件监听
  document.getElementById('autoVoteSwitch').addEventListener('change', (e) => {
    const autoVoteEnabled = e.target.checked;
    const autoEndorseEnabled = document.getElementById('autoEndorseSwitch').checked;
    saveAutoVoteEndorseSettings(autoVoteEnabled, autoEndorseEnabled);
  });

  document.getElementById('autoEndorseSwitch').addEventListener('change', (e) => {
    const autoEndorseEnabled = e.target.checked;
    const autoVoteEnabled = document.getElementById('autoVoteSwitch').checked;
    saveAutoVoteEndorseSettings(autoVoteEnabled, autoEndorseEnabled);
  });

  // 添加刷新统计按钮事件监听
  document.getElementById('refreshStatsBtn').addEventListener('click', () => {
    loadAutoVoteEndorseStats();
  });

  // 添加清除缓存按钮的点击事件 - 优化反馈效果
  document.getElementById('clearCacheBtn').addEventListener('click', () => {
    const button = document.getElementById('clearCacheBtn');
    const originalText = button.textContent;

    // 显示加载状态
    button.textContent = '🔄 清除中...';
    button.disabled = true;

    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 发送清除缓存消息到content script
        chrome.tabs.sendMessage(tabs[0].id, { action: "clearCache" }, (response) => {
          if (response && response.success) {
            // 显示成功提示
            button.textContent = '✅ 缓存已清除！';
            button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)';
            setTimeout(() => {
              button.textContent = originalText;
              button.style.background = '';
              button.disabled = false;
            }, 2000);
          } else {
            // 显示错误提示
            button.textContent = '❌ 清除失败';
            setTimeout(() => {
              button.textContent = originalText;
              button.disabled = false;
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
      url: 'unified-chat.html',
      type: 'popup',
      width: 1250,
      height: 1050,
      focused: true
    });
  });

  // 聊天室按钮事件
  const openChatRoomBtn = document.getElementById('openChatRoomBtn');
  if (openChatRoomBtn) {
    openChatRoomBtn.addEventListener('click', () => {
      // 获取当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes('nexusmods.com')) {
          // 向当前标签页发送打开聊天室的消息
          chrome.tabs.sendMessage(tabs[0].id, { action: 'openChatRoom' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('发送聊天室消息失败:', chrome.runtime.lastError.message);
              // 如果当前页面没有聊天室功能，提示用户
              alert('聊天室功能正在初始化中，请稍后再试或刷新页面');
            } else if (response && response.success) {
              // 成功打开聊天室，关闭popup
              window.close();
            } else {
              // 响应失败
              const errorMsg = response && response.error ? response.error : '聊天室功能暂时不可用';
              alert(errorMsg);
            }
          });
        } else {
          alert('聊天室功能已移至页面右下角的聊天图标 💬，请在Nexus Mods页面点击该图标打开聊天室');
        }
      });
    });
  }

  // 监听来自chat-window.js的消息
  chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'closeChatWindow') {
      // 关闭发送消息的窗口
      chrome.windows.remove(sender.tab.windowId);
    }
  });
});

// 版本校验相关函数

/**
 * 检查版本状态
 * @param {boolean} forceCheck 是否强制检查
 */
async function checkVersionStatus(forceCheck = false) {
  try {
    console.log('🔍 开始版本状态检查, 强制检查:', forceCheck);

    // 显示加载状态
    updateVersionStatusDisplay(null);

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: forceCheck ? "checkVersion" : "getVersionStatus",
        forceCheck: forceCheck
      }, (response) => {
        console.log('📨 收到版本检查响应:', response);
        resolve(response);
      });
    });

    if (response && response.success) {
      console.log('✅ 版本检查成功:', response.versionResult);
      updateVersionStatusDisplay(response.versionResult);
    } else {
      console.error('❌ 版本校验失败:', response?.error || '未知错误');
      updateVersionStatusDisplay(null, response?.error || '版本检查失败');
    }
  } catch (error) {
    console.error('💥 版本校验请求异常:', error);
    updateVersionStatusDisplay(null, error.message);
  }
}

/**
 * 更新版本状态显示 - 简洁版本
 * @param {Object} versionResult 版本校验结果
 * @param {string} error 错误信息
 */
function updateVersionStatusDisplay(versionResult, error = null) {
  const versionStatusDiv = document.getElementById('versionStatus');
  if (!versionStatusDiv) return;

  const versionTextSpan = versionStatusDiv.querySelector('.version-status-text');
  if (!versionTextSpan) return;

  if (error) {
    // 显示错误状态
    versionStatusDiv.className = 'version-status-compact error';
    versionTextSpan.textContent = `❌ 版本检查失败: ${error}`;
  } else if (!versionResult) {
    // 显示加载状态
    versionStatusDiv.className = 'version-status-compact loading';
    versionTextSpan.textContent = '🔍 正在检查版本...';
  } else if (versionResult.needsUpdate) {
    // 显示需要更新状态
    versionStatusDiv.className = 'version-status-compact warning';
    versionTextSpan.innerHTML = `发现新版本 ${versionResult.currentVersion} → ${versionResult.serverVersion}`;

    // 如果有更新链接，添加点击事件
    if (versionResult.systemConfig?.sysUrl) {
      versionTextSpan.style.cursor = 'pointer';
      versionTextSpan.title = '点击前往更新页面';
      versionTextSpan.onclick = () => {
        window.open(versionResult.systemConfig.sysUrl, '_blank');
      };
    }
  } else {
    // 显示版本正常状态
    versionStatusDiv.className = 'version-status-compact success';
    versionTextSpan.textContent = `版本正常${versionResult.currentVersion}`;
    versionTextSpan.style.cursor = 'default';
    versionTextSpan.onclick = null;
    versionTextSpan.title = '';
  }

  // 重新绑定刷新按钮点击事件
  const checkBtn = versionStatusDiv.querySelector('#versionCheckBtn');
  if (checkBtn) {
    // 移除旧的事件监听器
    checkBtn.replaceWith(checkBtn.cloneNode(true));
    const newCheckBtn = versionStatusDiv.querySelector('#versionCheckBtn');

    newCheckBtn.addEventListener('click', () => {
      console.log('🔄 手动检查版本更新');
      checkVersionStatus(true);
    });
  }
}

/**
 * 手动检查版本更新
 */
function manualCheckVersion() {
  checkVersionStatus(true);
}

// 自动投票评分相关函数

// 加载自动投票评分设置
function loadAutoVoteEndorseSettings() {
  chrome.storage.local.get(['autoVoteEnabled', 'autoEndorseEnabled'], (result) => {
    const autoVoteSwitch = document.getElementById('autoVoteSwitch');
    const autoEndorseSwitch = document.getElementById('autoEndorseSwitch');

    const autoVoteEnabled = result.autoVoteEnabled || false;
    const autoEndorseEnabled = result.autoEndorseEnabled || false;

    if (autoVoteSwitch) {
      autoVoteSwitch.checked = autoVoteEnabled;
    }
    if (autoEndorseSwitch) {
      autoEndorseSwitch.checked = autoEndorseEnabled;
    }

    // 更新统计区域的显示状态
    updateAutoVoteEndorseStatsDisplay(autoVoteEnabled, autoEndorseEnabled);

    console.log('自动投票评分设置已加载:', result);
  });
}

// 保存自动投票评分设置
function saveAutoVoteEndorseSettings(autoVoteEnabled, autoEndorseEnabled) {
  // 保存到本地存储
  chrome.storage.local.set({
    autoVoteEnabled: autoVoteEnabled,
    autoEndorseEnabled: autoEndorseEnabled
  });

  // 更新统计区域的显示状态
  updateAutoVoteEndorseStatsDisplay(autoVoteEnabled, autoEndorseEnabled);

  // 发送消息到background.js更新设置
  chrome.runtime.sendMessage({
    action: 'updateAutoVoteEndorseSettings',
    autoVoteEnabled: autoVoteEnabled,
    autoEndorseEnabled: autoEndorseEnabled
  }, (response) => {
    if (response && response.success) {
      console.log('自动投票评分设置已保存');
    } else {
      console.error('保存自动投票评分设置失败');
    }
  });
}

// 更新自动投票评分统计区域的显示状态
function updateAutoVoteEndorseStatsDisplay(autoVoteEnabled, autoEndorseEnabled) {
  const disabledTip = document.getElementById('autoVoteEndorseDisabledTip');
  const statsContent = document.getElementById('autoVoteEndorseStatsContent');

  // 如果任一功能开启，显示统计信息；否则显示提示
  const isAnyEnabled = autoVoteEnabled || autoEndorseEnabled;

  if (disabledTip && statsContent) {
    if (isAnyEnabled) {
      disabledTip.style.display = 'none';
      statsContent.style.display = 'block';
      // 如果功能开启，加载统计数据
      loadAutoVoteEndorseStats();
    } else {
      disabledTip.style.display = 'block';
      statsContent.style.display = 'none';
    }
  }
}

// 加载自动投票评分统计
function loadAutoVoteEndorseStats() {
  // 检查功能是否开启，如果未开启则不加载统计
  chrome.storage.local.get(['autoVoteEnabled', 'autoEndorseEnabled'], (result) => {
    const autoVoteEnabled = result.autoVoteEnabled || false;
    const autoEndorseEnabled = result.autoEndorseEnabled || false;

    // 如果功能未开启，不加载统计
    if (!autoVoteEnabled && !autoEndorseEnabled) {
      console.log('自动投票评分功能未开启，跳过统计加载');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'getAutoVoteEndorseStats'
    }, (response) => {
      if (response) {
        // 更新统计显示
        const voteSuccessCountElement = document.getElementById('voteSuccessCount');
        const endorseSuccessCountElement = document.getElementById('endorseSuccessCount');
        const queueLengthElement = document.getElementById('queueLength');
        const queueReadyElement = document.getElementById('queueReady');
        const queueDetailsElement = document.getElementById('queueDetails');
        const waitingItemsListElement = document.getElementById('waitingItemsList');

        if (voteSuccessCountElement) {
          voteSuccessCountElement.textContent = response.voteSuccessCount || 0;
        }
        if (endorseSuccessCountElement) {
          endorseSuccessCountElement.textContent = response.endorseSuccessCount || 0;
        }
        if (queueLengthElement) {
          queueLengthElement.textContent = response.queueLength || 0;
        }
        if (queueReadyElement) {
          queueReadyElement.textContent = response.queueReady || 0;
        }

        // 显示等待中的模组详情
        if (queueDetailsElement && waitingItemsListElement) {
          if (response.waitingItems && response.waitingItems.length > 0) {
            queueDetailsElement.style.display = 'block';
            const itemsHtml = response.waitingItems.map(item =>
              `<div style="font-size: 10px; margin: 1px 0;">模组 ${item.gameId}/${item.modId} - 还需 ${item.minutesLeft} 分钟</div>`
            ).join('');
            waitingItemsListElement.innerHTML = itemsHtml;
          } else {
            queueDetailsElement.style.display = 'none';
          }
        }

        console.log('自动投票评分统计已更新:', response);
      } else {
        console.error('获取自动投票评分统计失败');
      }
    });
  });
}