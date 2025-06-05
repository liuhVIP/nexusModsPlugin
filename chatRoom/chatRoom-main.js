/**
 * 聊天室主要实现 - 专注于WebSocket长连接功能
 * 作者: Nexus Mods Plugin
 * 功能: 提供稳定的WebSocket长连接聊天室服务
 */

// 聊天室配置
const CHAT_CONFIG = {
    roomId: 'MonsterHunterWilds',
    serverUrl: 'http://117.72.89.99:7003',
    wsEndpoint: 'http://117.72.89.99:7003/ws',
    reconnectDelay: 3000,
    maxReconnectAttempts: 5
};

// 聊天室状态管理
const chatState = {
    username: null,
    userId: null,
    stompClient: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    isConnected: false,
    isConnecting: false,
    // 分页状态管理
    currentPage: 1,
    pageSize: 15,
    hasMore: true,
    isLoading: false
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 聊天室主程序启动');
    initializeChatRoom();
});

/**
 * 初始化聊天室
 */
async function initializeChatRoom() {
    try {
        // 检查必要的库是否加载
        if (!checkRequiredLibraries()) {
            console.error('❌ 必要的库文件未加载');
            updateConnectionStatus('库文件加载失败');
            return;
        }

        // 获取或创建用户信息
        await initializeUserInfo();
        
        // 绑定事件
        bindChatEvents();
        
        // 显示聊天室
        showChatRoom();
        
        // 连接WebSocket
        connectToServer();
        
        console.log('✅ 聊天室初始化完成');
    } catch (error) {
        console.error('❌ 聊天室初始化失败:', error);
        updateConnectionStatus('初始化失败: ' + error.message);
    }
}

/**
 * 检查必要的库是否已加载
 */
function checkRequiredLibraries() {
    const libraries = [
        { name: 'SockJS', check: () => typeof SockJS !== 'undefined' },
        { name: 'Stomp', check: () => typeof Stomp !== 'undefined' },
        { name: 'jQuery', check: () => typeof $ !== 'undefined' }
    ];
    
    for (const lib of libraries) {
        if (!lib.check()) {
            console.error(`❌ ${lib.name} 库未加载`);
            return false;
        }
    }
    
    console.log('✅ 所有必要库已加载');
    return true;
}

/**
 * 初始化用户信息
 */
async function initializeUserInfo() {
    let savedUsername = localStorage.getItem('chatUsername');
    let savedUserId = localStorage.getItem('chatUserId');
    
    if (!savedUsername || !savedUserId) {
        try {
            // 尝试从服务器获取用户名
            const response = await fetch(`${CHAT_CONFIG.serverUrl}/api/chat/generate-username`);
            const result = await response.json();
            
            if (result.code === 200) {
                savedUsername = result.data;
                savedUserId = generateUniqueId();
                localStorage.setItem('chatUsername', savedUsername);
                localStorage.setItem('chatUserId', savedUserId);
                console.log('✅ 从服务器获取用户名:', savedUsername);
            } else {
                throw new Error('服务器返回错误: ' + result.message);
            }
        } catch (error) {
            console.warn('⚠️ 无法从服务器获取用户名，使用本地生成:', error.message);
            // 生成本地用户名
            savedUsername = 'Guest_' + Math.random().toString(36).substring(2, 8);
            savedUserId = generateUniqueId();
            localStorage.setItem('chatUsername', savedUsername);
            localStorage.setItem('chatUserId', savedUserId);
        }
    }
    
    chatState.username = savedUsername;
    chatState.userId = savedUserId;
    
    // 更新UI显示
    updateUsernameDisplay();

    // 初始化用户计数显示
    updateUserCount(0);

    console.log('✅ 用户信息初始化完成:', { username: savedUsername, userId: savedUserId });
}

/**
 * 生成唯一ID
 */
function generateUniqueId() {
    return 'u' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * 更新用户名显示
 */
function updateUsernameDisplay() {
    const usernameElement = document.getElementById('currentUsername');
    if (usernameElement && chatState.username) {
        usernameElement.textContent = chatState.username;
    }
}

/**
 * 初始化消息输入框
 */
function initializeMessageInput(messageInput) {
    // 清除可能存在的空白字符和换行符
    messageInput.innerHTML = '';

    // 确保输入框是干净的状态
    messageInput.textContent = '';

    // 清除可能存在的内联样式（防止复制图片时的样式残留）
    messageInput.style.removeProperty('min-height');
    messageInput.style.removeProperty('height');

    // 清除特殊CSS类
    messageInput.classList.remove('has-line-breaks-only');

    // 初始化placeholder显示
    updatePlaceholderDisplay();

    // 初始化发送按钮状态
    updateSendButtonState();

    console.log('✅ 消息输入框已初始化');
}

/**
 * 更新placeholder显示
 */
function updatePlaceholderDisplay() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    // 检查输入框是否为空（包括只有空白字符和换行符的情况）
    const textContent = messageInput.textContent || '';
    const hasImages = messageInput.getElementsByTagName('img').length > 0;
    const isFocused = document.activeElement === messageInput;

    // 更严格的空内容检查：去除所有空白字符（包括换行符、空格、制表符等）
    const hasRealContent = textContent.replace(/\s/g, '').length > 0 || hasImages;

    if (!hasRealContent && !isFocused) {
        messageInput.classList.add('empty');
    } else {
        messageInput.classList.remove('empty');
    }
}

/**
 * 确保换行符正确显示
 */
function ensureLineBreaksVisible() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    // 获取当前内容
    const content = messageInput.innerHTML;
    const textContent = messageInput.textContent || '';
    const hasImages = messageInput.getElementsByTagName('img').length > 0;

    // 如果有图片或实际文本内容，清除可能存在的强制高度样式
    if (hasImages || textContent.replace(/\s/g, '').length > 0) {
        // 清除之前可能设置的内联样式，让CSS自然控制高度
        messageInput.style.removeProperty('min-height');
        messageInput.style.removeProperty('height');
        return;
    }

    // 如果内容只包含换行符或空白字符，确保它们可见
    if (content && !content.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim()) {
        // 内容只有换行符，使用CSS类而不是内联样式
        if (content.includes('<br>') || content.includes('<br/>') || content.includes('<br />')) {
            // 添加特殊类来处理只有换行符的情况
            messageInput.classList.add('has-line-breaks-only');
        }
    } else {
        // 移除特殊类
        messageInput.classList.remove('has-line-breaks-only');
    }
}

/**
 * 更新发送按钮状态
 */
function updateSendButtonState() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.querySelector('.send-btn');

    if (!messageInput || !sendBtn) return;

    // 检查是否有内容可以发送（文本或图片）
    const hasText = messageInput.textContent.trim().length > 0;
    const hasImages = messageInput.getElementsByTagName('img').length > 0;
    const hasContent = hasText || hasImages;

    // 更新按钮状态
    if (hasContent) {
        sendBtn.disabled = false;
        sendBtn.classList.add('active');
        // 确保按钮显示正确的内容
        if (!sendBtn.classList.contains('loading')) {
            sendBtn.innerHTML = '<img src="../images/send.png" alt="发送" />';
        }
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.remove('active');
        // 确保按钮显示正确的内容
        if (!sendBtn.classList.contains('loading')) {
            sendBtn.innerHTML = '<img src="../images/send.png" alt="发送" />';
        }
    }
}

/**
 * 绑定聊天事件
 */
function bindChatEvents() {
    // 聊天图标点击事件（如果存在）
    const chatIconBtn = document.querySelector('.chat-icon-btn');
    if (chatIconBtn) {
        chatIconBtn.addEventListener('click', showChatRoom);
        chatIconBtn.style.display = 'block'; // 显示聊天图标
    }

    // 发送按钮事件
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // 设置右键菜单功能
    setupContextMenu();

    // 输入框初始化和事件绑定
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // 初始化输入框 - 清除可能的空白字符
        initializeMessageInput(messageInput);

        // 回车事件
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // 输入变化事件 - 更新发送按钮状态和placeholder显示
        messageInput.addEventListener('input', function() {
            updateSendButtonState();
            updatePlaceholderDisplay();
            // 确保换行符正确显示
            ensureLineBreaksVisible();
        });

        // 焦点事件 - 更新placeholder显示
        messageInput.addEventListener('focus', updatePlaceholderDisplay);
        messageInput.addEventListener('blur', updatePlaceholderDisplay);

        // 添加图片粘贴功能
        messageInput.addEventListener('paste', handleImagePaste);

        // 添加拖拽上传功能
        messageInput.addEventListener('dragover', handleDragOver);
        messageInput.addEventListener('drop', handleImageDrop);
    }

    // 添加图片上传按钮事件
    setupImageUploadButton();

    // 添加表情选择面板事件
    setupEmojiPanel();

    // 添加用户列表收起/展开功能
    setupUserListToggle();

    // 绑定用户名修改相关事件
    setupUsernameModalEvents();

    // 绑定系统消息模态框事件
    setupMessageModalEvents();

    console.log('✅ 事件绑定完成（包含图片上传功能、表情面板、用户列表收起功能和模态框事件）');
}

/**
 * 显示聊天室
 */
function showChatRoom() {
    // 聊天室现在默认就是显示的，不需要额外操作
    console.log('📱 聊天室已经是显示状态');
}

/**
 * 隐藏聊天室
 */
function hideChatRoom() {
    // 使用窗口管理器来隐藏聊天室
    if (window.chatRoomWindow) {
        window.chatRoomWindow.hideWindow();
    } else {
        // 回退方案：直接操作DOM
        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
            chatModal.style.display = 'none';
            console.log('📱 聊天室已隐藏（回退方案）');
        }
    }
}

/**
 * 连接到WebSocket服务器
 */
function connectToServer() {
    if (chatState.isConnecting || chatState.isConnected) {
        console.log('⚠️ 已在连接中或已连接，跳过重复连接');
        return;
    }
    
    chatState.isConnecting = true;
    chatState.reconnectAttempts++;
    
    console.log(`🔌 开始连接WebSocket服务器 (尝试 ${chatState.reconnectAttempts}/${CHAT_CONFIG.maxReconnectAttempts})`);
    console.log('🔗 WebSocket端点:', CHAT_CONFIG.wsEndpoint);
    
    updateConnectionStatus('连接中...');
    
    try {
        // 创建SockJS连接
        const socket = new SockJS(CHAT_CONFIG.wsEndpoint);
        
        // 添加SockJS事件监听
        socket.onopen = function() {
            console.log('✅ SockJS连接已建立');
        };
        
        socket.onclose = function(event) {
            console.log('❌ SockJS连接已关闭:', event);
            chatState.isConnected = false;
            chatState.isConnecting = false;
        };
        
        socket.onerror = function(error) {
            console.error('❌ SockJS连接错误:', error);
        };
        
        // 创建STOMP客户端
        chatState.stompClient = Stomp.over(socket);
        
        // 启用STOMP调试信息
        chatState.stompClient.debug = function(str) {
            console.log('🔍 STOMP调试:', str);
        };
        
        // 连接STOMP
        chatState.stompClient.connect(
            {}, // 连接头
            onConnectSuccess,
            onConnectError
        );
        
    } catch (error) {
        console.error('❌ 创建WebSocket连接失败:', error);
        chatState.isConnecting = false;
        updateConnectionStatus('连接失败: ' + error.message);
        scheduleReconnect();
    }
}

/**
 * 连接成功回调
 */
function onConnectSuccess(frame) {
    console.log('🎉 WebSocket连接成功!', frame);
    
    chatState.isConnected = true;
    chatState.isConnecting = false;
    chatState.reconnectAttempts = 0;
    
    updateConnectionStatus('已连接');
    
    // 订阅消息频道
    subscribeToChannels();
    
    // 加入聊天室
    joinChatRoom();
    
    // 清除重连定时器
    if (chatState.reconnectTimer) {
        clearTimeout(chatState.reconnectTimer);
        chatState.reconnectTimer = null;
    }
}

/**
 * 连接失败回调
 */
function onConnectError(error) {
    console.error('❌ WebSocket连接失败:', error);
    
    chatState.isConnected = false;
    chatState.isConnecting = false;
    
    updateConnectionStatus('连接失败，准备重连...');
    
    // 安排重连
    scheduleReconnect();
}

/**
 * 安排重连
 */
function scheduleReconnect() {
    if (chatState.reconnectAttempts >= CHAT_CONFIG.maxReconnectAttempts) {
        console.error('❌ 达到最大重连次数，停止重连');
        updateConnectionStatus('连接失败，请刷新页面重试');
        return;
    }
    
    if (chatState.reconnectTimer) {
        clearTimeout(chatState.reconnectTimer);
    }
    
    console.log(`⏰ ${CHAT_CONFIG.reconnectDelay}ms 后尝试重连...`);
    chatState.reconnectTimer = setTimeout(() => {
        connectToServer();
    }, CHAT_CONFIG.reconnectDelay);
}

/**
 * 订阅消息频道
 */
function subscribeToChannels() {
    if (!chatState.stompClient || !chatState.stompClient.connected) {
        console.error('❌ STOMP客户端未连接，无法订阅频道');
        return;
    }
    
    try {
        // 订阅聊天室消息
        chatState.stompClient.subscribe('/topic/room/' + CHAT_CONFIG.roomId, onMessageReceived);
        console.log('✅ 已订阅聊天室消息频道');
        
        // 订阅广播消息
        chatState.stompClient.subscribe('/topic/broadcast', onBroadcastReceived);
        console.log('✅ 已订阅广播消息频道');
        
        // 订阅个人错误消息
        chatState.stompClient.subscribe('/topic/errors/' + chatState.username, onErrorReceived);
        console.log('✅ 已订阅个人错误消息频道');
        
    } catch (error) {
        console.error('❌ 订阅消息频道失败:', error);
    }
}

/**
 * 更新连接状态显示
 */
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
        console.log('📊 连接状态更新:', status);
    }
}

// 全局函数，供HTML调用
window.sendMessage = sendMessage;
window.changeUsername = changeUsername;

/**
 * 发送消息（支持文本和图片）
 */
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.querySelector('.send-btn');

    if (!messageInput || !chatState.stompClient || !chatState.stompClient.connected) {
        console.warn('⚠️ 无法发送消息：输入框不存在或WebSocket未连接');
        showSystemMessage('WebSocket连接已断开，请刷新页面重试', 'error');
        return;
    }

    // 获取文本内容
    const textContent = messageInput.textContent.trim();

    // 获取图片内容
    const images = Array.from(messageInput.getElementsByTagName('img'))
        .map(img => img.dataset.imageData)
        .filter(data => data && data.startsWith('data:image/'));

    // 检查是否有内容要发送
    if (!textContent && images.length === 0) {
        console.warn('⚠️ 消息内容为空，不发送');
        return;
    }

    // 禁用发送按钮，防止重复发送
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add('loading');
        sendBtn.innerHTML = '<img src="../images/send.png" alt="发送中..." />';
    }

    try {
        // 确定消息类型
        let messageType = 'text';
        if (images.length > 0 && textContent) {
            messageType = 'mixed';
        } else if (images.length > 0 && !textContent) {
            messageType = 'image';
        }

        const chatMessage = {
            roomId: CHAT_CONFIG.roomId,
            username: chatState.username,
            userId: chatState.userId,
            message: textContent,
            type: messageType,
            imageData: images,
            timestamp: new Date().toISOString()
        };

        // 通过STOMP发送消息
        chatState.stompClient.send("/app/chat.send", {}, JSON.stringify(chatMessage));

        // 清空输入框
        messageInput.innerHTML = '';

        // 清除可能存在的内联样式和特殊类
        messageInput.style.removeProperty('min-height');
        messageInput.style.removeProperty('height');
        messageInput.classList.remove('has-line-breaks-only');

        // 更新placeholder和按钮状态
        updatePlaceholderDisplay();
        updateSendButtonState();

        console.log('📤 消息发送成功:', { text: textContent, images: images.length, type: messageType });

    } catch (error) {
        console.error('❌ 发送消息失败:', error);
        showSystemMessage('发送消息失败: ' + error.message, 'error');
    } finally {
        // 恢复发送按钮状态
        if (sendBtn) {
            sendBtn.classList.remove('loading');
            // 重新检查按钮状态（因为输入框可能已清空）
            updateSendButtonState();
        }
    }
}

/**
 * 修改用户名 - 显示用户名修改模态框
 */
function changeUsername() {
    const usernameModal = document.getElementById('username-modal');
    const newUsernameInput = document.getElementById('new-username');

    if (!usernameModal || !newUsernameInput) {
        console.error('❌ 用户名修改模态框元素未找到');
        return;
    }

    // 设置当前用户名作为默认值
    newUsernameInput.value = chatState.username || '';

    // 显示模态框
    usernameModal.style.display = 'flex';

    // 聚焦到输入框
    setTimeout(() => {
        newUsernameInput.focus();
        newUsernameInput.select();
    }, 100);

    console.log('📝 用户名修改模态框已显示');
}

/**
 * 消息接收处理
 */
function onMessageReceived(payload) {
    try {
        const message = JSON.parse(payload.body);
        console.log('📨 收到消息:', message);

        if (message.type === 'JOIN' || message.type === 'LEAVE') {
            // 系统消息：用户加入/离开
            const action = message.type === 'JOIN' ? '加入' : '离开';
            appendSystemMessage(`${message.username} ${action}了聊天室`);
            updateUserList(); // 更新用户列表
        } else {
            // 普通聊天消息
            appendMessage(message);
        }

    } catch (error) {
        console.error('❌ 处理接收消息失败:', error);
    }
}

/**
 * 广播消息处理
 */
function onBroadcastReceived(payload) {
    try {
        const message = JSON.parse(payload.body);
        console.log('📢 收到广播消息:', message);

        // 显示广播消息
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-container system broadcast';

            const messageContent = document.createElement('div');
            messageContent.className = 'message';
            messageContent.innerHTML = `<span class="broadcast-icon">📢</span> ${message.message}`;

            messageDiv.appendChild(messageContent);
            messagesContainer.appendChild(messageDiv);

            scrollToBottom();
        }

    } catch (error) {
        console.error('❌ 处理广播消息失败:', error);
    }
}

/**
 * 错误消息处理
 */
function onErrorReceived(payload) {
    try {
        const error = JSON.parse(payload.body);
        console.error('❌ 收到服务器错误消息:', error);

        showSystemMessage('服务器错误: ' + error.message, 'error');

    } catch (parseError) {
        console.error('❌ 解析错误消息失败:', parseError);
    }
}

/**
 * 加入聊天室
 */
async function joinChatRoom() {
    try {
        console.log('🚪 正在加入聊天室...');

        // 根据API文档，只需要传递 roomId 和 username 参数
        const response = await fetch(`${CHAT_CONFIG.serverUrl}/api/chat/room/${CHAT_CONFIG.roomId}/join?username=${encodeURIComponent(chatState.username)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || errorData.message || '加入聊天室失败');
        }

        const result = await response.json();

        if (result.code === 200) {
            console.log('✅ 成功加入聊天室');
            showSystemMessage('已加入聊天室');
            updateUserList();
            loadChatHistory();
        } else if (result.code === 409) {
            // 用户名冲突，使用建议的用户名
            console.log('⚠️ 用户名冲突，使用建议用户名:', result.data?.suggestedName);
            if (result.data?.suggestedName) {
                chatState.username = result.data.suggestedName;
                localStorage.setItem('chatUsername', chatState.username);
                updateUsernameDisplay();
                // 重新尝试加入
                joinChatRoom();
            } else {
                throw new Error('用户名冲突但未提供建议用户名');
            }
        } else {
            throw new Error(result.msg || result.message || '加入聊天室失败');
        }

    } catch (error) {
        console.error('❌ 加入聊天室失败:', error);
        showSystemMessage('加入聊天室失败: ' + error.message, 'error');
    }
}

/**
 * 更新用户列表
 */
async function updateUserList() {
    try {
        console.log('🔄 开始更新用户列表...');
        const response = await fetch(`${CHAT_CONFIG.serverUrl}/api/chat/room/${CHAT_CONFIG.roomId}/users`);
        const result = await response.json();

        console.log('🔍 用户列表API响应:', result);

        if (result.code === 200 && Array.isArray(result.data)) {
            const userListElement = document.getElementById('userList');
            console.log('🔍 用户列表元素:', userListElement);

            if (userListElement) {
                // 清空现有列表
                userListElement.innerHTML = '';
                console.log('🧹 已清空用户列表');

                // 添加每个用户
                result.data.forEach((username, index) => {
                    console.log(`👤 添加用户 ${index + 1}:`, username);

                    const userItem = document.createElement('li');
                    userItem.className = 'user-item';
                    userItem.textContent = username;

                    // 标记当前用户
                    if (username === chatState.username) {
                        userItem.textContent += ' (我)';
                        userItem.style.fontWeight = 'bold';
                        userItem.style.color = '#007bff';
                    }

                    userListElement.appendChild(userItem);
                    console.log(`✅ 用户 "${username}" 已添加到列表`);
                });

                // 更新用户计数显示
                updateUserCount(result.data.length);

                console.log('✅ 用户列表更新完成，总用户数:', result.data.length);
                console.log('🔍 最终用户列表HTML:', userListElement.innerHTML);
            } else {
                console.error('❌ 未找到用户列表元素 #userList');
                // 尝试查找可能的替代元素
                const possibleElements = [
                    document.querySelector('.user-list'),
                    document.querySelector('#user-list'),
                    document.querySelector('.users'),
                    document.querySelector('#users')
                ];
                console.log('🔍 查找可能的用户列表元素:', possibleElements);
            }
        } else {
            console.error('❌ 获取用户列表失败');
            console.error('状态码:', result.code);
            console.error('数据类型:', typeof result.data);
            console.error('数据内容:', result.data);
            console.error('错误信息:', result.msg || result.message);

            // 错误时重置用户计数
            updateUserCount(0);
        }
    } catch (error) {
        console.error('❌ 获取用户列表异常:', error);

        // 异常时重置用户计数
        updateUserCount(0);
    }
}

/**
 * 更新用户计数显示
 * @param {number} count - 用户数量
 */
function updateUserCount(count) {
    const userCountElement = document.getElementById('userCount');
    if (userCountElement) {
        // 更新计数文本
        userCountElement.textContent = `(${count})`;

        // 添加更新动画效果
        userCountElement.classList.add('updated');

        // 移除动画效果
        setTimeout(() => {
            userCountElement.classList.remove('updated');
        }, 500);

        console.log('📊 用户计数已更新:', count);
    } else {
        console.warn('⚠️ 未找到用户计数元素 #userCount');
    }
}

/**
 * 加载聊天历史（支持分页）
 * @param {boolean} isInitial - 是否为初始加载
 */
async function loadChatHistory(isInitial = true) {
    // 防止重复加载
    if (chatState.isLoading) {
        console.log('⚠️ 正在加载中，跳过重复请求');
        return;
    }

    // 如果不是初始加载且没有更多数据，直接返回
    if (!isInitial && !chatState.hasMore) {
        console.log('⚠️ 没有更多历史消息了');
        return;
    }

    chatState.isLoading = true;

    try {
        console.log(`📚 正在加载聊天历史... 页码: ${chatState.currentPage}, 每页: ${chatState.pageSize}`);

        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) {
            console.warn('⚠️ 未找到消息容器');
            return;
        }

        // 显示加载动画
        if (isInitial) {
            // 初始加载：清空容器并显示居中加载动画
            messagesContainer.innerHTML = `
                <div class="loading-message-container">
                    <div class="loading-spinner">
                        <span class="spinner-icon">⏳</span>
                    </div>
                    <div class="loading-text2">加载聊天记录中...</div>
                </div>
            `;
        } else {
            // 增量加载：在顶部添加加载动画
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-message-container top-loading';
            loadingDiv.innerHTML = `
                <div class="loading-spinner">
                    <span class="spinner-icon">⏳</span>
                </div>
                <div class="loading-text2">加载更多历史消息...</div>
            `;
            messagesContainer.insertBefore(loadingDiv, messagesContainer.firstChild);
        }

        // 调用分页API
        const response = await fetch(`${CHAT_CONFIG.serverUrl}/api/chat/history/page`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomId: CHAT_CONFIG.roomId,
                pageIndex: chatState.currentPage,
                pageSize: chatState.pageSize
            })
        });

        const result = await response.json();

        // 移除加载动画
        const loadingContainer = messagesContainer.querySelector('.loading-message-container');
        if (loadingContainer) {
            loadingContainer.remove();
        }

        // 检查API返回状态码
        if (result.code !== 200) {
            throw new Error(result.msg || result.message || '获取聊天历史失败');
        }

        const { data } = result;

        // 更新分页状态
        chatState.hasMore = data.current < data.pages;

        console.log(`📊 分页信息: 当前页 ${data.current}/${data.pages}, 总记录 ${data.total}, 本页记录 ${data.records.length}`);

        // 处理消息数据
        if (data.records && data.records.length > 0) {
            // 记录当前滚动位置（用于增量加载时保持位置）
            const scrollPos = messagesContainer.scrollTop;
            const scrollHeight = messagesContainer.scrollHeight;

            // 创建文档片段以提高性能
            const fragment = document.createDocumentFragment();

            // 添加消息到文档片段
            data.records.forEach(message => {
                if (message.type === 'JOIN' || message.type === 'LEAVE') {
                    appendSystemMessage(message, fragment);
                } else {
                    appendMessage(message, fragment);
                }
            });

            if (isInitial) {
                // 初始加载：清空容器并添加消息
                messagesContainer.innerHTML = '';
                messagesContainer.appendChild(fragment);

                // 如果还有更多数据，添加"加载更多"按钮
                if (chatState.hasMore) {
                    addLoadMoreButton();
                }

                // 滚动到底部
                setTimeout(() => {
                    scrollToBottom();
                }, 100);
            } else {
                // 增量加载：在顶部插入新消息
                messagesContainer.insertBefore(fragment, messagesContainer.firstChild);

                // 如果还有更多数据，添加新的"加载更多"按钮
                if (chatState.hasMore) {
                    addLoadMoreButton();
                } else {
                    // 没有更多数据时显示提示
                    addNoMoreDataTip();
                }

                // 保持滚动位置
                messagesContainer.scrollTop = scrollPos + (messagesContainer.scrollHeight - scrollHeight);
            }

            // 更新页码
            chatState.currentPage++;
        } else {
            if (isInitial) {
                // 初始加载无数据：显示欢迎消息
                messagesContainer.innerHTML = '';
                showSystemMessage('欢迎来到聊天室！开始聊天吧~', 'info');
            }
        }

        console.log('✅ 聊天历史加载完成，本次加载消息数:', data.records ? data.records.length : 0);

    } catch (error) {
        console.error('❌ 加载聊天历史失败:', error);

        // 移除加载动画（如果还存在）
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            const loadingContainer = messagesContainer.querySelector('.loading-message-container');
            if (loadingContainer) {
                loadingContainer.remove();
            }
        }

        if (isInitial) {
            // 初始加载失败：显示错误消息
            showSystemMessage('加载聊天历史失败: ' + error.message, 'error');
        } else {
            // 增量加载失败：显示错误提示但不影响现有消息
            showSystemMessage('加载更多消息失败: ' + error.message, 'error');
        }
    } finally {
        chatState.isLoading = false;
    }
}

/**
 * 添加"加载更多"按钮
 */
function addLoadMoreButton() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    // 移除现有的加载按钮（如果存在）
    const existingBtn = messagesContainer.querySelector('.load-history-btn');
    if (existingBtn) {
        existingBtn.remove();
    }

    // 创建新的加载按钮
    const loadBtn = document.createElement('button');
    loadBtn.className = 'load-history-btn';
    loadBtn.innerHTML = `
        <span class="btn-icon">📜</span>
        <span>加载更多历史消息</span>
    `;
    loadBtn.onclick = () => loadChatHistory(false);

    // 插入到消息容器顶部
    messagesContainer.insertBefore(loadBtn, messagesContainer.firstChild);

    console.log('✅ 已添加"加载更多"按钮');
}

/**
 * 添加"没有更多数据"提示
 */
function addNoMoreDataTip() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    // 移除现有的加载按钮（如果存在）
    const existingBtn = messagesContainer.querySelector('.load-history-btn');
    if (existingBtn) {
        existingBtn.remove();
    }

    // 创建提示信息
    const noMoreDiv = document.createElement('div');
    noMoreDiv.className = 'message-container system center-message';
    noMoreDiv.innerHTML = `
        <div class="message">
            <span class="status-icon">✅</span>
            <span>没有更多历史消息了</span>
        </div>
    `;

    // 插入到消息容器顶部
    messagesContainer.insertBefore(noMoreDiv, messagesContainer.firstChild);

    console.log('✅ 已添加"没有更多数据"提示');
}

/**
 * 显示系统消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型
 * @param {DocumentFragment} container - 可选的容器，用于批量添加
 */
function showSystemMessage(message, type = 'info', container = null) {
    const messagesContainer = container || document.getElementById('messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-container system ${type}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message';
    messageContent.textContent = message;

    messageDiv.appendChild(messageContent);

    if (container) {
        container.appendChild(messageDiv);
    } else {
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    console.log(`📢 系统消息 [${type}]:`, message);
}

/**
 * 添加消息到界面
 * @param {Object} message - 消息对象
 * @param {DocumentFragment} container - 可选的容器，用于批量添加
 */
function appendMessage(message, container = null) {
    const messagesContainer = container || document.getElementById('messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    const isOwnMessage = message.username === chatState.username;
    messageDiv.className = `message-container ${isOwnMessage ? 'sent' : 'received'}`;

    // 创建用户信息
    const userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info';

    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = message.username;

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';

    // 处理时间戳格式 - 支持历史消息的毫秒时间戳
    let timeString;
    if (typeof message.timestamp === 'number') {
        // 毫秒时间戳
        timeString = new Date(message.timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        // 字符串格式的时间戳
        timeString = new Date(message.timestamp).toLocaleTimeString();
    }
    timestampDiv.textContent = timeString;

    userInfoDiv.appendChild(usernameDiv);
    userInfoDiv.appendChild(timestampDiv);

    // 创建消息内容 - 支持多种消息类型
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message';

    // 根据消息类型渲染不同内容
    renderMessageContent(contentDiv, message);

    // 组装消息
    if (isOwnMessage) {
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(userInfoDiv);
    } else {
        messageDiv.appendChild(userInfoDiv);
        messageDiv.appendChild(contentDiv);
    }

    if (container) {
        container.appendChild(messageDiv);
    } else {
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }
}



/**
 * 渲染消息内容（支持文本、图片、混合类型）
 */
function renderMessageContent(contentDiv, message) {
    const messageType = message.type || 'text';

    switch (messageType) {
        case 'text':
            // 纯文本消息
            contentDiv.textContent = message.message || '';
            break;

        case 'image':
            // 纯图片消息
            renderImageContent(contentDiv, message);
            break;

        case 'mixed':
            // 混合消息（文本 + 图片）
            renderMixedContent(contentDiv, message);
            break;

        default:
            // 默认按文本处理
            contentDiv.textContent = message.message || '';
            console.warn('⚠️ 未知消息类型:', messageType);
    }
}

/**
 * 渲染图片内容
 */
function renderImageContent(contentDiv, message) {
    const imageData = message.imageData;

    if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
        contentDiv.textContent = '[图片加载失败]';
        return;
    }

    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'message-images';

    imageData.forEach((imageSrc, index) => {
        if (imageSrc && imageSrc.startsWith('data:image/')) {
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'image-wrapper';

            const img = document.createElement('img');
            img.src = imageSrc;
            img.className = 'chat-image';
            img.alt = `图片 ${index + 1}`;

            // 添加点击放大功能
            img.addEventListener('click', () => {
                showImageModal(imageSrc);
            });

            // 添加加载错误处理
            img.addEventListener('error', () => {
                imageWrapper.innerHTML = '<div class="image-error">图片加载失败</div>';
            });

            imageWrapper.appendChild(img);
            imageContainer.appendChild(imageWrapper);
        }
    });

    contentDiv.appendChild(imageContainer);
}

/**
 * 渲染混合内容（文本 + 图片）
 */
function renderMixedContent(contentDiv, message) {
    // 先添加文本内容（如果有）
    if (message.message && message.message.trim()) {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message.message;
        contentDiv.appendChild(textDiv);
    }

    // 再添加图片内容（如果有）
    if (message.imageData && Array.isArray(message.imageData) && message.imageData.length > 0) {
        renderImageContent(contentDiv, message);
    }
}

/**
 * 显示图片放大模态框（支持滚轮缩放）
 */
function showImageModal(imageSrc) {
    // 缩放状态管理
    let scale = 1;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;

    const minScale = 0.1;
    const maxScale = 5;
    const scaleStep = 0.1;

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
        overflow: hidden;
    `;

    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.style.cssText = `
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        cursor: grab;
    `;

    // 创建图片
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        transition: transform 0.2s ease;
        user-select: none;
        pointer-events: none;
    `;

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
    `;

    // 关闭按钮悬停效果
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = 'rgba(255, 0, 0, 0.8)';
        closeButton.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        closeButton.style.transform = 'scale(1.1)';
    });

    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = 'rgba(0, 0, 0, 0.8)';
        closeButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        closeButton.style.transform = 'scale(1)';
    });

    // 创建缩放信息显示
    const zoomInfo = document.createElement('div');
    zoomInfo.style.cssText = `
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-weight: bold;
        z-index: 10001;
        pointer-events: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
    `;

    // 创建操作提示
    const helpInfo = document.createElement('div');
    helpInfo.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        font-size: 12px;
        text-align: center;
        z-index: 10001;
        pointer-events: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
    `;
    helpInfo.innerHTML = '滚轮缩放 | 拖拽移动 | 点击/ESC关闭';

    // 更新变换（优化性能版本）
    function updateTransform(enableTransition = true) {
        // 拖拽时禁用过渡动画以提高性能
        img.style.transition = enableTransition ? 'transform 0.2s ease' : 'none';
        img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        zoomInfo.textContent = `${Math.round(scale * 100)}%`;
    }

    // 滚轮缩放事件
    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? -scaleStep : scaleStep;
        const newScale = Math.max(minScale, Math.min(maxScale, scale + delta));

        if (newScale !== scale) {
            // 计算鼠标位置相对于图片的偏移
            const rect = imageContainer.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 计算缩放中心偏移
            const offsetX = (mouseX - centerX) / scale;
            const offsetY = (mouseY - centerY) / scale;

            scale = newScale;

            // 调整平移以保持鼠标位置为缩放中心
            translateX -= offsetX * (newScale - (scale - delta));
            translateY -= offsetY * (newScale - (scale - delta));

            updateTransform(true); // 缩放时保持过渡动画
        }
    };

    // 拖拽事件（优化性能）
    const handleMouseDown = (e) => {
        if (scale > 1) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            imageContainer.style.cursor = 'grabbing';

            // 开始拖拽时禁用过渡动画
            img.style.transition = 'none';
            e.preventDefault();
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && scale > 1) {
            // 使用requestAnimationFrame优化拖拽性能
            requestAnimationFrame(() => {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform(false); // 拖拽时不使用过渡动画
            });
            e.preventDefault();
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            imageContainer.style.cursor = scale > 1 ? 'grab' : 'pointer';

            // 拖拽结束后恢复过渡动画
            setTimeout(() => {
                img.style.transition = 'transform 0.2s ease';
            }, 50);
        }
    };

    // 点击关闭（只在未拖拽时触发）
    const handleClick = (e) => {
        if (!isDragging && e.target === modal) {
            closeModal();
        }
    };

    // 关闭模态框
    const closeModal = () => {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', handleKeyDown);
    };

    // ESC键关闭
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };

    // 绑定事件
    modal.addEventListener('wheel', handleWheel, { passive: false });
    imageContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    modal.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    // 关闭按钮点击事件
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止触发模态框的点击事件
        closeModal();
    });

    // 组装元素
    imageContainer.appendChild(img);
    modal.appendChild(imageContainer);
    modal.appendChild(closeButton);
    modal.appendChild(zoomInfo);
    modal.appendChild(helpInfo);
    document.body.appendChild(modal);

    // 初始化显示
    updateTransform(true);

    console.log('🖼️ 图片模态框已打开，支持滚轮缩放、拖拽和关闭按钮');
}

/**
 * 添加系统消息到界面
 * @param {string|Object} message - 消息内容或消息对象
 * @param {DocumentFragment} container - 可选的容器，用于批量添加
 */
function appendSystemMessage(message, container = null) {
    const messagesContainer = container || document.getElementById('messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-container system';

    const messageContent = document.createElement('div');
    messageContent.className = 'message';

    // 支持字符串消息和对象消息
    if (typeof message === 'string') {
        messageContent.textContent = message;
    } else if (message && message.message) {
        messageContent.textContent = message.message;
    } else {
        messageContent.textContent = '系统消息';
    }

    messageDiv.appendChild(messageContent);

    if (container) {
        container.appendChild(messageDiv);
    } else {
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }
}

/**
 * 页面卸载时的清理工作
 */
function cleanupOnExit() {
    console.log('🧹 页面卸载，开始清理...');

    try {
        // 如果WebSocket已连接，先离开聊天室
        if (chatState.isConnected && chatState.stompClient && chatState.stompClient.connected) {
            // 发送离开聊天室请求 - 根据API文档，只需要传递 roomId 和 username 参数
            fetch(`${CHAT_CONFIG.serverUrl}/api/chat/room/${CHAT_CONFIG.roomId}/leave?username=${encodeURIComponent(chatState.username)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                keepalive: true // 确保在页面卸载时也能发送请求
            }).catch(error => {
                console.error('❌ 离开聊天室失败:', error);
            });

            // 断开WebSocket连接
            chatState.stompClient.disconnect();
            console.log('✅ WebSocket连接已断开');
        }

        // 清除定时器
        if (chatState.reconnectTimer) {
            clearTimeout(chatState.reconnectTimer);
            chatState.reconnectTimer = null;
        }

        console.log('✅ 清理完成');

    } catch (error) {
        console.error('❌ 清理过程中出错:', error);
    }
}

// 绑定页面卸载事件
window.addEventListener('beforeunload', cleanupOnExit);

// 手动断开连接的函数（供外部调用）
window.disconnectChatRoom = function() {
    cleanupOnExit();
    chatState.isConnected = false;
    chatState.isConnecting = false;
    updateConnectionStatus('已断开连接');
};

// 手动重连的函数（供外部调用）
window.reconnectChatRoom = function() {
    if (!chatState.isConnected && !chatState.isConnecting) {
        chatState.reconnectAttempts = 0; // 重置重连次数
        connectToServer();
    }
};

// 与窗口管理器建立关联
if (window.chatRoomWindow) {
    // 将当前聊天室实例传递给窗口管理器
    const chatRoomInstance = {
        cleanup: cleanupOnExit,
        connect: connectToServer,
        disconnect: () => {
            if (chatState.stompClient && chatState.stompClient.connected) {
                chatState.stompClient.disconnect();
            }
        },
        getState: () => chatState,
        getConfig: () => CHAT_CONFIG
    };

    window.chatRoomWindow.setChatRoomInstance(chatRoomInstance);
    console.log('🔗 聊天室实例已与窗口管理器关联');
}

/**
 * 设置图片上传按钮
 */
function setupImageUploadButton() {
    // 创建隐藏的文件输入框
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // 创建图片上传按钮
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'emoji-btn image-upload-btn';
    uploadBtn.innerHTML = '<img src="../images/ImageUpload.png" alt="上传图片" />';
    uploadBtn.title = '上传图片';

    // 悬停效果已在CSS中定义，无需额外JavaScript

    // 点击上传按钮
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // 文件选择事件
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleImageFiles(files);
        }
        // 清空文件输入框，允许重复选择同一文件
        fileInput.value = '';
    });

    // 将按钮添加到输入区域
    const inputArea = document.querySelector('.input-area');
    if (inputArea) {
        const emojiTools = inputArea.querySelector('.emoji-tools');
        if (emojiTools) {
            emojiTools.appendChild(uploadBtn);
        }
    }

    console.log('✅ 图片上传按钮已设置');
}

/**
 * 设置表情选择面板事件监听器
 */
function setupEmojiPanel() {
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPanel = document.getElementById('emoji-panel');
    const messageInput = document.getElementById('messageInput');

    console.log('🎭 开始设置表情面板...');
    console.log('表情按钮:', emojiBtn);
    console.log('表情面板:', emojiPanel);
    console.log('消息输入框:', messageInput);

    if (!emojiBtn || !emojiPanel || !messageInput) {
        console.warn('⚠️ 表情面板元素未找到，跳过设置');
        console.warn('缺失元素:', {
            emojiBtn: !emojiBtn,
            emojiPanel: !emojiPanel,
            messageInput: !messageInput
        });
        return;
    }

    // 表情按钮点击事件 - 显示/隐藏表情面板
    emojiBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        emojiPanel.classList.toggle('show');
        const isVisible = emojiPanel.classList.contains('show');
        console.log('🎭 表情面板切换显示状态:', isVisible ? '显示' : '隐藏');
        console.log('表情面板当前样式:', {
            display: window.getComputedStyle(emojiPanel).display,
            zIndex: window.getComputedStyle(emojiPanel).zIndex,
            position: window.getComputedStyle(emojiPanel).position,
            visibility: window.getComputedStyle(emojiPanel).visibility,
            bottom: window.getComputedStyle(emojiPanel).bottom,
            left: window.getComputedStyle(emojiPanel).left
        });

        // 确保面板正确显示
        if (isVisible) {
            console.log('✅ 表情面板已显示');
        } else {
            console.log('✅ 表情面板已隐藏');
        }
    });

    // 表情分类切换事件
    document.querySelectorAll('.emoji-category').forEach(category => {
        category.addEventListener('click', () => {
            // 移除所有分类的active状态
            document.querySelectorAll('.emoji-category').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.emoji-section').forEach(s => s.classList.remove('active'));

            // 激活当前分类
            category.classList.add('active');
            const targetSection = document.getElementById(`${category.dataset.category}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            console.log('🎭 切换表情分类:', category.dataset.category);
        });
    });

    // 表情项点击事件
    document.querySelectorAll('.emoji-item, .kaomoji-item').forEach(item => {
        item.addEventListener('click', () => {
            const emoji = item.getAttribute('data-emoji');
            if (emoji) {
                insertTextAtCursor(messageInput, emoji);
                updateSendButtonState();
                updatePlaceholderDisplay();
                emojiPanel.classList.remove('show');
                console.log('🎭 插入表情:', emoji);
            }
        });
    });

    // 点击其他地方关闭表情面板
    document.addEventListener('click', function (e) {
        if (!emojiPanel.contains(e.target) && e.target !== emojiBtn && !emojiBtn.contains(e.target)) {
            emojiPanel.classList.remove('show');
        }
    });

    console.log('✅ 表情选择面板事件监听器已设置');
}

/**
 * 在可编辑元素的光标位置插入文本
 * @param {HTMLElement} element - 可编辑的DOM元素（如contenteditable的div）
 * @param {string} text - 要插入的文本
 */
function insertTextAtCursor(element, text) {
    if (!element || !text) return;

    element.focus();
    const selection = window.getSelection();
    let range;

    if (!selection.rangeCount) {
        // 如果没有选区，创建一个在元素末尾的选区
        range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        range = selection.getRangeAt(0);
    }

    // 确保选区在目标元素内
    if (!element.contains(range.commonAncestorContainer)) {
        range.selectNodeContents(element);
        range.collapse(false);
    }

    // 创建文本节点并插入
    const textNode = document.createTextNode(text);
    range.deleteContents();
    range.insertNode(textNode);

    // 移动光标到插入文本后面
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    console.log('📝 在光标位置插入文本:', text);
}

/**
 * 处理图片粘贴事件
 */
function handleImagePaste(e) {
    e.preventDefault();

    // 处理粘贴的文本
    const text = e.clipboardData.getData('text/plain');
    if (text) {
        document.execCommand('insertText', false, text);
        console.log('📋 插入粘贴文本:', text);
    }

    // 处理粘贴的图片
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                handleSingleImageFile(file);
                console.log('📋 检测到粘贴图片:', file.name);
            }
        }
    }
}

/**
 * 处理拖拽悬停事件
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // 添加拖拽悬停样式
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.style.borderColor = 'var(--primary-color)';
        messageInput.style.background = 'rgba(var(--primary-color-rgb), 0.1)';
    }
}

/**
 * 处理图片拖拽放置事件
 */
function handleImageDrop(e) {
    e.preventDefault();

    // 恢复输入框样式
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.style.borderColor = '';
        messageInput.style.background = '';
    }

    const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/')
    );

    if (files.length > 0) {
        handleImageFiles(files);
        console.log('🖱️ 检测到拖拽图片:', files.length, '张');
    }
}

/**
 * 处理单个图片文件（用于粘贴）
 */
async function handleSingleImageFile(file) {
    try {
        // 检查文件大小，超过1MB自动压缩
        let imageData;
        if (file.size > 1024 * 1024) { // 1MB
            console.log(`📦 图片 "${file.name}" 大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB，开始压缩...`);
            imageData = await compressImage(file);
            console.log(`✅ 图片压缩完成`);
        } else {
            imageData = await readFileAsDataURL(file);
        }

        insertImageToInput(imageData, file.name);
    } catch (error) {
        console.error('处理图片失败:', error);
        showSystemMessage(`处理图片 "${file.name}" 失败: ${error.message}`, 'error');
    }
}

/**
 * 处理图片文件（用于上传和拖拽）
 */
async function handleImageFiles(files) {
    for (const file of files) {
        await handleSingleImageFile(file);
    }
}

/**
 * 将图片插入到输入框
 */
function insertImageToInput(imageData, fileName) {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    // 创建图片元素
    const img = document.createElement('img');
    img.src = imageData;
    img.dataset.imageData = imageData;
    img.style.maxWidth = '200px';
    img.style.cursor = 'pointer';
    img.alt = fileName;
    img.title = fileName; // 鼠标悬停显示文件名

    // 添加点击预览功能
    img.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        showImageModal(imageData);
        console.log('🖼️ 点击预览输入框图片');
    };

    // 将图片插入到光标位置
    const selection = window.getSelection();
    let range;

    if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
    } else {
        // 如果没有选区，创建一个在输入框末尾的选区
        range = document.createRange();
        range.selectNodeContents(messageInput);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    range.insertNode(img);

    // 移动光标到图片后面
    range.setStartAfter(img);
    range.setEndAfter(img);
    selection.removeAllRanges();
    selection.addRange(range);

    // 添加一个空格，方便后续编辑
    document.execCommand('insertText', false, ' ');

    // 更新状态
    updateSendButtonState();
    updatePlaceholderDisplay();

    console.log('🖼️ 图片已添加到输入框:', fileName);
}

/**
 * 读取文件为DataURL
 * @param {File} file - 文件对象
 * @returns {Promise<string>} DataURL字符串
 */
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 压缩图片到指定大小
 * @param {File} file - 图片文件
 * @param {number} [maxSizeInMB=1] - 目标最大文件大小（MB）
 * @returns {Promise<string>} 压缩后的DataURL字符串
 */
async function compressImage(file, maxSizeInMB = 1) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (e) {
            const img = new Image();
            img.src = e.target.result;

            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 限制最大尺寸为1920px
                if (width > 1920 || height > 1920) {
                    const ratio = Math.min(1920 / width, 1920 / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.9;
                const maxSize = maxSizeInMB * 1024 * 1024;

                function attemptCompress() {
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const binaryData = atob(dataUrl.split(',')[1]);
                    const size = binaryData.length;

                    if (size > maxSize && quality > 0.1) {
                        quality -= 0.1;
                        attemptCompress(); // 递归调用
                    } else {
                        resolve(dataUrl);
                    }
                }
                attemptCompress();
            };
        };
    });
}

/**
 * 设置用户列表收起/展开功能
 */
function setupUserListToggle() {
    const toggleBtn = document.getElementById('userListToggle');
    const sidebar = document.querySelector('.chat-sidebar');

    if (!toggleBtn || !sidebar) {
        console.warn('⚠️ 用户列表收起按钮或侧边栏不存在');
        return;
    }

    // 从localStorage恢复用户偏好设置
    const isCollapsed = localStorage.getItem('userListCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }

    // 绑定点击事件
    toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleUserList();
    });

    // 也可以点击标题来切换
    const sidebarTitle = sidebar.querySelector('h3');
    if (sidebarTitle) {
        sidebarTitle.addEventListener('click', function(e) {
            // 如果点击的是按钮，不处理（避免重复触发）
            if (e.target.closest('.sidebar-toggle-btn')) {
                return;
            }
            toggleUserList();
        });
    }

    console.log('✅ 用户列表收起/展开功能已设置');
}

/**
 * 切换用户列表的收起/展开状态
 */
function toggleUserList() {
    const sidebar = document.querySelector('.chat-sidebar');
    if (!sidebar) {
        console.warn('⚠️ 侧边栏不存在');
        return;
    }

    const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');

    if (isCurrentlyCollapsed) {
        // 展开用户列表（向右展开）
        sidebar.classList.remove('collapsed');
        localStorage.setItem('userListCollapsed', 'false');
        console.log('📂 用户列表已向右展开');
    } else {
        // 收起用户列表（向左收起）
        sidebar.classList.add('collapsed');
        localStorage.setItem('userListCollapsed', 'true');
        console.log('📁 用户列表已向左收起');
    }
}

/**
 * 设置右键菜单功能
 */
function setupContextMenu() {
    const messagesContainer = document.getElementById('messages');
    const contextMenu = document.getElementById('chat-context-menu');
    const clearChatItem = contextMenu?.querySelector('.clear-chat');

    if (!messagesContainer || !contextMenu || !clearChatItem) {
        console.warn('⚠️ 右键菜单相关元素不存在');
        return;
    }

    // 右键点击事件监听器
    messagesContainer.addEventListener('contextmenu', function(e) {
        e.preventDefault(); // 阻止默认右键菜单
        showContextMenu(e.clientX, e.clientY);
    });

    // 清空聊天记录点击事件
    clearChatItem.addEventListener('click', function() {
        hideContextMenu();
        clearChatHistory();
    });

    // 点击其他地方隐藏菜单
    document.addEventListener('click', function(e) {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // ESC键隐藏菜单
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });

    console.log('✅ 右键菜单功能已设置');
}

/**
 * 显示右键菜单
 * @param {number} x - 鼠标X坐标
 * @param {number} y - 鼠标Y坐标
 */
function showContextMenu(x, y) {
    const contextMenu = document.getElementById('chat-context-menu');
    if (!contextMenu) return;

    // 设置菜单位置
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';

    // 确保菜单不会超出屏幕边界
    const rect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
        contextMenu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > viewportHeight) {
        contextMenu.style.top = (y - rect.height) + 'px';
    }

    // 显示菜单
    contextMenu.classList.add('show');
    console.log('📋 右键菜单已显示');
}

/**
 * 隐藏右键菜单
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('chat-context-menu');
    if (!contextMenu) return;

    contextMenu.classList.remove('show');
}

/**
 * 清空聊天历史记录
 */
function clearChatHistory() {
    // 显示确认对话框
    if (!confirm('确定要清空所有聊天记录吗？此操作不可撤销。')) {
        return;
    }

    try {
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            // 清空消息容器
            messagesContainer.innerHTML = '';
            console.log('🗑️ 聊天记录已清空');

            // 显示清空成功的系统消息
            showSystemMessage('聊天记录已清空', 'info');
        }
    } catch (error) {
        console.error('❌ 清空聊天记录失败:', error);
        showSystemMessage('清空聊天记录失败: ' + error.message, 'error');
    }
}

/**
 * 关闭用户名修改模态框
 */
function closeUsernameModal() {
    const usernameModal = document.getElementById('username-modal');
    if (usernameModal) {
        usernameModal.style.display = 'none';
        console.log('❌ 用户名修改模态框已关闭');
    }
}

/**
 * 确认用户名修改
 */
async function confirmUsernameChange() {
    const newUsernameInput = document.getElementById('new-username');
    const usernameConfirmBtn = document.getElementById('username-confirm-btn');

    if (!newUsernameInput) {
        console.error('❌ 用户名输入框未找到');
        return;
    }

    const newUsername = newUsernameInput.value.trim();

    // 基本验证
    if (!newUsername) {
        alert('用户名不能为空');
        return;
    }

    if (newUsername === chatState.username) {
        alert('新用户名与当前用户名相同');
        return;
    }

    // 检查用户名长度
    if (newUsername.length > 20) {
        alert('用户名不能超过20个字符');
        return;
    }

    // 检查用户名是否包含特殊字符
    if (!/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/.test(newUsername)) {
        alert('用户名只能包含字母、数字、中文、下划线和短横线');
        return;
    }

    // 显示加载状态
    if (usernameConfirmBtn) {
        usernameConfirmBtn.disabled = true;
        usernameConfirmBtn.textContent = '验证中...';
    }

    try {
        console.log('🔄 开始验证用户名:', chatState.username, '->', newUsername);

        // 调用服务器用户名校验接口
        const verifyResponse = await fetch(`${CHAT_CONFIG.serverUrl}/api/chat/verify-username?username=${encodeURIComponent(newUsername)}&oldUsername=${encodeURIComponent(chatState.username)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const verifyResult = await verifyResponse.json();

        if (verifyResult.code !== 200) {
            // 用户名校验失败
            alert(verifyResult.msg || verifyResult.message || '用户名校验失败');
            return;
        }

        console.log('✅ 用户名校验通过');

        // 更新本地状态
        const oldUsername = chatState.username;
        chatState.username = newUsername;
        localStorage.setItem('chatUsername', newUsername);

        // 更新UI显示
        updateUsernameDisplay();

        // 如果已连接，发送用户名变更消息
        if (chatState.isConnected && chatState.stompClient) {
            try {
                const changeMessage = {
                    type: 'username_change',
                    oldUsername: oldUsername,
                    newUsername: newUsername,
                    userId: chatState.userId,
                    timestamp: new Date().toISOString()
                };

                chatState.stompClient.send('/app/chat/' + CHAT_CONFIG.roomId, {}, JSON.stringify(changeMessage));
                console.log('✅ 用户名变更消息已发送');
            } catch (error) {
                console.error('❌ 发送用户名变更消息失败:', error);
            }
        }

        // 关闭模态框
        closeUsernameModal();

        console.log('✅ 用户名修改完成');

    } catch (error) {
        console.error('❌ 用户名校验失败:', error);
        alert('用户名校验失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        if (usernameConfirmBtn) {
            usernameConfirmBtn.disabled = false;
            usernameConfirmBtn.textContent = '确认';
        }
    }
}

/**
 * 关闭系统消息模态框
 */
function closeMessageModal() {
    const messageModal = document.getElementById('message-modal');
    if (messageModal) {
        messageModal.style.display = 'none';
        console.log('❌ 系统消息模态框已关闭');
    }
}

/**
 * 设置用户名修改模态框事件
 */
function setupUsernameModalEvents() {
    // 编辑用户名按钮
    const editUsernameBtn = document.getElementById('edit-username-btn');
    if (editUsernameBtn) {
        editUsernameBtn.addEventListener('click', changeUsername);
        console.log('✅ 用户名编辑按钮事件已绑定');
    }

    // 用户名模态框关闭按钮
    const usernameCloseBtn = document.getElementById('username-close-btn');
    if (usernameCloseBtn) {
        usernameCloseBtn.addEventListener('click', closeUsernameModal);
        console.log('✅ 用户名关闭按钮事件已绑定');
    }

    // 用户名模态框取消按钮
    const usernameCancelBtn = document.getElementById('username-cancel-btn');
    if (usernameCancelBtn) {
        usernameCancelBtn.addEventListener('click', closeUsernameModal);
        console.log('✅ 用户名取消按钮事件已绑定');
    }

    // 用户名模态框确认按钮
    const usernameConfirmBtn = document.getElementById('username-confirm-btn');
    if (usernameConfirmBtn) {
        usernameConfirmBtn.addEventListener('click', confirmUsernameChange);
        console.log('✅ 用户名确认按钮事件已绑定');
    }

    // 用户名输入框回车事件
    const newUsernameInput = document.getElementById('new-username');
    if (newUsernameInput) {
        newUsernameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmUsernameChange();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeUsernameModal();
            }
        });
        console.log('✅ 用户名输入框键盘事件已绑定');
    }

    // 点击模态框背景关闭
    const usernameModal = document.getElementById('username-modal');
    if (usernameModal) {
        usernameModal.addEventListener('click', function(e) {
            if (e.target === usernameModal) {
                closeUsernameModal();
            }
        });
        console.log('✅ 用户名模态框背景点击事件已绑定');
    }
}

/**
 * 设置系统消息模态框事件
 */
function setupMessageModalEvents() {
    // 系统消息模态框关闭按钮
    const messageModalCloseBtn = document.getElementById('message-modal-close-btn');
    if (messageModalCloseBtn) {
        messageModalCloseBtn.addEventListener('click', closeMessageModal);
        console.log('✅ 系统消息关闭按钮事件已绑定');
    }

    // 系统消息模态框确认按钮
    const messageModalConfirmBtn = document.getElementById('message-modal-confirm-btn');
    if (messageModalConfirmBtn) {
        messageModalConfirmBtn.addEventListener('click', closeMessageModal);
        console.log('✅ 系统消息确认按钮事件已绑定');
    }

    // 点击模态框背景关闭
    const messageModal = document.getElementById('message-modal');
    if (messageModal) {
        messageModal.addEventListener('click', function(e) {
            if (e.target === messageModal) {
                closeMessageModal();
            }
        });
        console.log('✅ 系统消息模态框背景点击事件已绑定');
    }

    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const messageModal = document.getElementById('message-modal');
            const usernameModal = document.getElementById('username-modal');

            if (messageModal && messageModal.style.display !== 'none') {
                closeMessageModal();
            } else if (usernameModal && usernameModal.style.display !== 'none') {
                closeUsernameModal();
            }
        }
    });
}

console.log('🎯 聊天室主程序加载完成，等待DOM加载...');
