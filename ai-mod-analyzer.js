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
        this.analyzeButton.innerHTML = '<span class="tab-label">AI分析模组</span>';
        this.analyzeButton.style.cssText = `
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
            text-decoration: none;
            margin-left: 10px;
        `;

        // 添加悬停效果
        this.analyzeButton.onmouseover = () => {
            this.analyzeButton.style.backgroundColor = '#45a049';
        };
        this.analyzeButton.onmouseout = () => {
            this.analyzeButton.style.backgroundColor = '#4CAF50';
        };

        // 将按钮添加到列表项中
        listItem.appendChild(this.analyzeButton);

        // 将列表项添加到 modtabs 列表的末尾
        modTabs.appendChild(listItem);

        // 添加事件监听器
        this.addEventListeners();
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
                this.handleAnalyzeClick();
            });
            
            this.analyzeButton.dataset.listenerAdded = 'true'; // 标记事件监听器已添加
        }
    }

    // 处理分析按钮点击
    async handleAnalyzeClick() {
        try {
            console.log('AI分析按钮点击');
            // 获取当前页面的模组数据
            const modData = await this.getModData();
            console.log('获取到模组数据:', modData);
            
            // 打开AI聊天窗口
            this.openAIChatWindow(modData);
        } catch (error) {
            console.error('分析模组时出错:', error);
            // 可以在这里添加用户提示，例如：
            // alert('获取模组数据失败，请稍后再试。');
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