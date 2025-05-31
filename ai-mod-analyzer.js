// AI模组分析器

// 检查是否已存在，如果存在则跳过执行
if (window.AIModAnalyzer) {
    console.log('AIModAnalyzer 已加载，跳过重复执行');
} else {

class AIModAnalyzer {
    constructor() {
        this.analyzeButton = null;
        this.isOpeningWindow = false;
        this.windowOpenTimeout = null;
        this.setupWindowListener();
    }

    // 设置窗口监听
    setupWindowListener() {
        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'chatWindowClosed') {
                // console.log('收到窗口关闭消息，重置状态');
                this.resetWindowState();
            }
        });
    }

    // 初始化分析器
    init() {
        this.createAnalyzeButton();
        // 事件监听器应该只添加一次，在 createAnalyzeButton 中处理
        // this.addEventListeners();
    }

    // 创建分析按钮
    createAnalyzeButton() {
        // 查找 tabs 容器
        const tabsContainer = document.querySelector('.tabs');
        if (!tabsContainer) {
            console.error('未找到 tabs 容器');
            return;
        }

        // 检查按钮是否已经存在
        if (tabsContainer.querySelector('.ai-analyze-button')) {
            // console.log('AI分析按钮已存在，跳过创建');
            // 如果按钮已经存在，查找并设置 this.analyzeButton
            this.analyzeButton = tabsContainer.querySelector('.ai-analyze-button');
            // 确保事件监听器已添加（处理页面动态加载后按钮还在但事件丢失的情况）
             this.addEventListeners();
            return;
        }

        // 查找 modtabs 列表
        const modTabs = tabsContainer.querySelector('.modtabs');
        if (!modTabs) {
            console.error('未找到 modtabs 列表');
            return;
        }

        // 创建新的列表项
        const listItem = document.createElement('li');
        listItem.id = 'mod-page-tab-ai-analyze';

        // 创建按钮
        this.analyzeButton = document.createElement('a');
        this.analyzeButton.href = '#';
        this.analyzeButton.className = 'ai-analyze-button';
        this.analyzeButton.innerHTML = `
            <span class="ai-button-icon">🤖</span>
            <span class="ai-button-text">AI分析模组</span>
            <span class="ai-button-glow"></span>
        `;

        // 现代化样式设计 - 专业深色系
        this.analyzeButton.style.cssText = `
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
        `;

        // 添加CSS动画样式到页面
        this.addButtonStyles();

        // 添加悬停和点击效果 - 专业深色系
        this.analyzeButton.onmouseenter = () => {
            this.analyzeButton.style.transform = 'translateY(-2px) scale(1.05)';
            this.analyzeButton.style.boxShadow = '0 8px 25px rgba(20, 23, 37, 0.8), 0 4px 15px rgba(50, 55, 114, 0.4)';
            this.analyzeButton.style.background = 'linear-gradient(135deg, #323772 0%, #4a5299 100%)';
            this.analyzeButton.style.borderColor = 'rgba(50, 55, 114, 0.6)';
        };

        this.analyzeButton.onmouseleave = () => {
            this.analyzeButton.style.transform = 'translateY(0) scale(1)';
            this.analyzeButton.style.boxShadow = '0 4px 15px rgba(20, 23, 37, 0.6), 0 2px 8px rgba(50, 55, 114, 0.2)';
            this.analyzeButton.style.background = 'linear-gradient(135deg, #141725 0%, #323772 100%)';
            this.analyzeButton.style.borderColor = 'rgba(50, 55, 114, 0.3)';
        };

        this.analyzeButton.onmousedown = () => {
            this.analyzeButton.style.transform = 'translateY(1px) scale(0.98)';
            this.analyzeButton.style.background = 'linear-gradient(135deg, #0f1219 0%, #2a2f5f 100%)';
        };

        this.analyzeButton.onmouseup = () => {
            this.analyzeButton.style.transform = 'translateY(-2px) scale(1.05)';
            this.analyzeButton.style.background = 'linear-gradient(135deg, #323772 0%, #4a5299 100%)';
        };

        // 将按钮添加到列表项中
        listItem.appendChild(this.analyzeButton);

        // 将列表项添加到 modtabs 列表的末尾
        modTabs.appendChild(listItem);

        // 添加事件监听器
        this.addEventListeners();
    }

    // 添加按钮样式和动画
    addButtonStyles() {
        // 检查是否已经添加过样式
        if (document.getElementById('ai-button-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'ai-button-styles';
        style.textContent = `
            /* AI分析按钮动画样式 - 专业深色系 */
            @keyframes ai-pulse {
                0% {
                    box-shadow: 0 4px 15px rgba(20, 23, 37, 0.6), 0 2px 8px rgba(50, 55, 114, 0.2);
                }
                50% {
                    box-shadow: 0 6px 20px rgba(20, 23, 37, 0.8), 0 4px 12px rgba(50, 55, 114, 0.4);
                }
                100% {
                    box-shadow: 0 4px 15px rgba(20, 23, 37, 0.6), 0 2px 8px rgba(50, 55, 114, 0.2);
                }
            }

            @keyframes ai-glow {
                0% {
                    opacity: 0;
                    transform: scale(0.8);
                }
                50% {
                    opacity: 0.6;
                    transform: scale(1.2);
                }
                100% {
                    opacity: 0;
                    transform: scale(1.5);
                }
            }

            @keyframes ai-icon-rotate {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }

            @keyframes ai-shimmer {
                0% {
                    background-position: -200% 0;
                }
                100% {
                    background-position: 200% 0;
                }
            }

            @keyframes ai-border-flow {
                0% {
                    border-image-source: linear-gradient(90deg,
                        rgba(50, 55, 114, 0.3) 0%,
                        rgba(74, 82, 153, 0.8) 25%,
                        rgba(106, 115, 204, 1) 50%,
                        rgba(74, 82, 153, 0.8) 75%,
                        rgba(50, 55, 114, 0.3) 100%);
                }
                25% {
                    border-image-source: linear-gradient(90deg,
                        rgba(74, 82, 153, 0.8) 0%,
                        rgba(106, 115, 204, 1) 25%,
                        rgba(138, 148, 255, 1.2) 50%,
                        rgba(106, 115, 204, 1) 75%,
                        rgba(74, 82, 153, 0.8) 100%);
                }
                50% {
                    border-image-source: linear-gradient(90deg,
                        rgba(106, 115, 204, 1) 0%,
                        rgba(138, 148, 255, 1.2) 25%,
                        rgba(170, 180, 255, 1.5) 50%,
                        rgba(138, 148, 255, 1.2) 75%,
                        rgba(106, 115, 204, 1) 100%);
                }
                75% {
                    border-image-source: linear-gradient(90deg,
                        rgba(138, 148, 255, 1.2) 0%,
                        rgba(170, 180, 255, 1.5) 25%,
                        rgba(138, 148, 255, 1.2) 50%,
                        rgba(106, 115, 204, 1) 75%,
                        rgba(74, 82, 153, 0.8) 100%);
                }
                100% {
                    border-image-source: linear-gradient(90deg,
                        rgba(50, 55, 114, 0.3) 0%,
                        rgba(74, 82, 153, 0.8) 25%,
                        rgba(106, 115, 204, 1) 50%,
                        rgba(74, 82, 153, 0.8) 75%,
                        rgba(50, 55, 114, 0.3) 100%);
                }
            }

            @keyframes ai-glow-pulse {
                0%, 100% {
                    box-shadow:
                        0 4px 15px rgba(20, 23, 37, 0.6),
                        0 2px 8px rgba(50, 55, 114, 0.2),
                        0 0 0 1px rgba(50, 55, 114, 0.3);
                }
                50% {
                    box-shadow:
                        0 4px 15px rgba(20, 23, 37, 0.6),
                        0 2px 8px rgba(50, 55, 114, 0.2),
                        0 0 0 1px rgba(106, 115, 204, 0.6),
                        0 0 20px rgba(106, 115, 204, 0.3);
                }
            }

            /* 按钮内部元素样式 */
            .ai-analyze-button .ai-button-icon {
                font-size: 16px;
                transition: transform 0.3s ease;
                filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
            }

            .ai-analyze-button:hover .ai-button-icon {
                animation: ai-icon-rotate 2s linear infinite;
                filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
            }

            .ai-analyze-button .ai-button-text {
                font-weight: 600;
                letter-spacing: 0.5px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }

            .ai-analyze-button .ai-button-glow {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(50, 55, 114, 0.4) 0%, transparent 70%);
                border-radius: 12px;
                transform: translate(-50%, -50%);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }

            .ai-analyze-button:active .ai-button-glow {
                animation: ai-glow 0.6s ease-out;
            }

            /* 点击时的脉冲效果 */
            .ai-analyze-button.clicked {
                animation: ai-pulse 0.6s ease-out;
            }

            /* 加载完成后的持续动画效果 */
            .ai-analyze-button.loaded {
                animation: ai-glow-pulse 3s ease-in-out infinite;
                position: relative;
            }

            .ai-analyze-button.loaded::before {
                content: '';
                position: absolute;
                top: -1px;
                left: -1px;
                right: -1px;
                bottom: -1px;
                border-radius: 12px;
                background: linear-gradient(90deg,
                    rgba(50, 55, 114, 0.3) 0%,
                    rgba(74, 82, 153, 0.8) 25%,
                    rgba(106, 115, 204, 1) 50%,
                    rgba(74, 82, 153, 0.8) 75%,
                    rgba(50, 55, 114, 0.3) 100%);
                background-size: 200% 100%;
                animation: ai-border-flow 4s linear infinite;
                z-index: -1;
                opacity: 0.8;
            }

            .ai-analyze-button.loaded::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: 11px;
                background: linear-gradient(135deg, #141725 0%, #323772 100%);
                z-index: -1;
            }

            /* 加载状态样式 */
            .ai-analyze-button.loading {
                position: relative;
                overflow: hidden;
            }

            .ai-analyze-button.loading::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg,
                    transparent 0%,
                    rgba(106, 115, 204, 0.4) 50%,
                    transparent 100%);
                animation: ai-shimmer 1.5s infinite;
                z-index: 1;
            }

            .ai-analyze-button.loading .ai-button-text {
                position: relative;
                z-index: 2;
            }

            .ai-analyze-button.loading .ai-button-icon {
                position: relative;
                z-index: 2;
                animation: ai-icon-rotate 1s linear infinite;
            }

            /* 选中状态样式 */
            .ai-analyze-button.selected,
            .ai-analyze-button:focus {
                background: linear-gradient(135deg, #323772 0%, #4a5299 100%);
                border-color: rgba(74, 82, 153, 0.8);
                box-shadow: 0 0 0 2px rgba(50, 55, 114, 0.3), 0 4px 15px rgba(20, 23, 37, 0.6);
                outline: none;
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .ai-analyze-button {
                    padding: 10px 16px !important;
                    font-size: 13px !important;
                    min-width: 120px !important;
                }

                .ai-analyze-button .ai-button-icon {
                    font-size: 14px;
                }
            }

            /* 深色模式适配 */
            @media (prefers-color-scheme: dark) {
                .ai-analyze-button {
                    background: linear-gradient(135deg, #0f1219 0%, #2a2f5f 100%) !important;
                    border-color: rgba(42, 47, 95, 0.4) !important;
                    box-shadow: 0 4px 15px rgba(15, 18, 25, 0.8), 0 2px 8px rgba(42, 47, 95, 0.3) !important;
                }

                .ai-analyze-button:hover {
                    background: linear-gradient(135deg, #2a2f5f 0%, #3d4785 100%) !important;
                    border-color: rgba(42, 47, 95, 0.7) !important;
                    box-shadow: 0 8px 25px rgba(15, 18, 25, 0.9), 0 4px 15px rgba(42, 47, 95, 0.5) !important;
                }

                .ai-analyze-button.selected,
                .ai-analyze-button:focus {
                    box-shadow: 0 0 0 2px rgba(42, 47, 95, 0.4), 0 4px 15px rgba(15, 18, 25, 0.8) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 添加事件监听器
    addEventListeners() {
        // 检查事件监听器是否已经添加
        if (this.analyzeButton && !this.analyzeButton.dataset.listenerAdded) {
            // 移除可能存在的旧事件监听器
            this.analyzeButton.removeEventListener('click', this.handleAnalyzeClick);

            // 绑定this到handleAnalyzeClick方法
            this.handleAnalyzeClick = this.handleAnalyzeClick.bind(this);

            // 添加新的事件监听器
            this.analyzeButton.addEventListener('click', (e) => {
                e.preventDefault(); // 阻止默认的链接行为

                // 添加点击动画效果
                this.analyzeButton.classList.add('clicked');
                setTimeout(() => {
                    this.analyzeButton.classList.remove('clicked');
                }, 600);

                this.handleAnalyzeClick();
            });

            this.analyzeButton.dataset.listenerAdded = 'true'; // 标记事件监听器已添加
        }
    }

    // 处理分析按钮点击
    async handleAnalyzeClick() {
        try {
            console.log('AI分析按钮点击');

            // 添加加载状态
            this.setLoadingState(true);

            // 获取当前页面的模组数据
            const modData = await this.getModData();
            console.log('获取到模组数据:', modData);

            // 打开AI聊天窗口
            this.openAIChatWindow(modData);

            // 模拟加载完成后设置持续动画状态
            setTimeout(() => {
                this.setLoadingState(false);
                this.setLoadedState(true);
            }, 1500);

        } catch (error) {
            console.error('分析模组时出错:', error);
            this.setLoadingState(false);
            // 可以在这里添加用户提示，例如：
            // alert('获取模组数据失败，请稍后再试。');
        }
    }

    // 设置加载状态
    setLoadingState(isLoading) {
        if (!this.analyzeButton) return;

        if (isLoading) {
            this.analyzeButton.classList.add('loading');
            this.analyzeButton.classList.remove('loaded');
            // 禁用按钮防止重复点击
            this.analyzeButton.style.pointerEvents = 'none';
            this.analyzeButton.style.opacity = '0.8';
        } else {
            this.analyzeButton.classList.remove('loading');
            this.analyzeButton.style.pointerEvents = 'auto';
            this.analyzeButton.style.opacity = '1';
        }
    }

    // 设置加载完成状态（持续动画）
    setLoadedState(isLoaded) {
        if (!this.analyzeButton) return;

        if (isLoaded) {
            this.analyzeButton.classList.add('loaded');
            console.log('AI按钮进入加载完成状态，开始持续光流动画');
        } else {
            this.analyzeButton.classList.remove('loaded');
        }
    }

    // 获取模组数据 (直接从当前页面的DOM获取)
    async getModData() {
        console.log('从当前DOM获取模组数据');
        // 直接使用当前的 document 对象进行解析
        const modData = this.parseModData(document);

        // 从URL中提取游戏名称和模组ID并添加到modData
        const url = window.location.href;
        const match = url.match(/nexusmods\.com\/([^\/]+)\/mods\/(\d+)/);

        if (match) {
            modData.gameName = match[1];
            modData.modId = match[2];
        }

        return modData;
    }

    // 解析模组数据 (接收 Document 对象)
    parseModData(doc) {
        console.log('开始解析DOM');
        // 提取模组信息
        const modData = {
            name: doc.querySelector('#featured h1')?.textContent.trim() || '',
            description: doc.querySelector('.mod_description_container')?.textContent.trim() || '',
            images: Array.from(doc.querySelectorAll('.thumbgallery img')).map(img => img.src),
            stats: {},
            fileInfo: {},
            tabbedBlock: null
        };

        // 提取统计信息
        const stats = doc.querySelectorAll('.stats .statitem');
        stats.forEach(stat => {
            const title = stat.querySelector('.titlestat')?.textContent.trim();
            const value = stat.querySelector('.stat')?.textContent.trim();
            if (title && value) {
                modData.stats[title] = value;
            } else {
                // 尝试从不同的结构中提取，比如只有value的情况
                const potentialValue = stat.textContent.trim();
                if (potentialValue) {
                    // 简单的处理，可能需要更精确的选择器
                    modData.stats[potentialValue] = potentialValue; // 或者根据上下文推断键名
                }
            }
        });

        // 提取文件信息 (通常在文件页，但描述页可能也有部分信息)
        const fileInfoElement = doc.querySelector('#fileinfo'); // 示例：查找文件信息区域
        if (fileInfoElement) {
             // 示例：查找更新日期等，根据实际HTML结构调整选择器
            modData.fileInfo = {
                lastUpdated: fileInfoElement.querySelector('.update-date')?.textContent.trim() || '',
                // ... 提取其他文件相关信息
            };
        }

        // 提取 tabbed-block 内容
        const tabbedBlock = doc.querySelector('.tabbed-block');
        if (tabbedBlock) {
            modData.tabbedBlock = {
                text: tabbedBlock.textContent.trim(),
                links: Array.from(tabbedBlock.querySelectorAll('a[href]')).map(link => ({
                    text: link.textContent.trim(),
                    url: link.href
                })).filter(link => link.text && link.url)
            };
        }

        // 添加日志输出，检查提取的数据
        console.log('DOM解析完成，提取的数据:', modData);

        return modData;
    }

    // 打开AI聊天窗口
    openAIChatWindow(modData) {
        // 防止重复点击
        if (this.isOpeningWindow) {
            console.log('窗口正在打开中，请稍候...');
            return;
        }

        console.log('发送消息打开AI聊天窗口', modData);
        this.isOpeningWindow = true;

        // 设置超时，如果3秒后状态还是true，就重置状态
        if (this.windowOpenTimeout) {
            clearTimeout(this.windowOpenTimeout);
        }
        this.windowOpenTimeout = setTimeout(() => {
            console.log('窗口打开超时，重置状态');
            this.resetWindowState();
        }, 3000);

        // 发送消息给background script来打开AI聊天窗口
        chrome.runtime.sendMessage({
            action: 'openAIChat',
            modData: modData
        }, (response) => {
            if (chrome.runtime.lastError) {
                openAIChatWindow(modData)
                // console.error('打开AI聊天窗口失败:', chrome.runtime.lastError);
                this.resetWindowState();
                // alert('无法打开AI聊天窗口，请刷新页面后重试。');
            } else {
                // 成功打开窗口，重置状态
                this.resetWindowState();
            }
        });
    }

    // 重置窗口状态
    resetWindowState() {
        this.isOpeningWindow = false;
        if (this.windowOpenTimeout) {
            clearTimeout(this.windowOpenTimeout);
            this.windowOpenTimeout = null;
        }
    }
}

// 将AIModAnalyzer类暴露为全局变量
window.AIModAnalyzer = AIModAnalyzer;

}