/**
 * 聊天室窗口管理类
 * 职责：只负责窗口的创建、显示、隐藏、大小调整等窗口相关操作
 * 不负责聊天室的具体业务逻辑（业务逻辑由 chatRoom-main.js 处理）
 */
class ChatRoomWindow {
    constructor() {
        this.windowConfig = {
            width: 900,
            height: 700,
            minWidth: 600,
            minHeight: 700,
            title: '在线聊天室'
        };
        
        this.isWindowMode = false;
        this.isInitialized = false;
        this.chatRoomInstance = null; // 聊天室业务逻辑实例的引用
        
        console.log('🪟 聊天室窗口管理器初始化');
        this.init();
    }

    /**
     * 初始化窗口管理器
     */
    init() {
        if (this.isInitialized) {
            console.log('⚠️ 窗口管理器已初始化');
            return;
        }

        try {
            // 检测运行环境
            this.detectEnvironment();
            
            // 设置窗口样式
            this.setupWindowStyles();
            
            // 绑定窗口事件
            this.bindWindowEvents();
            
            this.isInitialized = true;
            console.log('✅ 聊天室窗口管理器初始化完成');
        } catch (error) {
            console.error('❌ 窗口管理器初始化失败:', error);
        }
    }

    /**
     * 检测运行环境
     */
    detectEnvironment() {
        // 检测是否在新窗口模式下运行
        this.isWindowMode = window.location.protocol === 'chrome-extension:' && 
                           window.opener === null && 
                           window.parent === window;
        
        if (this.isWindowMode) {
            console.log('🪟 检测到新窗口模式');
            this.setupWindowMode();
        } else {
            console.log('📱 检测到嵌入模式');
            this.setupEmbeddedMode();
        }
    }

    /**
     * 设置新窗口模式
     */
    setupWindowMode() {
        // 隐藏聊天图标按钮
        const chatIconBtn = document.querySelector('.chat-icon-btn');
        if (chatIconBtn) {
            chatIconBtn.style.display = 'none';
        }
        
        // 显示聊天模态框并调整为全屏
        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
            chatModal.style.display = 'flex';
            chatModal.style.position = 'static';
            chatModal.style.background = 'none';
            chatModal.style.width = '100%';
            chatModal.style.height = '100vh';
            chatModal.style.padding = '0';
            chatModal.style.margin = '0';
        }
        
        // 调整模态框内容
        const modalContent = chatModal?.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.width = '100%';
            modalContent.style.height = '100%';
            modalContent.style.maxWidth = 'none';
            modalContent.style.maxHeight = 'none';
            modalContent.style.borderRadius = '0';
            modalContent.style.margin = '0';
        }
        
        // 设置窗口标题
        document.title = this.windowConfig.title;
        
        console.log('✅ 新窗口模式设置完成');
    }

    /**
     * 设置嵌入模式
     */
    setupEmbeddedMode() {
        // 显示聊天图标按钮
        const chatIconBtn = document.querySelector('.chat-icon-btn');
        if (chatIconBtn) {
            chatIconBtn.style.display = 'block';
        }
        
        console.log('✅ 嵌入模式设置完成');
    }

    /**
     * 设置窗口样式
     */
    setupWindowStyles() {
        if (this.isWindowMode) {
            // 新窗口模式的样式调整
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            
            // 添加窗口模式专用样式
            const style = document.createElement('style');
            style.textContent = `
                .chat-header {
                    padding: 10px 20px !important;
                }
                
                .chat-header h2 {
                    color: white !important;
                }
                
                .chat-container {
                    height: calc(100vh - 80px) !important;
                }
                
                .messages {
                    height: calc(100% - 80px) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 绑定窗口事件
     */
    bindWindowEvents() {
        // 窗口大小调整事件
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // 窗口关闭事件
        window.addEventListener('beforeunload', () => {
            this.handleWindowClose();
        });
        
        // ESC键关闭窗口（仅在新窗口模式下）
        if (this.isWindowMode) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeWindow();
                }
            });
        }
        
        console.log('✅ 窗口事件绑定完成');
    }

    /**
     * 处理窗口大小调整
     */
    handleWindowResize() {
        if (this.isWindowMode) {
            // 在新窗口模式下，确保聊天室占满整个窗口
            const chatModal = document.getElementById('chat-modal');
            if (chatModal) {
                chatModal.style.width = '100%';
                chatModal.style.height = '100vh';
            }
        }
    }

    /**
     * 处理窗口关闭
     */
    handleWindowClose() {
        console.log('🪟 窗口即将关闭，执行清理...');
        
        // 通知聊天室业务逻辑进行清理
        if (this.chatRoomInstance && typeof this.chatRoomInstance.cleanup === 'function') {
            this.chatRoomInstance.cleanup();
        }
        
        // 如果有全局的清理函数，也调用它
        if (typeof window.cleanupOnExit === 'function') {
            window.cleanupOnExit();
        }
    }

    /**
     * 显示聊天室窗口
     */
    showWindow() {
        if (this.isWindowMode) {
            // 新窗口模式下，窗口已经显示
            console.log('🪟 新窗口模式，窗口已显示');
        } else {
            // 嵌入模式下，显示模态框
            const chatModal = document.getElementById('chat-modal');
            if (chatModal) {
                chatModal.style.display = 'flex';
                console.log('📱 嵌入模式，显示聊天模态框');
            }
        }
    }

    /**
     * 隐藏聊天室窗口
     */
    hideWindow() {
        if (this.isWindowMode) {
            // 新窗口模式下，关闭窗口
            this.closeWindow();
        } else {
            // 嵌入模式下，隐藏模态框
            const chatModal = document.getElementById('chat-modal');
            if (chatModal) {
                chatModal.style.display = 'none';
                console.log('📱 嵌入模式，隐藏聊天模态框');
            }
        }
    }

    /**
     * 关闭窗口
     */
    closeWindow() {
        if (this.isWindowMode) {
            console.log('🪟 关闭新窗口');
            window.close();
        } else {
            this.hideWindow();
        }
    }

    /**
     * 设置聊天室业务逻辑实例的引用
     */
    setChatRoomInstance(instance) {
        this.chatRoomInstance = instance;
        console.log('🔗 聊天室业务逻辑实例已关联');
    }

    /**
     * 获取窗口配置
     */
    getWindowConfig() {
        return { ...this.windowConfig };
    }

    /**
     * 更新窗口配置
     */
    updateWindowConfig(config) {
        this.windowConfig = { ...this.windowConfig, ...config };
        console.log('⚙️ 窗口配置已更新:', this.windowConfig);
    }
}

// 创建全局窗口管理器实例
window.chatRoomWindow = new ChatRoomWindow();

console.log('🎯 聊天室窗口管理器加载完成');
