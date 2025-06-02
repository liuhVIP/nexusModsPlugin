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

// 工具函数：检查是否为图片URL
function isImageUrl(url) {
  if (!url) return false;

  // 检查文件扩展名（包括查询参数的情况）
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
  if (imageExtensions.test(url)) {
    return true;
  }

  // 检查URL路径中是否包含图片扩展名（处理复杂URL结构）
  const pathImageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i;
  if (pathImageExtensions.test(url)) {
    return true;
  }

  // 检查常见的图片托管服务
  const imageHosts = [
    'imgur.com',
    'i.imgur.com',
    'cdn.discordapp.com',
    'media.discordapp.net',
    'i.redd.it',
    'preview.redd.it',
    'staticdelivery.nexusmods.com',
    'images.nexusmods.com',
    'github.com',
    'raw.githubusercontent.com',
    'user-images.githubusercontent.com',
    'avatars.githubusercontent.com',
    'camo.githubusercontent.com',
    'steamuserimages-a.akamaihd.net',
    'steamcdn-a.akamaihd.net',
    'cloud.githubusercontent.com'
  ];

  try {
    const urlObj = new URL(url);
    return imageHosts.some(host => urlObj.hostname.includes(host));
  } catch {
    return false;
  }
}

// 工具函数：安全地转义HTML属性
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 调试函数：测试内容处理
function debugContentProcessing(content) {
  console.group('内容处理调试');
  console.log('原始内容:', content);

  // 测试图片URL检测
  const urls = content.match(/(https?:\/\/[^\s<>"']+)/gi) || [];
  urls.forEach(url => {
    console.log(`URL: ${url}, 是否为图片: ${isImageUrl(url)}`);
  });

  const processed = postProcessContent(content);
  console.log('后处理结果:', processed);

  try {
    const rendered = marked.parse(processed);
    console.log('Markdown渲染结果:', rendered);
  } catch (error) {
    console.error('Markdown渲染错误:', error);
  }

  console.groupEnd();
  return processed;
}

// 工具函数：后处理内容，将裸露的图片链接转换为图片
function postProcessContent(content) {
  if (!content) return content;

  // 保存原始内容用于调试
  const originalContent = content;

  try {
    // 先收集所有已存在的markdown语法，避免重复处理
    const existingMarkdown = [];

    // 收集现有的图片语法 ![...](...)
    const imageRegex = /!\[[^\]]*\]\([^)]+\)/g;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      existingMarkdown.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'image'
      });
    }

    // 收集现有的链接语法 [...](...)
    const linkRegex = /(?<!!)\[[^\]]*\]\([^)]+\)/g;
    while ((match = linkRegex.exec(content)) !== null) {
      existingMarkdown.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'link'
      });
    }

    // 按位置排序
    existingMarkdown.sort((a, b) => a.start - b.start);

    // 查找所有可能的图片URL
    const urlRegex = /(https?:\/\/[^\s<>"'\[\]()]+)/gi;
    const urlMatches = [];

    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[1];
      const start = match.index;
      const end = start + url.length;

      // 检查这个URL是否在已存在的markdown语法中
      const isInExistingMarkdown = existingMarkdown.some(md =>
        start >= md.start && end <= md.end
      );

      // 如果不在现有markdown中，且是图片URL，则标记为需要转换
      if (!isInExistingMarkdown && isImageUrl(url)) {
        urlMatches.push({
          start,
          end,
          url,
          original: match[0]
        });
      }
    }

    // 从后往前替换，避免位置偏移
    urlMatches.reverse().forEach(urlMatch => {
      const before = content.substring(0, urlMatch.start);
      const after = content.substring(urlMatch.end);

      // 再次检查前后文，确保安全
      // 检查是否在代码块中
      const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
      let inCodeBlock = false;
      let codeMatch;
      while ((codeMatch = codeBlockRegex.exec(originalContent)) !== null) {
        if (urlMatch.start >= codeMatch.index && urlMatch.end <= codeMatch.index + codeMatch[0].length) {
          inCodeBlock = true;
          break;
        }
      }

      if (!inCodeBlock) {
        // 转换为markdown图片语法
        content = before + `![图片](${urlMatch.url})` + after;
      }
    });

    return content;

  } catch (error) {
    console.error('后处理内容时出错:', error);
    // 如果处理出错，返回原始内容
    return originalContent;
  }
}

// 配置链接和图片渲染
marked.use({
  renderer: {
    // 处理普通文本段落
    paragraph(text) {
      return `<p>${text}</p>`;
    },

    // 处理链接
    link(href, title, text) {
      // 检查链接是否指向图片
      if (isImageUrl(href)) {
        // 如果链接指向图片，渲染为图片而不是链接
        const safeHref = escapeHtml(href);
        const safeTitle = title ? escapeHtml(title) : '';
        const safeAlt = escapeHtml(text || '图片');

        return `<div class="message-image-container">
          <img src="${safeHref}" alt="${safeAlt}" class="message-image" loading="lazy" ${title ? `title="${safeTitle}"` : ''}
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; padding: 20px; text-align: center; background: #f5f5f5; border-radius: 8px; color: #666;">
            <p>图片加载失败</p>
            <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">点击查看原图</a>
          </div>
        </div>`;
      }

      // 如果不是图片链接，渲染为普通链接
      const safeHref = escapeHtml(href);
      const safeTitle = title ? escapeHtml(title) : '';
      const safeText = escapeHtml(text);

      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" ${title ? `title="${safeTitle}"` : ''}>${safeText}</a>`;
    },

    // 处理图片
    image(href, title, text) {
      // 使用改进的图片检测函数
      if (isImageUrl(href)) {
        const safeHref = escapeHtml(href);
        const safeTitle = title ? escapeHtml(title) : '';
        const safeAlt = escapeHtml(text || '图片');

        return `<div class="message-image-container">
          <img src="${safeHref}" alt="${safeAlt}" class="message-image" loading="lazy" ${title ? `title="${safeTitle}"` : ''}
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; padding: 20px; text-align: center; background: #f5f5f5; border-radius: 8px; color: #666;">
            <p>图片加载失败</p>
            <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">点击查看原图</a>
          </div>
        </div>`;
      }
      // 如果不是图片链接，返回普通链接
      const safeHref = escapeHtml(href);
      const safeTitle = title ? escapeHtml(title) : '';
      const safeText = escapeHtml(text || href);

      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" ${title ? `title="${safeTitle}"` : ''}>${safeText}</a>`;
    },

    // 处理代码块
    code(code, language) {
      const validLanguage = language && language.match(/^[a-zA-Z0-9_+-]*$/);
      const langClass = validLanguage ? ` class="language-${language}"` : '';
      const safeCode = escapeHtml(code);

      return `<pre><code${langClass}>${safeCode}</code></pre>`;
    },

    // 处理行内代码
    codespan(code) {
      const safeCode = escapeHtml(code);
      return `<code>${safeCode}</code>`;
    },

    // 处理强调文本
    strong(text) {
      return `<strong>${text}</strong>`;
    },

    // 处理斜体文本
    em(text) {
      return `<em>${text}</em>`;
    },

    // 处理删除线
    del(text) {
      return `<del>${text}</del>`;
    },

    // 处理列表
    list(body, ordered) {
      const tag = ordered ? 'ol' : 'ul';
      return `<${tag}>${body}</${tag}>`;
    },

    // 处理列表项
    listitem(text) {
      return `<li>${text}</li>`;
    },

    // 处理标题
    heading(text, level) {
      const safeText = text;
      return `<h${level}>${safeText}</h${level}>`;
    },

    // 处理引用
    blockquote(quote) {
      return `<blockquote>${quote}</blockquote>`;
    },

    // 处理换行
    br() {
      return '<br>';
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

    // 后处理内容，将裸露的图片链接转换为图片
    const processedContent = postProcessContent(content);
    markdownContent.innerHTML = marked.parse(processedContent);
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
    if (!messageDiv) {
      messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.id = `message-${messageId}`;

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
        let processedContent = content
          .trim() // 去除首尾空白
          .replace(/\n{3,}/g, '\n\n') // 将3个以上的换行符替换为2个
          .replace(/^\n+|\n+$/g, ''); // 去除首尾的换行符

        // 后处理内容，将裸露的图片链接转换为图片
        processedContent = postProcessContent(processedContent);

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
          let processedReasoning = reasoningContent
            .trim()
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\n+|\n+$/g, '');

          // 后处理思考内容，将裸露的图片链接转换为图片
          processedReasoning = postProcessContent(processedReasoning);

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

  // 监听来自父窗口的消息（用于统一聊天窗口）
  window.addEventListener('message', (event) => {
    console.log('🎯 AI聊天iframe收到消息:', event.data);

    if (event.data && event.data.action === 'initModData') {
      const modData = event.data.modData;
      console.log('📦 收到模组数据:', modData);

      // 创建模组数据预览
      if (typeof createModDataPreview === 'function') {
        createModDataPreview(modData);
      } else {
        console.warn('createModDataPreview 函数不存在');
      }
    }
  });

  // 创建图片模态框
  const imageModal = document.createElement('div');
  imageModal.className = 'image-modal';
  document.body.appendChild(imageModal);

  // 图片缩放状态
  let currentScale = 1;
  let currentModalImg = null;
  let scaleIndicator = null;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;
  const SCALE_STEP = 0.1;

  // 重置图片缩放
  function resetImageScale() {
    currentScale = 1;
    if (currentModalImg) {
      currentModalImg.style.transform = 'translate(-50%, -50%) scale(1)';
    }
    updateScaleIndicator();
  }

  // 应用图片缩放
  function applyImageScale(scale) {
    if (currentModalImg) {
      currentModalImg.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
    updateScaleIndicator();
  }

  // 更新缩放比例指示器
  function updateScaleIndicator() {
    if (scaleIndicator) {
      const percentage = Math.round(currentScale * 100);
      scaleIndicator.textContent = `${percentage}%`;

      // 添加动画效果
      scaleIndicator.style.transform = 'scale(1.1)';
      setTimeout(() => {
        scaleIndicator.style.transform = 'scale(1)';
      }, 150);
    }
  }

  // 添加图片点击事件委托
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('message-image')) {
      // 显示模态框
      imageModal.style.display = 'block';
      // 创建并显示大图
      const modalImg = document.createElement('img');
      modalImg.src = e.target.src;
      modalImg.style.transition = 'transform 0.2s ease';
      modalImg.style.cursor = 'grab';

      // 添加缩放提示
      const zoomHint = document.createElement('div');
      zoomHint.className = 'zoom-hint';
      zoomHint.innerHTML = '💡 滚轮缩放 | 双击重置 | ESC关闭';

      // 添加缩放比例指示器
      const scaleIndicatorDiv = document.createElement('div');
      scaleIndicatorDiv.className = 'scale-indicator';
      scaleIndicatorDiv.textContent = '100%';

      imageModal.innerHTML = '';
      imageModal.appendChild(modalImg);
      imageModal.appendChild(zoomHint);
      imageModal.appendChild(scaleIndicatorDiv);

      currentModalImg = modalImg;
      scaleIndicator = scaleIndicatorDiv;
      resetImageScale();

      // 双击重置缩放
      modalImg.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        resetImageScale();
      });

      // 添加键盘事件监听
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          imageModal.style.display = 'none';
          currentModalImg = null;
          scaleIndicator = null;
          document.removeEventListener('keydown', handleKeyDown);
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const newScale = Math.min(MAX_SCALE, currentScale + SCALE_STEP);
          if (newScale !== currentScale) {
            currentScale = newScale;
            applyImageScale(currentScale);
          }
        } else if (e.key === '-') {
          e.preventDefault();
          const newScale = Math.max(MIN_SCALE, currentScale - SCALE_STEP);
          if (newScale !== currentScale) {
            currentScale = newScale;
            applyImageScale(currentScale);
          }
        } else if (e.key === '0') {
          e.preventDefault();
          resetImageScale();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

    } else if (e.target === imageModal) {
      // 点击模态框背景关闭
      imageModal.style.display = 'none';
      currentModalImg = null;
      scaleIndicator = null;
    }
  });

  // 添加鼠标滚轮缩放功能
  imageModal.addEventListener('wheel', (e) => {
    if (!currentModalImg) return;

    e.preventDefault();
    e.stopPropagation();

    // 计算新的缩放比例
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentScale + delta));

    if (newScale !== currentScale) {
      currentScale = newScale;
      applyImageScale(currentScale);
    }
  });

  // 阻止模态框内的滚轮事件冒泡到页面
  imageModal.addEventListener('wheel', (e) => {
    e.stopPropagation();
  }, { passive: false });

  // 添加全局调试函数
  window.chatDebug = {
    testContent: debugContentProcessing,
    testImageUrl: isImageUrl,
    postProcess: postProcessContent,
    renderMarkdown: (content) => marked.parse(content),
    // 测试各种内容类型
    testAll: () => {
      const testCases = [
        '这是普通文字',
        'https://example.com/image.jpg',
        '![已有图片](https://example.com/existing.png)',
        '[普通链接](https://example.com)',
        '混合内容：这里有文字 https://i.imgur.com/test.jpg 还有更多文字',
        '代码中的链接：`https://example.com/image.png`',
        '```\nhttps://example.com/code-image.jpg\n```',
        // 添加你提供的具体测试案例
        'https://staticdelivery.nexusmods.com/mods/2531/images/thumbnails/8181/8181-1743260154-1810356489.png'
      ];

      testCases.forEach((test, index) => {
        console.log(`\n=== 测试案例 ${index + 1}: ${test} ===`);
        debugContentProcessing(test);
      });
    },
    // 专门测试你的URL
    testNexusUrl: () => {
      const url = 'https://staticdelivery.nexusmods.com/mods/2531/images/thumbnails/8181/8181-1743260154-1810356489.png';
      console.log('测试Nexus图片URL:', url);
      console.log('是否被识别为图片:', isImageUrl(url));
      debugContentProcessing(url);
    },
    // 测试实际AI返回的内容
    testActualAIContent: () => {
      const content = `[模组名称: Afterlight Reshade](https://staticdelivery.nexusmods.com/mods/6944/images/thumbnails/1358/1358-1745230185-303885123.png)
专为《S.T.A.L.K.E.R. 2》设计的电影级画质增强预设，通过21种着色器模拟**廉价镜头美学**，包含动态模糊、HUD叠加、色差等效果。

### 核心功能亮点
🔹 **沉浸式镜头缺陷**
- [镜头柔光](https://staticdelivery.nexusmods.com/mods/6944/images/thumbnails/1358/1358-1745230186-1581374871.png)：GaussianBlur制造运动模糊与雾面质感
- [VHS故障特效](https://staticdelivery.nexusmods.com/mods/6944/images/thumbnails/1358/1358-1745230191-138771826.png)：VHS_RA着色器生成信号干扰与跟踪错误
- [广角畸变](https://staticdelivery.nexusmods.com/mods/6944/images/thumbnails/1358/1358-1745230192-1558651387.png)：PerfectPerspective实现鱼眼镜头变形

🔹 **专业级色彩科学**
- 冷调LUT包：Bonus LUT Pack打造法医蓝调色板
- 选择性降饱和：Selective Color剥离暖色调模拟执法记录仪
- [动态光效](https://staticdelivery.nexusmods.com/mods/6944/images/thumbnails/1358/1358-1745230197-700500790.png)：AmbientLight实现光线折射与色渗`;

      console.log('测试实际AI返回内容:');
      debugContentProcessing(content);
    },

    // 测试图片缩放功能
    testImageZoom: () => {
      console.log('图片缩放功能说明:');
      console.log('1. 点击聊天中的图片可以放大查看');
      console.log('2. 在放大的图片上使用鼠标滚轮可以缩放');
      console.log('3. 双击图片可以重置缩放比例');
      console.log('4. 键盘快捷键:');
      console.log('   - ESC: 关闭图片');
      console.log('   - +/=: 放大');
      console.log('   - -: 缩小');
      console.log('   - 0: 重置缩放');
      console.log('5. 缩放范围: 10% - 500%');
      console.log('6. 右下角显示当前缩放比例');
    }
  };

  console.log('AI聊天调试工具已加载，使用 window.chatDebug 访问调试功能');
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
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'initAIChat') {
        console.log('收到初始化AI聊天窗口的消息:', request.modData);
        const modData = request.modData;

        // 创建模组数据预览区域
        if (modData) {
            createModDataPreview(modData);
        }
    }
});