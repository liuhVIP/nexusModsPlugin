// 常量定义
const CONSTANTS = {
  API_URL: 'https://alphachain.net.cn/openapi/v1/chat/completions',
  MODEL: 'bot-20250218182311-kq7vj',
  MAX_TOKENS: 8192,
  TEMPERATURE: 0.6,
  TOP_P: 0.95,
  PRESENCE_PENALTY: 0,
  FREQUENCY_PENALTY: 0,
  MAX_HISTORY_MESSAGES: 10, // 最大历史消息数量
  STORAGE_KEY: 'chatHistory', // 本地存储键名
  HISTORY_STORAGE_KEY: 'chatHistoryList', // 历史记录列表存储键名
  // 添加token计算相关常量
  TOKEN_RATIO: 1.3, // 中文字符的token比例
  MAX_TOKEN_WARNING: 7000 // token警告阈值
};

// 配置 marked
marked.setOptions({
  breaks: true, // 支持 GitHub 风格的换行
  gfm: true,    // 启用 GitHub 风格的 Markdown
  headerIds: false, // 禁用标题 ID
  mangle: false,    // 禁用标题 ID 转义
  sanitize: false,  // 允许 HTML 标签
  smartLists: true, // 使用更智能的列表行为
  smartypants: true, // 使用更智能的标点符号
  xhtml: false,      // 禁用 xhtml 输出
  renderer: new marked.Renderer() // 创建自定义渲染器
});

// 配置链接和图片渲染
marked.use({
  renderer: {
    link(href, title, text) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
    },
    image(href, title, text) {
      // 检查是否是图片链接
      const isImageUrl = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(href);
      if (isImageUrl) {
        return `<div class="message-image-container">
          <img src="${href}" alt="${text || '图片'}" class="message-image" loading="lazy" ${title ? `title="${title}"` : ''}>
        </div>`;
      }
      // 如果不是图片链接，返回普通链接
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text || href}</a>`;
    }
  }
});

// 状态管理
const state = {
  messages: [],        // 完整的消息历史
  isGenerating: false,
  currentStream: null,
  stopRequested: false,
  currentAiResponse: '', // 当前AI响应内容
  currentReasoning: '',  // 当前思考内容
  reasoningStartTime: null, // 思考开始时间
  reasoningEndTime: null,   // 思考结束时间
  currentChatId: null,      // 当前聊天ID
  chatHistory: [],          // 聊天历史列表
  modData: null            // 当前模组数据
};

// DOM元素
let elements = {
  chatMessages: null,
  chatInput: null,
  sendButton: null,
  newChatButton: null,
  chatHistory: null,
  sidebarToggle: null,
  modDataPreview: null    // 模组数据预览区域
};

// 工具函数
const utils = {
  // 格式化时间
  formatTime: () => {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  },

  // 生成唯一ID
  generateUniqueId: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // 自动滚动到底部
  scrollToBottom: () => {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  },

  // 调整输入框高度
  adjustTextareaHeight: (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  },
  
  // 获取需要发送的消息历史
  getMessageHistory: () => {
    // 复制消息历史，只保留角色和内容
    let historyMessages = state.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // 限制消息数量，避免超出token限制
    if (historyMessages.length > CONSTANTS.MAX_HISTORY_MESSAGES) {
      // 保留第一条系统消息（如果有）
      const firstMessage = historyMessages[0].role === 'system' ? [historyMessages[0]] : [];
      // 保留最近的消息
      const recentMessages = historyMessages.slice(-CONSTANTS.MAX_HISTORY_MESSAGES);
      historyMessages = [...firstMessage, ...recentMessages];
    }
    
    return historyMessages;
  },
  
  // 保存聊天历史到本地存储
  saveChatHistory: () => {
    try {
      localStorage.setItem('chatHistory', JSON.stringify(state.messages));
    } catch (error) {
      console.error('保存聊天历史失败:', error);
    }
  },
  
  // 从本地存储加载聊天历史
  loadChatHistory: () => {
    try {
      const history = localStorage.getItem('chatHistory');
      if (history) {
        state.messages = JSON.parse(history);
        return true;
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
    return false;
  },

  // 生成新的聊天ID
  generateChatId: () => {
    return 'chat_' + Date.now();
  },

  // 保存聊天历史列表
  saveChatHistoryList: () => {
    try {
      localStorage.setItem(CONSTANTS.HISTORY_STORAGE_KEY, JSON.stringify(state.chatHistory));
    } catch (error) {
      console.error('保存聊天历史列表失败:', error);
    }
  },

  // 加载聊天历史列表
  loadChatHistoryList: () => {
    try {
      const history = localStorage.getItem(CONSTANTS.HISTORY_STORAGE_KEY);
      if (history) {
        state.chatHistory = JSON.parse(history);
        return true;
      }
    } catch (error) {
      console.error('加载聊天历史列表失败:', error);
    }
    return false;
  },

  // 保存当前聊天记录
  saveCurrentChat: function() {
    if (!state.currentChatId) return;
    
    try {
      const chatData = {
        id: state.currentChatId,
        title: this.getChatTitle(),
        messages: state.messages,
        lastUpdate: Date.now()
      };
      
      // 更新或添加聊天记录
      const index = state.chatHistory.findIndex(chat => chat.id === state.currentChatId);
      if (index !== -1) {
        state.chatHistory[index] = chatData;
      } else {
        state.chatHistory.unshift(chatData);
      }
      
      // 保存到本地存储
      this.saveChatHistoryList();
    } catch (error) {
      console.error('保存当前聊天记录失败:', error);
    }
  },

  // 获取聊天标题
  getChatTitle: function() {
    // 使用第一条用户消息作为标题
    const firstUserMessage = state.messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
    }
    return '新对话';
  },

  // 格式化时间
  formatDate: (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // 计算文本的token数量
  calculateTokens: (text) => {
    if (!text) return 0;
    
    // 计算中文字符数量
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 计算其他字符数量
    const otherChars = text.length - chineseChars;
    
    // 中文字符按1.3倍计算，其他字符按1倍计算
    return Math.ceil(chineseChars * CONSTANTS.TOKEN_RATIO + otherChars);
  },

  // 更新token计数显示
  updateTokenCount: (text) => {
    let totalText = text || '';
    
    // 如果存在模组数据预览窗口，将其内容也计入token统计
    if (elements.modDataPreview) {
      const editableContent = elements.modDataPreview.querySelector('[contenteditable="true"]');
      if (editableContent) {
        totalText += '\n' + editableContent.textContent;
      }
    }
    
    const tokenCount = utils.calculateTokens(totalText);
    const tokenCountElement = document.getElementById('tokenCount');
    
    if (tokenCountElement) {
      tokenCountElement.textContent = `Token数量: ${tokenCount}`;
      
      // 如果超过警告阈值，添加警告样式
      if (tokenCount > CONSTANTS.MAX_TOKEN_WARNING) {
        tokenCountElement.style.color = '#ff4d4f';
      } else {
        tokenCountElement.style.color = '#666';
      }
    }
  }
};

// 消息处理
const messageHandler = {
  // 添加消息到界面
  addMessage: (content, isUser = false, messageId = null, modData = null) => {
    // 如果提供了messageId，检查是否已存在相应的消息元素
    if (messageId) {
      const existingMessage = document.getElementById(`message-${messageId}`);
      if (existingMessage) {
        // 更新现有消息内容
        const markdownContent = existingMessage.querySelector('.markdown-content');
        if (markdownContent) {
          markdownContent.innerHTML = marked.parse(content);
          // 如果是用户消息且有模组数据，更新模组数据部分（如果存在）
          if (isUser && modData) {
              const modDataSection = existingMessage.querySelector('.user-mod-data-section');
              if (modDataSection) {
                  const modDataContent = modDataSection.querySelector('.user-mod-data-content');
                  if (modDataContent) {
                       try {
                           modDataContent.innerHTML = marked.parse(formatModData(modData));
                       } catch (error) {
                           console.error('用户模组数据 Markdown 解析错误:', error);
                           modDataContent.textContent = formatModData(modData);
                       }
                  }
                  // 更新标题
                  const titleElement = modDataSection.querySelector('.user-mod-data-title');
                  if (titleElement) {
                       titleElement.textContent = `模组数据: ${modData.name.slice(0, 20)}${modData.name.length > 20 ? '...' : ''}`; // 限制名称长度
                  }
              }
          }
          utils.scrollToBottom();
          return existingMessage;
        }
      }
    }

    // 创建新的消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : ''}`;
    
    // 如果提供了messageId，设置元素id
    if (messageId) {
      messageDiv.id = `message-${messageId}`;
    }
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<img src="images/${isUser ? 'user' : 'ai'}-avatar.png" alt="${isUser ? '用户' : 'AI'}头像">`;
    
    // 创建一个新的容器来包含消息内容和模组数据区域
    const messageBody = document.createElement('div');
    messageBody.className = 'message-body';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (!isUser) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="message-action-btn copy-btn" title="复制">
          <img src="images/copy.png" alt="复制">
        </button>
      `;
      contentDiv.appendChild(actions);
      
      // 复制按钮事件：始终复制正式内容
      actions.querySelector('.copy-btn').addEventListener('click', () => {
        // 处理内容，去除多余的换行符
        const processedContent = content
          .trim() // 去除首尾空白
          .replace(/\n{3,}/g, '\n\n') // 将3个以上的换行符替换为2个
          .replace(/^\n+|\n+$/g, ''); // 去除首尾的换行符
        navigator.clipboard.writeText(processedContent);
        showCopyToast();
      });
    }
    
    const markdownContent = document.createElement('div');
    markdownContent.className = 'markdown-content';
    
    if (!isUser) {
      // AI消息添加markdown复制按钮
      const markdownCopyBtn = document.createElement('button');
      markdownCopyBtn.className = 'markdown-copy-btn';
      markdownCopyBtn.title = '复制 Markdown 内容';
      markdownCopyBtn.innerHTML = '<img src="images/copy.png" alt="复制">';
      markdownCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content);
        showCopyToast();
      });
      markdownContent.appendChild(markdownCopyBtn);
    }
    
    markdownContent.innerHTML = marked.parse(content);
    contentDiv.appendChild(markdownContent);
    
    // 声明 modDataSection 变量
    let modDataSection = null;
    
    // 如果是用户消息且包含模组数据，添加模组数据预览区域的触发元素
    if (isUser && modData) {
        modDataSection = document.createElement('div');
        // 初始状态仍然使用 collapsed 类，但不再控制 max-height 和 overflow
        modDataSection.className = 'user-mod-data-section collapsed';
        
        const toggle = document.createElement('div');
        toggle.className = 'user-mod-data-toggle';
        toggle.innerHTML = `<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`; // 使用深色图标
        modDataSection.appendChild(toggle);
        
        const header = document.createElement('div');
        header.className = 'user-mod-data-header';
        const titleText = modData.name.slice(0, 20) + (modData.name.length > 20 ? '...' : ''); // 限制名称长度
        header.innerHTML = `<span class="user-mod-data-title">${titleText}</span>`; // 标题只显示名称
        modDataSection.appendChild(header);
        
        // 创建悬浮内容区域，不直接添加到 modDataSection
        const modDataContentOverlay = document.createElement('div');
        modDataContentOverlay.className = 'user-mod-data-expanded-overlay';
        // 将模组数据内容直接放入悬浮内容区域
        modDataContentOverlay.innerHTML = `
            <span class="user-mod-data-title">模组数据: ${modData.name}</span>
            <div class="user-mod-data-content">${marked.parse(formatModData(modData))}</div>
        `;
        // 初始时不添加到 DOM，在需要时再添加

        // 关闭悬浮框的事件处理函数
        const closeOverlayOnClickOutside = (e) => {
            // 如果点击的目标不是悬浮框本身或其内部，并且不是原始的 toggle 或 header
            if (modDataContentOverlay.style.display === 'flex' && !modDataContentOverlay.contains(e.target) && e.target !== toggle && e.target !== header && !toggle.contains(e.target) && !header.contains(e.target)) {
                 modDataContentOverlay.style.display = 'none';
                 modDataSection.classList.remove('expanded'); // 移除expanded类
                 toggle.querySelector('svg').style.transform = 'rotate(-90deg)'; // 恢复图标方向
                 document.removeEventListener('click', closeOverlayOnClickOutside); // 移除监听
            }
        };

        // 添加展开/折叠功能（点击标题或图标）
        const toggleOverlay = (e) => {
            e.stopPropagation(); // 阻止事件冒泡

            // 检查是否已经有其他悬浮框打开，如果 B 已经打开，点击 A 会先关闭 B 再打开 A
            const existingOverlay = document.querySelector('.user-mod-data-expanded-overlay');
            if (existingOverlay && existingOverlay !== modDataContentOverlay) {
                existingOverlay.style.display = 'none';
                // 移除旧的关闭事件监听器（如果有）
                document.removeEventListener('click', closeOverlayOnClickOutside);
                 // 恢复之前打开的模组数据部分的图标和类名（如果需要）
                 const prevModDataSection = document.querySelector('.user-mod-data-section.expanded');
                 if(prevModDataSection) {
                     prevModDataSection.classList.remove('expanded');
                     const prevToggle = prevModDataSection.querySelector('.user-mod-data-toggle svg');
                     if(prevToggle) prevToggle.style.transform = 'rotate(-90deg)';
                 }
            }

            const isVisible = modDataContentOverlay.style.display === 'flex';
            if (isVisible) {
                // 如果当前可见，则隐藏
                modDataContentOverlay.style.display = 'none';
                modDataSection.classList.remove('expanded'); // 移除expanded类
                toggle.querySelector('svg').style.transform = 'rotate(-90deg)'; // 恢复图标方向
                document.removeEventListener('click', closeOverlayOnClickOutside); // 移除关闭监听
            } else {
                // 如果当前隐藏，则显示
                modDataContentOverlay.style.display = 'flex';
                modDataSection.classList.add('expanded'); // 添加expanded类
                toggle.querySelector('svg').style.transform = 'rotate(0deg)'; // 旋转图标

                // 确保悬浮框已添加到 body
                if (!document.body.contains(modDataContentOverlay)) {
                    document.body.appendChild(modDataContentOverlay);
                }

                // 定位悬浮框（可以根据需要调整定位逻辑）
                const rect = modDataSection.getBoundingClientRect();
                const overlay = modDataContentOverlay;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // 计算最佳位置
                let left = rect.left;
                let top = rect.bottom + window.scrollY + 5; // 距离底部5px
                
                // 检查右边界
                const rightEdge = left + overlay.offsetWidth;
                if (rightEdge > viewportWidth) {
                    // 如果超出右边界，向左偏移
                    left = Math.max(10, viewportWidth - overlay.offsetWidth - 10);
                }
                
                // 检查下边界
                const bottomEdge = top + overlay.offsetHeight;
                if (bottomEdge > viewportHeight + window.scrollY) {
                    // 如果超出下边界，尝试显示在触发元素上方
                    top = Math.max(10, rect.top + window.scrollY - overlay.offsetHeight - 5);
                }
                
                // 应用位置
                overlay.style.left = `${left}px`;
                overlay.style.top = `${top}px`;

                // 添加点击外部关闭的事件监听
                // 使用 setTimeout 延迟添加监听，避免立即触发点击关闭
                setTimeout(() => {
                     document.addEventListener('click', closeOverlayOnClickOutside);
                }, 0);
               
            }
        };


        toggle.addEventListener('click', toggleOverlay);
        header.addEventListener('click', toggleOverlay);

         // 防止点击悬浮框内部关闭
        modDataContentOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = utils.formatTime();
    contentDiv.appendChild(timeDiv);
    
    // 将内容区域添加到 messageBody
    messageBody.appendChild(contentDiv);

    // 将模组数据部分触发元素添加到 messageBody
    if (modDataSection) {
        messageBody.appendChild(modDataSection);
    }

    // 将 avatar 和 messageBody 添加到 messageDiv
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageBody);
    
    elements.chatMessages.appendChild(messageDiv);
    utils.scrollToBottom();
    
    return messageDiv;
  },

  // 添加打字机效果的消息
  addTypingMessage: () => {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="message-avatar">
        <img src="images/ai-avatar.png" alt="AI头像">
      </div>
      <div class="message-content">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    elements.chatMessages.appendChild(typingDiv);
    utils.scrollToBottom();
    return typingDiv;
  },
  
  // 更新消息内容
  updateMessageContent: (messageElement, content) => {
    if (!messageElement) return;
    
    const markdownContent = messageElement.querySelector('.markdown-content');
    if (markdownContent) {
      markdownContent.innerHTML = marked.parse(content);
      utils.scrollToBottom();
    }
  },
  
  // 添加或更新AI消息（包含思考内容和正式内容）
  updateAIMessage: (messageId, content, reasoningContent = null, isDone = false) => {
    let messageDiv = document.getElementById(`message-${messageId}`);
    let isNew = false;
    if (!messageDiv) {
      messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.id = `message-${messageId}`;
      isNew = true;
      
      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.innerHTML = `<img src="images/ai-avatar.png" alt="AI头像">`;
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="message-action-btn copy-btn" title="复制">
          <img src="images/copy.png" alt="复制">
        </button>
      `;
      contentDiv.appendChild(actions);
      
      if (reasoningContent) {
        const reasoningDiv = document.createElement('div');
        reasoningDiv.className = 'reasoning-section';
        reasoningDiv.id = `reasoning-section-${messageId}`;
        
        const toggle = document.createElement('div');
        toggle.className = 'reasoning-toggle';
        toggle.innerHTML = `<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" stroke="#bfa100" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
        reasoningDiv.appendChild(toggle);
        
        const header = document.createElement('div');
        header.className = 'reasoning-header';
        header.innerHTML = '思考过程 <span class="reasoning-timer" id="reasoning-timer-'+messageId+'"></span>';
        reasoningDiv.appendChild(header);
        
        const reasoningContentDiv = document.createElement('div');
        reasoningContentDiv.className = 'reasoning-content';
        reasoningContentDiv.id = `reasoning-${messageId}`;
        reasoningDiv.appendChild(reasoningContentDiv);
        contentDiv.appendChild(reasoningDiv);
        
        toggle.addEventListener('click', () => {
          reasoningDiv.classList.toggle('collapsed');
        });
      }
      
      const markdownContent = document.createElement('div');
      markdownContent.className = 'markdown-content';
      markdownContent.id = `content-${messageId}`;
      contentDiv.appendChild(markdownContent);
      
      const timeDiv = document.createElement('div');
      timeDiv.className = 'message-time';
      timeDiv.textContent = utils.formatTime();
      contentDiv.appendChild(timeDiv);
      
      messageDiv.appendChild(avatar);
      messageDiv.appendChild(contentDiv);
      
      elements.chatMessages.appendChild(messageDiv);
    }
    
    // 更新复制按钮的事件监听器
    const copyBtn = messageDiv.querySelector('.copy-btn');
    if (copyBtn) {
      // 移除旧的事件监听器
      const newCopyBtn = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
      // 添加新的事件监听器
      newCopyBtn.addEventListener('click', () => {
        // 处理内容，去除多余的换行符
        const processedContent = content
          .trim() // 去除首尾空白
          .replace(/\n{3,}/g, '\n\n') // 将3个以上的换行符替换为2个
          .replace(/^\n+|\n+$/g, ''); // 去除首尾的换行符
        navigator.clipboard.writeText(processedContent);
        showCopyToast();
      });
    }
    
    const contentElement = document.getElementById(`content-${messageId}`);
    if (contentElement) {
      try {
        // 预处理内容
        const processedContent = content
          .trim() // 去除首尾空白
          .replace(/\n{3,}/g, '\n\n') // 将3个以上的换行符替换为2个
          .replace(/^\n+|\n+$/g, ''); // 去除首尾的换行符
        
        // 使用 marked 解析内容
        const parsedContent = marked.parse(processedContent);
        
        // 保存原始内容到 data 属性
        contentElement.setAttribute('data-original-content', processedContent);
        
        // 更新内容，保留复制按钮
        const copyBtn = contentElement.querySelector('.markdown-copy-btn');
        contentElement.innerHTML = parsedContent;
        if (copyBtn) {
          contentElement.appendChild(copyBtn);
        }
        
        // 处理代码块
        contentElement.querySelectorAll('pre code').forEach((block) => {
          // 添加语言类
          if (!block.className) {
            block.className = 'language-plaintext';
          }
          
          // 为每个代码块添加复制按钮
          const pre = block.parentElement;
          if (!pre.querySelector('.code-copy-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.innerHTML = '<img src="images/copy.png" alt="复制">';
            copyBtn.title = '复制代码';
            
            copyBtn.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(block.textContent);
                showCopyToast();
              } catch (err) {
                console.error('复制代码失败:', err);
              }
            });
            
            pre.style.position = 'relative';
            pre.appendChild(copyBtn);
          }
        });
      } catch (error) {
        console.error('Markdown 解析错误:', error);
        contentElement.textContent = content;
      }
    }
    
    if (reasoningContent) {
      const reasoningElement = document.getElementById(`reasoning-${messageId}`);
      if (reasoningElement) {
        try {
          // 预处理思考内容
          const processedReasoning = reasoningContent
            .trim()
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\n+|\n+$/g, '');
          
          reasoningElement.innerHTML = marked.parse(processedReasoning);
        } catch (error) {
          console.error('思考内容 Markdown 解析错误:', error);
          reasoningElement.textContent = reasoningContent;
        }
      }
      
      const timerSpan = document.getElementById('reasoning-timer-'+messageId);
      if (timerSpan) {
        if (state.reasoningStartTime && state.reasoningEndTime) {
          const seconds = ((state.reasoningEndTime - state.reasoningStartTime)/1000).toFixed(1);
          timerSpan.textContent = `（用时 ${seconds} 秒）`;
        } else if (state.reasoningStartTime) {
          const now = Date.now();
          const seconds = ((now - state.reasoningStartTime)/1000).toFixed(1);
          timerSpan.textContent = `（用时 ${seconds} 秒）`;
        }
      }
      
      const reasoningDiv = document.getElementById(`reasoning-section-${messageId}`);
      if (reasoningDiv && isDone) {
        reasoningDiv.classList.add('collapsed');
      }
    }
    
    utils.scrollToBottom();
    return messageDiv;
  }
};

// 显示复制成功的提示
function showCopyToast() {
  // 检查是否已存在提示元素
  let toast = document.getElementById('copyToast');
  
  if (!toast) {
    // 创建提示元素
    toast = document.createElement('div');
    toast.id = 'copyToast';
    toast.className = 'copy-toast';
    toast.textContent = '复制成功';
    document.body.appendChild(toast);
  }
  
  // 显示提示
  toast.classList.add('show');
  
  // 2秒后隐藏
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// API调用
const apiHandler = {
  // 发送消息到API
  sendMessage: async (messages) => {
    const uniqueId = utils.generateUniqueId();
    const messageId = utils.generateUniqueId();
    
    const payload = {
      userId: -1,
      uniqueId,
      model: CONSTANTS.MODEL,
      token: null,
      temperature: CONSTANTS.TEMPERATURE,
      top_p: CONSTANTS.TOP_P,
      presence_penalty: CONSTANTS.PRESENCE_PENALTY,
      frequency_penalty: CONSTANTS.FREQUENCY_PENALTY,
      messages,
      stream: true,
      max_tokens: CONSTANTS.MAX_TOKENS
    };

    try {
      // 重置当前响应内容
      state.currentAiResponse = '';
      state.currentReasoning = '';
      state.reasoningStartTime = null;
      state.reasoningEndTime = null;
      let reasoningStarted = false;
      let typingMessage = null;

      const response = await fetch(CONSTANTS.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // 保存当前流以便可以取消
      state.currentStream = reader;

      while (true) {
        // 检查是否请求停止
        if (state.stopRequested) {
          await reader.cancel();
          break;
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              state.isGenerating = false;
              
              // 记录思考结束时间
              if (state.reasoningStartTime) {
                state.reasoningEndTime = Date.now();
              }
              
              // 确保最终内容已更新
              if (state.currentAiResponse || state.currentReasoning) {
                messageHandler.updateAIMessage(messageId, state.currentAiResponse, state.currentReasoning, true);
              }
              
              // 将消息添加到状态
              if (state.currentAiResponse) {
                state.messages.push({ role: 'assistant', content: state.currentAiResponse });
                // 保存聊天历史到本地存储
                utils.saveChatHistory();
              }
              
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0].delta) {
                const delta = parsed.choices[0].delta;
                
                // 处理思考内容
                const reasoningChunk = delta.reasoning_content || '';
                if (reasoningChunk) {
                  state.currentReasoning += reasoningChunk;
                  if (!reasoningStarted) {
                    state.reasoningStartTime = Date.now();
                    reasoningStarted = true;
                  }
                }
                
                // 处理正常内容
                const contentChunk = delta.content || '';
                if (contentChunk) {
                  state.currentAiResponse += contentChunk;
                  // 当收到第一个内容时，移除加载效果气泡
                  if (typingMessage) {
                    typingMessage.remove();
                    typingMessage = null;
                  }
                }
                
                // 更新消息显示
                messageHandler.updateAIMessage(messageId, state.currentAiResponse, state.currentReasoning, false);
              }
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('API Error:', error);
      messageHandler.addMessage('抱歉，发生了错误，请稍后重试。', false, messageId);
    } finally {
      state.isGenerating = false;
      state.currentStream = null;
      state.stopRequested = false;
    }
  }
};

// 历史记录处理
const historyHandler = {
  // 渲染历史记录列表
  renderHistoryList() {
    const historyContainer = elements.chatHistory;
    historyContainer.innerHTML = '';
    
    state.chatHistory.forEach(chat => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      if (chat.id === state.currentChatId) {
        historyItem.classList.add('active');
      }
      
      historyItem.innerHTML = `
        <img src="images/chat.png" alt="聊天" class="history-item-icon">
        <div class="history-item-content">
          <div class="history-item-title">${chat.title}</div>
          <div class="history-item-time">${utils.formatDate(chat.lastUpdate)}</div>
        </div>
        <button class="history-delete-btn" title="删除">
          <img src="images/delete.png" alt="删除">
        </button>
      `;
      
      // 添加点击事件加载聊天
      historyItem.querySelector('.history-item-content').addEventListener('click', () => {
        this.loadChat(chat.id);
      });
      
      // 添加删除按钮点击事件
      const deleteBtn = historyItem.querySelector('.history-delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        if (confirm('确定要删除这个聊天记录吗？')) {
          // 从历史记录中删除
          state.chatHistory = state.chatHistory.filter(c => c.id !== chat.id);
          // 保存更新后的历史记录
          utils.saveChatHistoryList();
          // 如果删除的是当前聊天，创建新聊天
          if (chat.id === state.currentChatId) {
            historyHandler.createNewChat();
          }
          // 重新渲染历史记录列表
          this.renderHistoryList();
        }
      });
      
      historyContainer.appendChild(historyItem);
    });
  },

  // 加载指定聊天
  loadChat(chatId) {
    const chat = state.chatHistory.find(c => c.id === chatId);
    if (!chat) return;
    
    // 更新状态
    state.currentChatId = chatId;
    state.messages = [...chat.messages];
    
    // 清空并重新渲染消息
    elements.chatMessages.innerHTML = '';
    state.messages.forEach(msg => {
      messageHandler.addMessage(msg.content, msg.role === 'user');
    });
    
    // 更新历史记录列表显示
    this.renderHistoryList();
  },

  // 创建新聊天
  createNewChat() {
    // 保存当前聊天
    if (state.currentChatId) {
      utils.saveCurrentChat();
    }
    
    // 创建新聊天
    state.currentChatId = utils.generateChatId();
    state.messages = [];
    elements.chatMessages.innerHTML = '';
    
    // 更新历史记录列表
    this.renderHistoryList();
  }
};

// 初始化DOM元素
function initializeElements() {
  elements = {
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendButton: document.getElementById('sendBtn'),
    newChatButton: document.getElementById('newChatBtn'),
    chatHistory: document.getElementById('chatHistory'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    modDataPreview: document.getElementById('modDataPreview')
  };
  
  // 初始化事件监听
  initializeEventListeners();
}

// 初始化事件监听
function initializeEventListeners() {
  // 输入框事件
  elements.chatInput.addEventListener('input', () => {
    utils.adjustTextareaHeight(elements.chatInput);
    elements.sendButton.disabled = !elements.chatInput.value.trim();
    // 添加token计数更新
    utils.updateTokenCount(elements.chatInput.value);
  });

  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!elements.sendButton.disabled) {
        handleSendMessage();
      }
    }
  });

  // 发送按钮事件
  elements.sendButton.addEventListener('click', () => {
    if (state.isGenerating) {
      // 如果正在生成，则停止生成
      state.stopRequested = true;
      state.currentStream?.cancel();
      state.isGenerating = false;
      
      // 保存已接收的内容
      if (state.currentAiResponse) {
        state.messages.push({ role: 'assistant', content: state.currentAiResponse });
        // 保存聊天历史到本地存储
        utils.saveChatHistory();
        // 保存当前聊天
        utils.saveCurrentChat();
        // 更新历史记录列表
        historyHandler.renderHistoryList();
      }
      
      // 恢复发送按钮
      elements.sendButton.innerHTML = '<img src="images/send.png" alt="发送">';
      elements.sendButton.disabled = true;
      // 启用历史记录
      enableHistoryItems();
    } else {
      handleSendMessage();
    }
  });

  // 侧边栏切换
  elements.sidebarToggle.addEventListener('click', () => {
    const sidebar = document.querySelector('.chat-sidebar');
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
      // 展开侧边栏
      sidebar.classList.remove('collapsed');
      // 更新图标
      elements.sidebarToggle.querySelector('img').style.transform = 'rotate(0deg)';
    } else {
      // 收起侧边栏
      sidebar.classList.add('collapsed');
      // 更新图标
      elements.sidebarToggle.querySelector('img').style.transform = 'rotate(180deg)';
    }
  });

  // 新建聊天按钮事件
  elements.newChatButton.addEventListener('click', () => {
    if (!state.isGenerating) {
      historyHandler.createNewChat();
    }
  });
}

// 添加禁用历史记录项的函数
function disableHistoryItems() {
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach(item => {
    item.style.opacity = '0.5';
    item.style.pointerEvents = 'none';
    item.style.cursor = 'not-allowed';
  });
}

// 添加启用历史记录项的函数
function enableHistoryItems() {
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach(item => {
    item.style.opacity = '1';
    item.style.pointerEvents = 'auto';
    item.style.cursor = 'pointer';
  });
}

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  
  // 加载聊天历史列表
  if (utils.loadChatHistoryList()) {
    historyHandler.renderHistoryList();
  }
  
  // 如果没有历史记录，创建新聊天
  if (state.chatHistory.length === 0) {
    historyHandler.createNewChat();
  } else {
    // 加载最新的聊天
    historyHandler.loadChat(state.chatHistory[0].id);
  }

  // 创建图片模态框
  const imageModal = document.createElement('div');
  imageModal.className = 'image-modal';
  document.body.appendChild(imageModal);

  // 添加图片点击事件委托
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('message-image')) {
      // 显示模态框
      imageModal.style.display = 'block';
      // 创建并显示大图
      const modalImg = document.createElement('img');
      modalImg.src = e.target.src;
      imageModal.innerHTML = '';
      imageModal.appendChild(modalImg);
    } else if (e.target === imageModal) {
      // 点击模态框背景关闭
      imageModal.style.display = 'none';
    }
  });
});

// 修改创建模组数据预览区域的函数
function createModDataPreview(modData) {
    // 如果已存在预览区域，先移除
    if (elements.modDataPreview) {
        elements.modDataPreview.remove();
    }

    // 创建预览容器
    const previewContainer = document.createElement('div');
    previewContainer.className = 'mod-data-preview';
    previewContainer.style.cssText = `
        margin: 10px 0;
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        overflow: hidden;
    `;

    // 创建标题栏（始终可见）
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: #f8f9fa;
        cursor: pointer;
        user-select: none;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
        font-weight: bold;
        color: #333;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    // 添加展开/折叠图标
    const expandIcon = document.createElement('span');
    expandIcon.innerHTML = '▼';
    expandIcon.style.cssText = `
        font-size: 12px;
        transition: transform 0.3s;
    `;
    
    title.appendChild(expandIcon);
    title.appendChild(document.createTextNode(`模组数据: ${modData.name}`));

    const actions = document.createElement('div');
    actions.style.cssText = `
        display: flex;
        gap: 10px;
    `;

    // 添加清除按钮
    const clearButton = document.createElement('button');
    clearButton.textContent = '清除';
    clearButton.style.cssText = `
        padding: 4px 8px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    clearButton.onclick = (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        previewContainer.remove();
        elements.modDataPreview = null;
        state.modData = null;
        // 更新token计数
        utils.updateTokenCount(elements.chatInput.value);
    };

    actions.appendChild(clearButton);
    titleBar.appendChild(title);
    titleBar.appendChild(actions);

    // 创建内容区域（默认隐藏）
    const content = document.createElement('div');
    content.style.cssText = `
        padding: 15px;
        background: white;
        border-top: 1px solid #e0e0e0;
        display: none;
    `;

    // 创建可编辑的内容区域
    const editableContent = document.createElement('div');
    editableContent.contentEditable = true;
    editableContent.style.cssText = `
        white-space: pre-wrap;
        outline: none;
        min-height: 100px;
        max-height: 300px;
        overflow-y: auto;
        padding: 10px;
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        line-height: 1.5;
    `;

    // 设置初始内容
    editableContent.textContent = formatModData(modData);

    // 添加内容变化监听
    editableContent.addEventListener('input', () => {
        // 更新模组数据
        try {
            const lines = editableContent.textContent.split('\n');
            const newModData = { ...modData };
            
            // 解析内容并更新模组数据
            let currentSection = '';
            lines.forEach(line => {
                if (line.startsWith('模组名称:')) {
                    newModData.name = line.replace('模组名称:', '').trim();
                } else if (line.startsWith('描述:')) {
                    currentSection = 'description';
                    newModData.description = '';
                } else if (line.startsWith('统计信息:')) {
                    currentSection = 'stats';
                    newModData.stats = {};
                } else if (line.startsWith('文件信息:')) {
                    currentSection = 'fileInfo';
                    newModData.fileInfo = {};
                } else if (line.startsWith('图片链接:')) {
                    currentSection = 'images';
                    newModData.images = [];
                } else if (line.trim()) {
                    switch (currentSection) {
                        case 'description':
                            newModData.description += line + '\n';
                            break;
                        case 'stats':
                            const [key, value] = line.split(':').map(s => s.trim());
                            if (key && value) newModData.stats[key] = value;
                            break;
                        case 'fileInfo':
                            const [fKey, fValue] = line.split(':').map(s => s.trim());
                            if (fKey && fValue) newModData.fileInfo[fKey] = fValue;
                            break;
                        case 'images':
                            if (line.startsWith('图片')) {
                                const url = line.split(':')[1]?.trim();
                                if (url) newModData.images.push(url);
                            }
                            break;
                    }
                }
            });
            
            // 更新状态中的模组数据
            state.modData = newModData;
            
            // 更新token计数
            utils.updateTokenCount(elements.chatInput.value);
        } catch (error) {
            console.error('解析模组数据失败:', error);
        }
    });

    content.appendChild(editableContent);
    previewContainer.appendChild(titleBar);
    previewContainer.appendChild(content);

    // 添加展开/折叠功能
    titleBar.addEventListener('click', () => {
        const isExpanded = content.style.display !== 'none';
        content.style.display = isExpanded ? 'none' : 'block';
        expandIcon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    // 将预览区域插入到预留的容器中
    const previewContainerElement = document.getElementById('modDataPreviewContainer');
    if (previewContainerElement) {
        previewContainerElement.appendChild(previewContainer);
    } else {
        console.error('未找到模组数据预览容器');
        // 如果找不到容器，仍然插入到输入框上方作为备用
        const chatInputWrapper = elements.chatInput.parentElement;
        chatInputWrapper.insertBefore(previewContainer, elements.chatInput);
    }

    // 保存预览区域的引用
    elements.modDataPreview = previewContainer;
    state.modData = modData;
    
    // 更新token计数
    utils.updateTokenCount(elements.chatInput.value);
}

// 修改 handleSendMessage 函数
async function handleSendMessage() {
    if (state.isGenerating) return;

    const message = elements.chatInput.value.trim();
    if (!message) return;

    // 如果是新聊天，创建新的聊天ID
    if (!state.currentChatId) {
        state.currentChatId = utils.generateChatId();
    }

    // 生成用户消息的唯一ID
    const userMessageId = utils.generateUniqueId();
    
    // 构建用户消息对象，包含模组数据（如果存在）
    const userMessage = { 
        role: 'user', 
        content: message, 
        id: userMessageId
    };
    
    if (state.modData) {
        userMessage.modData = state.modData;
    }

    // 添加用户消息到界面和历史
    messageHandler.addMessage(userMessage.content, true, userMessage.id, userMessage.modData);
    
    // 添加到消息历史
    state.messages.push(userMessage);
    
    // 保存聊天历史
    utils.saveCurrentChat();
    historyHandler.renderHistoryList();

    // 清空输入框和模组数据预览
    elements.chatInput.value = '';
    elements.sendButton.disabled = true;
    utils.adjustTextareaHeight(elements.chatInput);
    
    if (elements.modDataPreview) {
        elements.modDataPreview.remove();
        elements.modDataPreview = null;
        state.modData = null;
    }

    // 设置生成状态
    state.isGenerating = true;
    state.stopRequested = false;

    // 更改发送按钮为停止按钮
    elements.sendButton.innerHTML = '<img src="images/stop.png" alt="停止">';
    elements.sendButton.disabled = false;

    // 禁用历史记录项
    disableHistoryItems();

    try {
        // 获取聊天历史记录作为上下文
        const messageHistory = utils.getMessageHistory();
        
        // 如果用户消息中包含模组数据，将其添加到历史记录开头作为系统消息
        if (userMessage.modData) {
            const modDataContext = formatModData(userMessage.modData);
            if (messageHistory.length > 0 && messageHistory[0].role === 'system') {
                messageHistory[0].content += '\n\n' + modDataContext;
            } else {
                messageHistory.unshift({
                    role: 'system',
                    content: modDataContext
                });
            }
        }

        // 发送到API，带上历史记录
        await apiHandler.sendMessage(messageHistory);
        
        // 保存聊天历史
        utils.saveCurrentChat();
        historyHandler.renderHistoryList();
    } catch (error) {
        console.error('Error sending message:', error);
        messageHandler.addMessage('抱歉，发生了错误，请稍后重试。', false);
    } finally {
        // 恢复发送按钮
        elements.sendButton.innerHTML = '<img src="images/send.png" alt="发送">';
        elements.sendButton.disabled = true;
        state.isGenerating = false;
        // 启用历史记录
        enableHistoryItems();
    }
}

// 添加格式化模组数据的函数
function formatModData(modData) {
    const formattedData = `请分析以下模组信息，可以携带图片超链接返回,需按照格式[文本](链接)，\n\n模组名称: ${modData.name}\n\n描述:\n${modData.description}\n\n统计信息:\n${Object.entries(modData.stats).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n文件信息:\n${Object.entries(modData.fileInfo).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n前置文件信息:\n${modData.tabbedBlock ? `文件:链接:\n${modData.tabbedBlock.links.map(link => `${link.text}: ${link.url}`).join('\n')}` : '暂无前置文件信息'}\n\n图片链接:\n${modData.images && modData.images.length > 0 ? modData.images.map((url, index) => `图片${index + 1}: ${url}`).join('\n') : '暂无图片'}`;
    return formattedData;
}

// 修改监听来自 background script 的消息的处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'initAIChat') {
        console.log('收到初始化AI聊天窗口的消息:', request.modData);
        const modData = request.modData;
        
        // 创建模组数据预览区域
        if (modData) {
            createModDataPreview(modData);
        }
    }
}); 