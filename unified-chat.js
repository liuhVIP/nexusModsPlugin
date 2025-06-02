/**
 * 统一聊天窗口管理器
 * 负责管理AI聊天和聊天室的标签切换和功能集成
 */

class UnifiedChatManager {
    constructor() {
        this.currentTab = 'ai-chat';
        this.aiChatLoaded = false;
        this.chatroomLoaded = false;
        this.modData = null; // 存储传入的模组数据
        
        console.log('🚀 统一聊天窗口管理器初始化');
        this.init();
    }

    /**
     * 初始化管理器
     */
    init() {
        this.setupTabSwitching();
        this.setupMessageListener();
        this.loadAIChat();
        
        // 监听窗口关闭事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * 设置标签切换功能
     */
    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // 更新按钮状态
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // 更新内容显示
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(targetTab).classList.add('active');
                
                // 切换标签时的处理
                this.switchTab(targetTab);
            });
        });
    }

    /**
     * 切换标签处理
     */
    switchTab(tabName) {
        console.log(`🔄 切换到标签: ${tabName}`);
        this.currentTab = tabName;

        if (tabName === 'ai-chat') {
            if (!this.aiChatLoaded) {
                this.loadAIChat();
            }
        } else if (tabName === 'chatroom') {
            if (!this.chatroomLoaded) {
                this.loadChatroom();
            }
        }
    }

    /**
     * 加载AI聊天功能
     */
    loadAIChat() {
        console.log('📱 加载AI聊天功能');

        try {
            const aiChatFrame = document.getElementById('aiChatFrame');
            if (aiChatFrame) {
                // 使用iframe加载AI聊天页面
                aiChatFrame.src = chrome.runtime.getURL('chat.html');
                this.aiChatLoaded = true;
                console.log('✅ AI聊天功能加载完成');

                // 监听iframe加载完成事件
                aiChatFrame.onload = () => {
                    console.log('🎯 AI聊天iframe加载完成');

                    // 如果有模组数据，初始化AI聊天
                    if (this.modData) {
                        this.initAIChat(this.modData);
                    }
                };
            }
        } catch (error) {
            console.error('❌ AI聊天功能加载失败:', error);
        }
    }

    /**
     * 加载聊天室功能
     */
    loadChatroom() {
        console.log('💬 加载聊天室功能');
        
        try {
            const chatroomFrame = document.getElementById('chatroomFrame');
            if (chatroomFrame) {
                // 使用iframe加载聊天室
                chatroomFrame.src = chrome.runtime.getURL('chatroom/chatRoom.html');
                this.chatroomLoaded = true;
                console.log('✅ 聊天室功能加载完成');
            }
        } catch (error) {
            console.error('❌ 聊天室功能加载失败:', error);
        }
    }

    /**
     * 设置消息监听器
     */
    setupMessageListener() {
        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 收到消息:', message);
            
            if (message.action === 'initAIChat') {
                this.modData = message.modData;
                
                // 如果当前在AI聊天标签且已加载，直接初始化
                if (this.currentTab === 'ai-chat' && this.aiChatLoaded) {
                    this.initAIChat(message.modData);
                } else {
                    // 切换到AI聊天标签
                    this.switchToAIChat();
                }
                sendResponse({ success: true });
            } else if (message.action === 'switchToChatroom') {
                this.switchToChatroom();
                sendResponse({ success: true });
            }
            
            return true; // 保持消息通道开放
        });
    }

    /**
     * 切换到AI聊天标签
     */
    switchToAIChat() {
        const aiChatButton = document.querySelector('[data-tab="ai-chat"]');
        if (aiChatButton) {
            aiChatButton.click();
        }
    }

    /**
     * 切换到聊天室标签
     */
    switchToChatroom() {
        const chatroomButton = document.querySelector('[data-tab="chatroom"]');
        if (chatroomButton) {
            chatroomButton.click();
        }
    }

    /**
     * 初始化AI聊天
     */
    initAIChat(modData) {
        console.log('🤖 初始化AI聊天，模组数据:', modData);

        // 确保AI聊天功能已加载
        if (!this.aiChatLoaded) {
            this.loadAIChat();
            // 延迟初始化
            setTimeout(() => this.initAIChat(modData), 500);
            return;
        }

        // 向AI聊天iframe发送模组数据
        const aiChatFrame = document.getElementById('aiChatFrame');
        if (aiChatFrame && aiChatFrame.contentWindow) {
            try {
                // 等待iframe完全加载后再发送消息
                setTimeout(() => {
                    aiChatFrame.contentWindow.postMessage({
                        action: 'initModData',
                        modData: modData
                    }, '*');
                    console.log('📤 已向AI聊天iframe发送模组数据');
                }, 1000);
            } catch (error) {
                console.error('❌ 向AI聊天iframe发送消息失败:', error);
            }
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        console.log('🧹 清理统一聊天窗口资源');

        // 清理AI聊天资源
        const aiChatFrame = document.getElementById('aiChatFrame');
        if (aiChatFrame && aiChatFrame.contentWindow) {
            try {
                // 通知iframe内的AI聊天进行清理
                aiChatFrame.contentWindow.postMessage({ action: 'cleanup' }, '*');
            } catch (error) {
                console.warn('清理AI聊天资源时出错:', error);
            }
        }

        // 清理聊天室资源
        const chatroomFrame = document.getElementById('chatroomFrame');
        if (chatroomFrame && chatroomFrame.contentWindow) {
            try {
                // 通知iframe内的聊天室进行清理
                chatroomFrame.contentWindow.postMessage({ action: 'cleanup' }, '*');
            } catch (error) {
                console.warn('清理聊天室资源时出错:', error);
            }
        }
    }

    /**
     * 获取当前活动标签
     */
    getCurrentTab() {
        return this.currentTab;
    }

    /**
     * 设置窗口标题
     */
    setWindowTitle(title) {
        document.title = title;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.unifiedChatManager = new UnifiedChatManager();
});

// 导出给其他脚本使用
window.UnifiedChatManager = UnifiedChatManager;
