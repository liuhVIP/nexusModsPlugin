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
const API_URL = "https://www.nexusmods.com/Core/Libs/Common/Managers/Downloads?GenerateDownloadUrl";
const NEXUS_BASE_URL = "https://www.nexusmods.com";
const REQUEST_TIMEOUT = 10000; // 请求超时时间 10秒

// 后台版本校验相关常量
const VERSION_CHECK = {
  API_BASE_URL: 'http://117.72.89.99:7003/api/sys-config/by-apply', // 后台版本校验接口基础URL
  APPLY_ID: 'N网智能助手', // 应用标识
  CHECK_INTERVAL: 30 * 60 * 1000, // 30分钟检查一次版本
  CACHE_EXPIRATION: 10 * 60 * 1000, // 版本信息缓存10分钟
  CURRENT_VERSION: 'v2.0' // 当前插件版本，从manifest.json获取
};

// URL监听设置的本地存储键名
const STORAGE_KEYS = {
  STANDARD_URL_ENABLED: 'standardUrlEnabled',
  GAME_LIST_URL_ENABLED: 'gameListUrlEnabled',
  REQUEST_DELAY: 'requestDelay',
  FILE_REQUEST_DELAY: 'fileRequestDelay',
  // 自动投票和评分相关设置
  AUTO_VOTE_ENABLED: 'autoVoteEnabled',
  AUTO_ENDORSE_ENABLED: 'autoEndorseEnabled',
  VOTE_SUCCESS_COUNT: 'voteSuccessCount',
  ENDORSE_SUCCESS_COUNT: 'endorseSuccessCount',
  // 版本校验相关设置
  VERSION_CHECK_CACHE: 'versionCheckCache',
  VERSION_CHECK_LAST_TIME: 'versionCheckLastTime',
  VERSION_MISMATCH_NOTIFIED: 'versionMismatchNotified'
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

// 自动投票和评分相关常量
const AUTO_VOTE_ENDORSE = {
    VOTE_API_URL: "https://www.nexusmods.com/Core/Libs/Common/Managers/Mods?VoteMOTM",
    ENDORSE_API_URL: "https://www.nexusmods.com/Core/Libs/Common/Managers/Mods?Endorse",
    DELAY_AFTER_DOWNLOAD: 20 * 60 * 1000, // 20分钟延迟
    PROCESS_INTERVAL: 30 * 1000, // 30秒检查一次队列
    REQUEST_DELAY: 5 * 1000 // 请求间隔5秒，避免风控
};

// 自动投票和评分队列
let autoVoteEndorseQueue = [];
let isProcessingVoteEndorse = false;

// 自动投票和评分设置
let autoVoteEndorseSettings = {
    autoVoteEnabled: false,
    autoEndorseEnabled: false
};

// 版本校验相关变量
let versionCheckTimer = null;
let lastVersionCheckResult = null;

/**
 * 获取系统配置信息
 * @returns {Promise<Object>} 系统配置信息
 */
async function fetchSystemConfig() {
    try {
        console.log('🔍 开始获取系统配置信息...');
        // 构建正确的API URL，对中文参数进行编码
        const encodedApplyId = encodeURIComponent(VERSION_CHECK.APPLY_ID);
        const apiUrl = `${VERSION_CHECK.API_BASE_URL}/${encodedApplyId}`;
        console.log('📡 请求URL:', apiUrl);
        console.log('🏷️ 应用标识:', VERSION_CHECK.APPLY_ID, '-> 编码后:', encodedApplyId);

        const response = await fetchWithTimeout(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        }, REQUEST_TIMEOUT);

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const result = await response.json();
        console.log('📋 系统配置API响应:', result);

        // 检查API返回状态码
        if (result.code !== 200) {
            throw new Error(result.msg || result.message || '获取系统配置失败');
        }

        return result.data;
    } catch (error) {
        console.error('❌ 获取系统配置失败:', error.message);
        throw error;
    }
}

/**
 * 比较版本号 - 完全一致性检查
 * @param {string} currentVersion 当前版本
 * @param {string} serverVersion 服务器版本
 * @returns {boolean} true: 版本一致, false: 版本不一致
 */
function compareVersions(currentVersion, serverVersion) {
    if (!currentVersion || !serverVersion) {
        console.log('⚠️ 版本信息不完整:', { currentVersion, serverVersion });
        return false;
    }

    // 去除前后空格并进行严格字符串比较
    const current = currentVersion.trim();
    const server = serverVersion.trim();

    const isMatch = current === server;
    console.log('🔍 版本比较:', {
        current: current,
        server: server,
        isMatch: isMatch
    });

    return isMatch;
}

/**
 * 执行版本校验
 * @param {boolean} forceCheck 是否强制检查（忽略缓存）
 * @returns {Promise<Object>} 校验结果
 */
async function performVersionCheck(forceCheck = false) {
    try {
        console.log('🔄 开始执行版本校验...');

        // 检查缓存（如果不是强制检查）
        if (!forceCheck) {
            const cachedResult = await getCachedVersionCheckResult();
            if (cachedResult) {
                console.log('📦 使用缓存的版本校验结果:', cachedResult);
                lastVersionCheckResult = cachedResult;
                return cachedResult;
            }
        }

        // 获取系统配置
        const systemConfig = await fetchSystemConfig();

        // 执行版本比较
        const currentVersion = VERSION_CHECK.CURRENT_VERSION;
        const serverVersion = systemConfig.sysVersion;
        const isVersionMatch = compareVersions(currentVersion, serverVersion);

        const result = {
            currentVersion,
            serverVersion,
            isUpToDate: isVersionMatch,
            needsUpdate: !isVersionMatch,
            systemConfig,
            checkTime: Date.now()
        };

        console.log('✅ 版本校验完成:', result);

        // 缓存结果
        await cacheVersionCheckResult(result);

        // 更新全局变量
        lastVersionCheckResult = result;

        // 更新最后检查时间
        chrome.storage.local.set({
            [STORAGE_KEYS.VERSION_CHECK_LAST_TIME]: Date.now()
        });

        return result;
    } catch (error) {
        console.error('❌ 版本校验失败:', error.message);
        const errorResult = {
            currentVersion: VERSION_CHECK.CURRENT_VERSION,
            serverVersion: null,
            isUpToDate: true, // 网络错误时假设版本正确，避免误报
            needsUpdate: false,
            error: error.message,
            checkTime: Date.now()
        };

        lastVersionCheckResult = errorResult;
        return errorResult;
    }
}

/**
 * 获取缓存的版本校验结果
 * @returns {Promise<Object|null>} 缓存的结果或null
 */
async function getCachedVersionCheckResult() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.VERSION_CHECK_CACHE], (result) => {
            if (result[STORAGE_KEYS.VERSION_CHECK_CACHE]) {
                const cached = result[STORAGE_KEYS.VERSION_CHECK_CACHE];
                const now = Date.now();

                // 检查缓存是否过期
                if (now - cached.checkTime < VERSION_CHECK.CACHE_EXPIRATION) {
                    resolve(cached);
                } else {
                    // 缓存已过期，清除它
                    chrome.storage.local.remove(STORAGE_KEYS.VERSION_CHECK_CACHE);
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * 缓存版本校验结果
 * @param {Object} result 校验结果
 * @returns {Promise<void>}
 */
async function cacheVersionCheckResult(result) {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            [STORAGE_KEYS.VERSION_CHECK_CACHE]: result
        }, resolve);
    });
}

/**
 * 启动定期版本校验
 */
function startVersionCheckTimer() {
    // 清除现有定时器
    if (versionCheckTimer) {
        clearInterval(versionCheckTimer);
    }

    console.log('⏰ 启动版本校验定时器，间隔:', VERSION_CHECK.CHECK_INTERVAL / 1000 / 60, '分钟');

    // 立即执行一次版本校验
    performVersionCheck(false).catch(error => {
        console.error('初始版本校验失败:', error);
    });

    // 设置定期校验
    versionCheckTimer = setInterval(() => {
        performVersionCheck(false).catch(error => {
            console.error('定期版本校验失败:', error);
        });
    }, VERSION_CHECK.CHECK_INTERVAL);
}

/**
 * 停止版本校验定时器
 */
function stopVersionCheckTimer() {
    if (versionCheckTimer) {
        clearInterval(versionCheckTimer);
        versionCheckTimer = null;
        console.log('⏹️ 版本校验定时器已停止');
    }
}

/**
 * 处理版本不匹配的情况
 * @param {Object} versionResult 版本校验结果
 */
async function handleVersionMismatch(versionResult) {
    if (!versionResult.needsUpdate) {
        return;
    }

    console.log('⚠️ 检测到版本不匹配，需要更新');

    // 检查是否已经通知过用户
    const notified = await new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.VERSION_MISMATCH_NOTIFIED], (result) => {
            resolve(result[STORAGE_KEYS.VERSION_MISMATCH_NOTIFIED] || false);
        });
    });

    if (!notified) {
        // 标记已通知
        chrome.storage.local.set({
            [STORAGE_KEYS.VERSION_MISMATCH_NOTIFIED]: true
        });

        // 向所有Nexus Mods标签页发送版本更新通知
        chrome.tabs.query({ url: "https://www.nexusmods.com/*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'versionUpdateNotification',
                    versionResult: versionResult
                }, (response) => {
                    // 忽略错误，因为有些标签页可能没有content script
                    if (chrome.runtime.lastError) {
                        console.log(`向标签页 ${tab.id} 发送版本更新通知失败:`, chrome.runtime.lastError.message);
                    }
                });
            });
        });
    }
}

// 设置全局解析状态
function setGlobalParsingStatus(isParsingEnabled) {
    globalParsingStatus = {
        isParsingEnabled: isParsingEnabled,
        lastUpdate: Date.now()
    };
    console.log(`设置全局解析状态: ${isParsingEnabled ? '启用' : '暂停'}`);
}

// 从直链URL中解析game_id和mod_id
function parseDirectLinkUrl(url) {
    try {
        // 示例URL: https://supporter-files.nexus-cdn.com/3333/21857/Trigger Mode Control_2.7.4_RU-21857-2-7-4-1748800009.zip
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (pathParts.length >= 2) {
            const gameId = pathParts[0];
            const modId = pathParts[1];

            // 验证是否为数字
            if (/^\d+$/.test(gameId) && /^\d+$/.test(modId)) {
                return { gameId, modId };
            }
        }

        return null;
    } catch (error) {
        console.error('解析直链URL失败:', error);
        return null;
    }
}

// 添加模组到自动投票评分队列
function addToAutoVoteEndorseQueue(gameId, modId, downloadUrls) {
    // 检查设置是否启用
    if (!autoVoteEndorseSettings.autoVoteEnabled && !autoVoteEndorseSettings.autoEndorseEnabled) {
        return;
    }

    const modKey = `${gameId}_${modId}`;
    const currentTime = Date.now();

    // 检查是否已经在队列中
    const existingIndex = autoVoteEndorseQueue.findIndex(item =>
        item.gameId === gameId && item.modId === modId
    );

    if (existingIndex !== -1) {
        const existingItem = autoVoteEndorseQueue[existingIndex];

        // 如果已经处理过，不再重复添加
        if (existingItem.processed) {
            console.log(`模组 ${gameId}/${modId} 已经处理过投票评分，跳过`);
            return;
        }

        // 如果还在队列中但未处理，更新下载链接但保持原有的首次获取时间
        existingItem.downloadUrls = downloadUrls;
        existingItem.lastUpdateTime = currentTime;
        console.log(`模组 ${gameId}/${modId} 已在队列中，更新下载链接，保持原有的首次获取时间: ${new Date(existingItem.firstObtainTime).toLocaleString()}`);

        // 保存更新后的队列
        saveAutoVoteEndorseQueue();
        return;
    }

    // 检查是否已经记录了首次获取时间
    chrome.storage.local.get([`firstObtainTime_${modKey}`], (result) => {
        const firstObtainTimeKey = `firstObtainTime_${modKey}`;
        let firstObtainTime = result[firstObtainTimeKey];

        // 如果没有记录首次获取时间，则记录当前时间
        if (!firstObtainTime) {
            firstObtainTime = currentTime;
            chrome.storage.local.set({ [firstObtainTimeKey]: firstObtainTime });
            console.log(`记录模组 ${gameId}/${modId} 的首次获取时间: ${new Date(firstObtainTime).toLocaleString()}`);
        } else {
            console.log(`模组 ${gameId}/${modId} 的首次获取时间: ${new Date(firstObtainTime).toLocaleString()}`);
        }

        // 计算处理时间（基于首次获取时间）
        const processTime = firstObtainTime + AUTO_VOTE_ENDORSE.DELAY_AFTER_DOWNLOAD;
        const timeUntilProcess = processTime - currentTime;

        // 添加到队列
        const queueItem = {
            gameId,
            modId,
            downloadUrls,
            firstObtainTime,        // 首次获取直链的时间
            addedTime: currentTime, // 添加到队列的时间
            lastUpdateTime: currentTime, // 最后更新时间
            processTime,            // 处理时间（基于首次获取时间）
            processed: false
        };

        autoVoteEndorseQueue.push(queueItem);

        if (timeUntilProcess > 0) {
            const minutesLeft = Math.ceil(timeUntilProcess / (60 * 1000));
            console.log(`模组 ${gameId}/${modId} 已添加到自动投票评分队列，还需等待 ${minutesLeft} 分钟后处理`);
        } else {
            console.log(`模组 ${gameId}/${modId} 已添加到自动投票评分队列，已满足20分钟条件，将立即处理`);
        }

        // 保存队列到本地存储
        saveAutoVoteEndorseQueue();

        // 启动队列处理器（如果还没启动）
        if (!isProcessingVoteEndorse) {
            startAutoVoteEndorseProcessor();
        }
    });
}

// 保存自动投票评分队列到本地存储
function saveAutoVoteEndorseQueue() {
    chrome.storage.local.set({
        'autoVoteEndorseQueue': JSON.stringify(autoVoteEndorseQueue)
    });
}

// 从本地存储恢复自动投票评分队列
function restoreAutoVoteEndorseQueue() {
    chrome.storage.local.get(['autoVoteEndorseQueue'], (result) => {
        if (result.autoVoteEndorseQueue) {
            try {
                autoVoteEndorseQueue = JSON.parse(result.autoVoteEndorseQueue);
                console.log(`恢复自动投票评分队列，共 ${autoVoteEndorseQueue.length} 个项目`);

                // 启动队列处理器
                if (autoVoteEndorseQueue.length > 0 && !isProcessingVoteEndorse) {
                    startAutoVoteEndorseProcessor();
                }
            } catch (error) {
                console.error('恢复自动投票评分队列失败:', error);
                autoVoteEndorseQueue = [];
            }
        }
    });
}

// 启动自动投票评分队列处理器
function startAutoVoteEndorseProcessor() {
    if (isProcessingVoteEndorse) {
        return;
    }

    isProcessingVoteEndorse = true;
    console.log('启动自动投票评分队列处理器');

    const processQueue = async () => {
        try {
            const now = Date.now();

            // 查找需要处理的项目（基于首次获取时间）
            const readyItems = autoVoteEndorseQueue.filter(item => {
                if (item.processed) return false;

                // 基于首次获取时间计算是否已经满足20分钟条件
                const timeSinceFirstObtain = now - item.firstObtainTime;
                const isReady = timeSinceFirstObtain >= AUTO_VOTE_ENDORSE.DELAY_AFTER_DOWNLOAD;

                if (isReady) {
                    const minutesSinceFirstObtain = Math.floor(timeSinceFirstObtain / (60 * 1000));
                    console.log(`模组 ${item.gameId}/${item.modId} 已满足条件，首次获取时间: ${new Date(item.firstObtainTime).toLocaleString()}，已过去 ${minutesSinceFirstObtain} 分钟`);
                }

                return isReady;
            });

            if (readyItems.length > 0) {
                console.log(`找到 ${readyItems.length} 个待处理的自动投票评分项目`);

                for (const item of readyItems) {
                    try {
                        await processAutoVoteEndorse(item);
                        item.processed = true;

                        // 保存队列状态
                        saveAutoVoteEndorseQueue();

                        // 请求间隔，避免风控
                        await new Promise(resolve => setTimeout(resolve, AUTO_VOTE_ENDORSE.REQUEST_DELAY));
                    } catch (error) {
                        console.error(`处理自动投票评分失败 (${item.gameId}/${item.modId}):`, error);
                        item.processed = true; // 标记为已处理，避免重复尝试
                    }
                }
            }

            // 清理已处理的项目（保留最近24小时的记录，基于首次获取时间）
            const oneDayAgo = now - 24 * 60 * 60 * 1000;
            const beforeCleanupCount = autoVoteEndorseQueue.length;
            autoVoteEndorseQueue = autoVoteEndorseQueue.filter(item => {
                // 保留未处理的项目
                if (!item.processed) return true;

                // 对于已处理的项目，只保留最近24小时内首次获取的
                return item.firstObtainTime > oneDayAgo;
            });

            const afterCleanupCount = autoVoteEndorseQueue.length;
            if (beforeCleanupCount !== afterCleanupCount) {
                console.log(`清理队列：删除了 ${beforeCleanupCount - afterCleanupCount} 个过期项目，剩余 ${afterCleanupCount} 个项目`);
                saveAutoVoteEndorseQueue();
            }

            // 如果还有未处理的项目，继续处理
            if (autoVoteEndorseQueue.some(item => !item.processed)) {
                setTimeout(processQueue, AUTO_VOTE_ENDORSE.PROCESS_INTERVAL);
            } else {
                isProcessingVoteEndorse = false;
                console.log('自动投票评分队列处理完成');
            }
        } catch (error) {
            console.error('自动投票评分队列处理器错误:', error);
            isProcessingVoteEndorse = false;
        }
    };

    processQueue();
}

// 处理单个模组的自动投票和评分
async function processAutoVoteEndorse(item) {
    console.log(`开始处理模组 ${item.gameId}/${item.modId} 的自动投票评分`);

    const cookies = await getNexusCookies();
    const cookieString = formatCookies(cookies);

    let voteSuccess = false;
    let endorseSuccess = false;

    // 执行自动投票
    if (autoVoteEndorseSettings.autoVoteEnabled) {
        try {
            const voteResult = await performAutoVote(item.gameId, item.modId, cookieString);
            if (voteResult.success) {
                voteSuccess = true;
                console.log(`模组 ${item.gameId}/${item.modId} 自动投票成功`);

                // 更新投票成功计数
                await incrementSuccessCount(STORAGE_KEYS.VOTE_SUCCESS_COUNT);
            } else {
                console.log(`模组 ${item.gameId}/${item.modId} 自动投票失败:`, voteResult.error);
            }
        } catch (error) {
            console.error(`模组 ${item.gameId}/${item.modId} 自动投票异常:`, error);
        }
    }

    // 执行自动评分（如果投票成功或未启用投票）
    if (autoVoteEndorseSettings.autoEndorseEnabled) {
        try {
            const endorseResult = await performAutoEndorse(item.gameId, item.modId, cookieString);
            if (endorseResult.success) {
                endorseSuccess = true;
                console.log(`模组 ${item.gameId}/${item.modId} 自动评分成功`);

                // 更新评分成功计数
                await incrementSuccessCount(STORAGE_KEYS.ENDORSE_SUCCESS_COUNT);
            } else {
                console.log(`模组 ${item.gameId}/${item.modId} 自动评分失败:`, endorseResult.error);
            }
        } catch (error) {
            console.error(`模组 ${item.gameId}/${item.modId} 自动评分异常:`, error);
        }
    }

    return { voteSuccess, endorseSuccess };
}

// 执行自动投票
async function performAutoVote(gameId, modId, cookies) {
    try {
        const data = new URLSearchParams();
        data.append('game_id', gameId);
        data.append('mod_id', modId);
        data.append('positive', '1');

        const response = await fetchWithTimeout(AUTO_VOTE_ENDORSE.VOTE_API_URL, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://www.nexusmods.com',
                'pragma': 'no-cache',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
                'x-requested-with': 'XMLHttpRequest',
                'Cookie': cookies
            },
            body: data
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const result = await response.text();
        console.log(`投票API响应:`, result);

        return { success: true, response: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 执行自动评分
async function performAutoEndorse(gameId, modId, cookies) {
    try {
        const data = new URLSearchParams();
        data.append('game_id', gameId);
        data.append('mod_id', modId);
        data.append('positive', '1');

        const response = await fetchWithTimeout(AUTO_VOTE_ENDORSE.ENDORSE_API_URL, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://www.nexusmods.com',
                'pragma': 'no-cache',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
                'x-requested-with': 'XMLHttpRequest',
                'Cookie': cookies
            },
            body: data
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const result = await response.text();
        console.log(`评分API响应:`, result);

        // 检查响应是否包含成功标识
        try {
            const jsonResult = JSON.parse(result);
            if (jsonResult.status === true) {
                return { success: true, response: jsonResult };
            } else {
                return { success: false, error: jsonResult.message || '评分失败' };
            }
        } catch (parseError) {
            // 如果不是JSON格式，检查是否包含成功标识
            if (result.includes('success') || result.includes('true')) {
                return { success: true, response: result };
            } else {
                return { success: false, error: '评分响应格式异常' };
            }
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 增加成功计数
async function incrementSuccessCount(storageKey) {
    return new Promise((resolve) => {
        chrome.storage.local.get([storageKey], (result) => {
            const currentCount = result[storageKey] || 0;
            const newCount = currentCount + 1;

            chrome.storage.local.set({ [storageKey]: newCount }, () => {
                console.log(`${storageKey} 计数更新为: ${newCount}`);
                resolve(newCount);
            });
        });
    });
}

// 加载自动投票评分设置
function loadAutoVoteEndorseSettings() {
    chrome.storage.local.get([
        STORAGE_KEYS.AUTO_VOTE_ENABLED,
        STORAGE_KEYS.AUTO_ENDORSE_ENABLED
    ], (result) => {
        autoVoteEndorseSettings.autoVoteEnabled = result[STORAGE_KEYS.AUTO_VOTE_ENABLED] || false;
        autoVoteEndorseSettings.autoEndorseEnabled = result[STORAGE_KEYS.AUTO_ENDORSE_ENABLED] || false;

        console.log('自动投票评分设置已加载:', autoVoteEndorseSettings);
    });
}

// 清理过期的首次获取时间记录
function cleanupExpiredFirstObtainTimes() {
    chrome.storage.local.get(null, (allData) => {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000; // 7天前
        const keysToRemove = [];

        // 查找所有首次获取时间的键
        Object.keys(allData).forEach(key => {
            if (key.startsWith('firstObtainTime_')) {
                const timestamp = allData[key];
                if (timestamp < sevenDaysAgo) {
                    keysToRemove.push(key);
                }
            }
        });

        // 删除过期的记录
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove, () => {
                console.log(`清理了 ${keysToRemove.length} 个过期的首次获取时间记录`);
            });
        }
    });
}

// 获取队列详细信息（用于统计显示）
function getQueueDetailedInfo() {
    const now = Date.now();
    const queueInfo = {
        total: autoVoteEndorseQueue.length,
        processed: 0,
        ready: 0,
        waiting: 0,
        waitingItems: []
    };

    autoVoteEndorseQueue.forEach(item => {
        if (item.processed) {
            queueInfo.processed++;
        } else {
            const timeSinceFirstObtain = now - item.firstObtainTime;
            const isReady = timeSinceFirstObtain >= AUTO_VOTE_ENDORSE.DELAY_AFTER_DOWNLOAD;

            if (isReady) {
                queueInfo.ready++;
            } else {
                queueInfo.waiting++;
                const timeLeft = AUTO_VOTE_ENDORSE.DELAY_AFTER_DOWNLOAD - timeSinceFirstObtain;
                const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
                queueInfo.waitingItems.push({
                    gameId: item.gameId,
                    modId: item.modId,
                    minutesLeft: minutesLeft
                });
            }
        }
    });

    return queueInfo;
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
loadAutoVoteEndorseSettings();
restoreAutoVoteEndorseQueue();
cleanupExpiredFirstObtainTimes();

// 启动版本校验
console.log('🚀 启动版本校验系统...');
startVersionCheckTimer();

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

        // 如果成功获取到下载链接，尝试添加到自动投票评分队列
        if (downloadUrls.length > 0) {
            try {
                // 从第一个下载链接中解析game_id和mod_id
                const firstUrl = downloadUrls[0].url;
                const parsedIds = parseDirectLinkUrl(firstUrl);

                if (parsedIds) {
                    console.log(`从直链解析到 game_id: ${parsedIds.gameId}, mod_id: ${parsedIds.modId}`);
                    addToAutoVoteEndorseQueue(parsedIds.gameId, parsedIds.modId, downloadUrls);
                } else {
                    console.log('无法从直链中解析game_id和mod_id');
                }
            } catch (error) {
                console.error('处理自动投票评分时发生错误:', error);
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
      files: ['aiChat/ai-mod-analyzer.js']
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

  // 处理自动投票评分设置更新
  if (request.action === "updateAutoVoteEndorseSettings") {
    autoVoteEndorseSettings.autoVoteEnabled = request.autoVoteEnabled;
    autoVoteEndorseSettings.autoEndorseEnabled = request.autoEndorseEnabled;

    // 保存到本地存储
    chrome.storage.local.set({
      [STORAGE_KEYS.AUTO_VOTE_ENABLED]: request.autoVoteEnabled,
      [STORAGE_KEYS.AUTO_ENDORSE_ENABLED]: request.autoEndorseEnabled
    });

    console.log('自动投票评分设置已更新:', autoVoteEndorseSettings);
    sendResponse({ success: true });
    return true;
  }

  // 处理获取自动投票评分统计
  if (request.action === "getAutoVoteEndorseStats") {
    chrome.storage.local.get([
      STORAGE_KEYS.VOTE_SUCCESS_COUNT,
      STORAGE_KEYS.ENDORSE_SUCCESS_COUNT
    ], (result) => {
      const queueInfo = getQueueDetailedInfo();
      sendResponse({
        voteSuccessCount: result[STORAGE_KEYS.VOTE_SUCCESS_COUNT] || 0,
        endorseSuccessCount: result[STORAGE_KEYS.ENDORSE_SUCCESS_COUNT] || 0,
        queueLength: queueInfo.waiting, // 只显示等待中的数量
        queueReady: queueInfo.ready,    // 准备处理的数量
        queueTotal: queueInfo.total,    // 总数量
        queueProcessed: queueInfo.processed, // 已处理数量
        waitingItems: queueInfo.waitingItems.slice(0, 5) // 最多显示5个等待项目的详情
      });
    });
    return true;
  }

  // 处理版本校验请求
  if (request.action === "checkVersion") {
    console.log('📨 收到版本校验请求:', request);
    const forceCheck = request.forceCheck || false;
    performVersionCheck(forceCheck)
      .then(result => {
        console.log('✅ 版本校验完成，发送响应:', result);
        // 处理版本不匹配情况
        handleVersionMismatch(result);
        sendResponse({ success: true, versionResult: result });
      })
      .catch(error => {
        console.error('❌ 版本校验失败，发送错误响应:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // 处理获取版本状态请求
  if (request.action === "getVersionStatus") {
    console.log('📨 收到获取版本状态请求');
    if (lastVersionCheckResult) {
      console.log('📦 返回缓存的版本状态:', lastVersionCheckResult);
      sendResponse({ success: true, versionResult: lastVersionCheckResult });
    } else {
      console.log('🔍 没有缓存结果，执行新的版本检查');
      // 如果没有缓存结果，执行一次检查
      performVersionCheck(false)
        .then(result => {
          console.log('✅ 新版本检查完成，发送响应:', result);
          sendResponse({ success: true, versionResult: result });
        })
        .catch(error => {
          console.error('❌ 新版本检查失败，发送错误响应:', error);
          sendResponse({ success: false, error: error.message });
        });
    }
    return true;
  }

  // 处理重置版本通知状态
  if (request.action === "resetVersionNotification") {
    chrome.storage.local.remove(STORAGE_KEYS.VERSION_MISMATCH_NOTIFIED);
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